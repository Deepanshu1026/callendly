const supabase = require('../config/database');

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
    const { rules } = req.body; // Array of { dayOfWeek, startTime, endTime, isActive }

    // Delete existing rules for user
    const { error: deleteError } = await supabase
      .from('availability_rules')
      .delete()
      .eq('userId', req.user.id)
      .is('eventTypeId', null);

    if (deleteError) throw deleteError;

    // Create new rules
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
    const { date } = req.query; // YYYY-MM-DD

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*, user:users(*, event_types(*), availability_rules(*), bookings(*))')
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
    const rules = (user.availability_rules || []).filter(r => r.eventTypeId === null && r.isActive);
    
    // Filter bookings for the date range
    const startOfDay = new Date(date + 'T00:00:00Z');
    const endOfDay = new Date(date + 'T23:59:59Z');
    const bookings = (user.bookings || []).filter(b => 
      b.status === 'confirmed' && 
      new Date(b.startTime) >= startOfDay && 
      new Date(b.startTime) < endOfDay
    );

    // Fetch Google Calendar events for target date to prevent double bookings
    const googleEvents = [];
    try {
      const { data: connectedCals } = await supabase
        .from('calendars')
        .select('*')
        .eq('userId', user.id);

      if (connectedCals && connectedCals.length > 0) {
        const googleCalendarService = require('../services/googleCalendarService');
        const timeMin = startOfDay.toISOString();
        const timeMax = endOfDay.toISOString();
        for (const cal of connectedCals) {
          if (cal.provider === 'google' && cal.accessToken) {
            try {
              const events = await googleCalendarService.listEvents(
                'primary',
                cal.accessToken,
                cal.refreshToken,
                timeMin,
                timeMax
              );
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

    if (rules.length === 0) {
      return res.json({ slots: [] });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const dayRules = rules.filter(r => r.dayOfWeek === dayOfWeek);

    if (dayRules.length === 0) {
      return res.json({ slots: [] });
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

        // Check if overlaps with database bookings
        const isDbBooked = bookings.some(b => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return (current >= bStart && current < bEnd) || (slotEnd > bStart && slotEnd <= bEnd);
        });

        // Check if overlaps with Google Calendar events
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

    res.json({ slots });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
