const supabase = require('../config/database');

async function generateSlots(userId, eventType, date) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*, availability_rules(*), bookings(*)')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    throw new Error('User not found');
  }

  const rules = (user.availability_rules || []).filter(r => r.eventTypeId === null && r.isActive);

  let dateOverride = null;
  try {
    const { data: overrides } = await supabase
      .from('date_overrides')
      .select('*')
      .eq('userId', userId)
      .eq('date', date);
    dateOverride = overrides && overrides.length > 0 ? overrides[0] : null;
  } catch (overrideErr) {
    console.error('Date override lookup error:', overrideErr);
  }

  const startOfDay = new Date(date + 'T00:00:00Z');
  const endOfDay = new Date(date + 'T23:59:59Z');
  const bookings = (user.bookings || []).filter(b =>
    b.status === 'confirmed' &&
    new Date(b.startTime) >= startOfDay &&
    new Date(b.startTime) < endOfDay
  );

  const googleEvents = [];
  try {
    const { data: connectedCals } = await supabase
      .from('calendars')
      .select('*')
      .eq('userId', userId);

    if (connectedCals && connectedCals.length > 0) {
      const googleCalendarService = require('../services/googleCalendarService');
      const timeMin = startOfDay.toISOString();
      const timeMax = endOfDay.toISOString();
      for (const cal of connectedCals) {
        if (cal.provider === 'google' && cal.accessToken) {
          try {
            const events = await googleCalendarService.listEvents('primary', cal.accessToken, cal.refreshToken, timeMin, timeMax);
            if (events && events.length > 0) {
              googleEvents.push(...events);
            }
          } catch (calErr) {
            console.error('Google Calendar Sync Error during slot fetch:', calErr);
          }
        }
      }
    }
  } catch (dbErr) {
    console.error('Failed to lookup calendar connections:', dbErr);
  }

  if (rules.length === 0 && !dateOverride) {
    return [];
  }

  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  let dayRules;
  if (dateOverride) {
    if (!dateOverride.isActive) return [];
    dayRules = [{ dayOfWeek, startTime: dateOverride.startTime, endTime: dateOverride.endTime, isActive: dateOverride.isActive }];
  } else {
    dayRules = rules.filter(r => r.dayOfWeek === dayOfWeek);
  }

  if (dayRules.length === 0) {
    return [];
  }

  const slots = [];
  const duration = eventType.duration + eventType.bufferAfter;

  for (const rule of dayRules) {
    const [startH, startM] = rule.startTime.split(':').map(Number);
    const [endH, endM] = rule.endTime.split(':').map(Number);

    let current = new Date(targetDate);
    current.setUTCHours(startH, startM, 0, 0);

    const end = new Date(targetDate);
    end.setUTCHours(endH, endM, 0, 0);

    while (current < end) {
      const slotEnd = new Date(current.getTime() + duration * 60000);
      if (slotEnd > end) break;

      const isDbBooked = bookings.some(b => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return (current >= bStart && current < bEnd) || (slotEnd > bStart && slotEnd <= bEnd);
      });

      const isGoogleBooked = googleEvents.some(event => {
        const startStr = event.start?.dateTime || event.start?.date;
        const endStr = event.end?.dateTime || event.end?.date;
        if (!startStr || !endStr) return false;
        const eStart = new Date(startStr);
        const eEnd = new Date(endStr);
        return (current < eEnd && slotEnd > eStart);
      });

      if (!isDbBooked && !isGoogleBooked) {
        slots.push({
          startTime: current.toISOString(),
          endTime: slotEnd.toISOString()
        });
      }

      current = new Date(current.getTime() + duration * 60000);
    }
  }

  return slots;
}

exports.generateSlots = generateSlots;

exports.getAvailability = async (req, res) => {
  try {
    const { data: rules, error } = await supabase
      .from('availability_rules')
      .select('*')
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ rules: rules || [] });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.setAvailability = async (req, res) => {
  try {
    const { rules } = req.body;

    const { error: deleteError } = await supabase
      .from('availability_rules')
      .delete()
      .eq('userId', req.user.id)
      .is('eventTypeId', null);

    if (deleteError) throw deleteError;

    const { data: created, error: insertError } = await supabase
      .from('availability_rules')
      .insert(rules.map(r => ({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        isActive: r.isActive ?? true,
        updatedAt: new Date().toISOString()
      })))
      .select();

    if (insertError) throw insertError;

    res.json({ created });
  } catch (error) {
    console.error('Set availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAvailableSlots = async (req, res) => {
  try {
    const { username, slug } = req.params;
    const { date } = req.query;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*, user:users(*, event_types(*))')
      .eq('username', username)
      .maybeSingle();

    if (error || !profile || !profile.user) {
      return res.status(404).json({ error: 'Not found' });
    }

    const user = profile.user;
    const matchedEventTypes = (user.event_types || []).filter(et => et.slug === slug && et.isActive);
    if (matchedEventTypes.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const eventType = matchedEventTypes[0];
    const slots = await generateSlots(user.id, eventType, date);

    res.json({ slots });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getGuestAvailableSlots = async (req, res) => {
  try {
    const { token } = req.params;
    const { date } = req.query;

    const decoded = require('../utils/jwt').verifyToken(token);
    if (!decoded || decoded.purpose !== 'guest_reschedule' || !decoded.bookingId) {
      return res.status(400).json({ error: 'Invalid or expired link' });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, eventType:event_types(*)')
      .eq('id', decoded.bookingId)
      .maybeSingle();

    if (!booking || !booking.eventType) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const slots = await generateSlots(booking.userId, booking.eventType, date);
    res.json({ slots });
  } catch (error) {
    console.error('Get guest available slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
