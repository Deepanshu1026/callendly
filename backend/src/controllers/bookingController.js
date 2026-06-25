const supabase = require('../config/database');
const { triggerWebhooks } = require('../utils/webhooks');
const { logAudit } = require('../utils/audit');
const { sendBookingNotification } = require('../services/notificationService');

const parsePaymentConfig = (desc) => {
  if (!desc) return { cleanDescription: '', requiresPayment: false, price: 0, currency: 'INR' };
  const marker = '\n\n---PAYMENT_METADATA---\n';
  const idx = desc.indexOf(marker);
  if (idx === -1) {
    return { cleanDescription: desc, requiresPayment: false, price: 0, currency: 'INR' };
  }
  const cleanDescription = desc.substring(0, idx);
  try {
    const meta = JSON.parse(desc.substring(idx + marker.length));
    return {
      cleanDescription,
      requiresPayment: !!meta.requiresPayment,
      price: parseFloat(meta.price) || 0,
      currency: meta.currency || 'INR'
    };
  } catch (e) {
    return { cleanDescription, requiresPayment: false, price: 0, currency: 'INR' };
  }
};


exports.getBookings = async (req, res) => {
  try {
    const { status, upcoming, past } = req.query;
    const now = new Date();

    let query = supabase
      .from('bookings')
      .select('*, eventType:event_types(title, duration, color), answers:booking_answers(*, question:booking_questions(label))')
      .eq('userId', req.user.id);

    if (status) query = query.eq('status', status);
    if (upcoming === 'true') query = query.gte('startTime', now.toISOString());
    if (past === 'true') query = query.lt('startTime', now.toISOString());

    const { data: bookings, error } = await query.order('startTime', { ascending: false });

    if (error) throw error;

    res.json({ bookings: bookings || [] });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const { username, slug } = req.params;
    const { guestName, guestEmail, guestPhone, guestNotes, startTime, endTime, timezone, answers } = req.body;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*, user:users(*, event_types(*), bookings(*))')
      .eq('username', username)
      .maybeSingle();

    if (error || !profile || !profile.user) {
      return res.status(404).json({ error: 'Host profile not found' });
    }

    const user = profile.user;
    const matchedEventTypes = (user.event_types || []).filter(et => et.slug === slug && et.isActive);
    if (matchedEventTypes.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const eventType = matchedEventTypes[0];
    const hostId = user.id;

    // Check for double booking
    const parsedEndTime = new Date(endTime);
    const parsedStartTime = new Date(startTime);
    const conflictingBookings = (user.bookings || []).filter(b => 
      b.status === 'confirmed' &&
      new Date(b.startTime) < parsedEndTime &&
      new Date(b.endTime) > parsedStartTime
    );

    if (conflictingBookings.length > 0) {
      return res.status(409).json({ error: 'This time slot is no longer available. Please select another time.' });
    }

    // Check conflicts against connected Google Calendars
    let isGoogleBooked = false;
    try {
      const { data: connectedCals } = await supabase
        .from('calendars')
        .select('*')
        .eq('userId', hostId);

      if (connectedCals && connectedCals.length > 0) {
        const googleCalendarService = require('../services/googleCalendarService');
        const timeMin = parsedStartTime.toISOString();
        const timeMax = parsedEndTime.toISOString();
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
                isGoogleBooked = events.some(event => {
                  const startStr = event.start?.dateTime || event.start?.date;
                  const endStr = event.end?.dateTime || event.end?.date;
                  if (!startStr || !endStr) return false;
                  const eStart = new Date(startStr);
                  const eEnd = new Date(endStr);
                  return (parsedStartTime < eEnd && parsedEndTime > eStart);
                });
                if (isGoogleBooked) break;
              }
            } catch (calErr) {
              console.error('Google Calendar conflict check error:', calErr);
            }
          }
        }
      }
    } catch (dbErr) {
      console.error('Failed to lookup calendar connections for double booking check:', dbErr);
    }

    if (isGoogleBooked) {
      return res.status(409).json({ error: 'This time slot is no longer available on the host\'s Google Calendar.' });
    }

    // Check minimum notice
    if (eventType.minimumNotice > 0) {
      const noticeHours = (parsedStartTime - new Date()) / 36e5;
      if (noticeHours < eventType.minimumNotice) {
        return res.status(400).json({ error: `Booking must be made at least ${eventType.minimumNotice} hours in advance` });
      }
    }

    // Parse payment config from description
    const { requiresPayment, price, currency } = parsePaymentConfig(eventType.description);
    const initialStatus = requiresPayment ? 'pending' : 'confirmed';

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        id: require('crypto').randomUUID(),
        userId: hostId,
        eventTypeId: eventType.id,
        guestName,
        guestEmail,
        guestPhone,
        guestNotes,
        startTime: parsedStartTime.toISOString(),
        endTime: parsedEndTime.toISOString(),
        timezone: timezone || 'UTC',
        location: eventType.location,
        status: initialStatus,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Insert answers
    if (answers && booking) {
      const answersData = Object.entries(answers).map(([questionId, answer]) => ({
        id: require('crypto').randomUUID(),
        bookingId: booking.id,
        questionId,
        answer: String(answer),
        updatedAt: new Date().toISOString()
      }));
      await supabase
        .from('booking_answers')
        .insert(answersData);
    }

    booking.eventType = eventType;

    // If it requires payment, return early without calendar sync or notifications
    if (requiresPayment) {
      return res.status(201).json({
        booking,
        requiresPayment: true,
        price,
        currency
      });
    }

    // Sync with Google Calendar and create Google Meet link if connected (for free bookings)
    let hangoutLink = null;
    try {
      const { data: connectedCals } = await supabase
        .from('calendars')
        .select('*')
        .eq('userId', hostId);

      if (connectedCals && connectedCals.length > 0) {
        const googleCalendarService = require('../services/googleCalendarService');
        for (const cal of connectedCals) {
          if (cal.provider === 'google' && cal.accessToken) {
            try {
              const eventPayload = {
                summary: `${eventType.title} with ${guestName}`,
                description: guestNotes || `Scheduled via Callendly. Guest Email: ${guestEmail}`,
                start: { dateTime: parsedStartTime.toISOString() },
                end: { dateTime: parsedEndTime.toISOString() },
                attendees: [
                  { email: guestEmail, displayName: guestName }
                ]
              };

              if (eventType.location === 'Google Meet') {
                eventPayload.conferenceData = {
                  createRequest: {
                    requestId: require('crypto').randomUUID(),
                    conferenceSolutionKey: {
                      type: 'hangoutsMeet'
                    }
                  }
                };
              }

              const createdEvent = await googleCalendarService.createEvent(
                'primary',
                cal.accessToken,
                cal.refreshToken,
                eventPayload
              );

              if (createdEvent && createdEvent.hangoutLink) {
                hangoutLink = createdEvent.hangoutLink;
              }
            } catch (calErr) {
              console.error('Google Calendar create event error:', calErr);
            }
          }
        }
      }
    } catch (dbErr) {
      console.error('Failed to lookup calendar connections for event creation:', dbErr);
    }

    if (hangoutLink) {
      const { data: updatedBooking } = await supabase
        .from('bookings')
        .update({ location: hangoutLink, updatedAt: new Date().toISOString() })
        .eq('id', booking.id)
        .select()
        .single();
      if (updatedBooking) {
        booking.location = hangoutLink;
      }
    }

    try {
      await sendBookingNotification({
        userId: hostId,
        bookingId: booking.id,
        channel: 'confirmation'
      });
    } catch (mailError) {
      console.error('Booking confirmation email error:', mailError);
    }

    // Emit real-time update to host
    if (req.io) {
      req.io.to(`user_${hostId}`).emit('booking_created', booking);
    }

    // Trigger webhook notification
    triggerWebhooks(hostId, 'booking.created', booking);

    // Trigger audit log
    logAudit({ userId: hostId, action: 'booking.create', entityType: 'bookings', entityId: booking.id, req });

    res.status(201).json({ booking, requiresPayment: false });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: booking, error: findError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (findError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    try {
      await sendBookingNotification({
        userId: req.user.id,
        bookingId: booking.id,
        channel: 'cancellation'
      });
    } catch (mailError) {
      console.error('Booking cancellation email error:', mailError);
    }

    // Trigger webhook notification
    triggerWebhooks(req.user.id, 'booking.cancelled', updated);

    // Trigger audit log
    logAudit({ userId: req.user.id, action: 'booking.cancel', entityType: 'bookings', entityId: id, req });

    res.json({ booking: updated });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.rescheduleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStartTime, newEndTime } = req.body;

    const { data: booking, error: findError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (findError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        startTime: new Date(newStartTime).toISOString(),
        endTime: new Date(newEndTime).toISOString(),
        status: 'rescheduled',
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    try {
      await sendBookingNotification({
        userId: req.user.id,
        bookingId: booking.id,
        channel: 'reschedule'
      });
    } catch (mailError) {
      console.error('Booking reschedule email error:', mailError);
    }

    // Trigger webhook notification
    triggerWebhooks(req.user.id, 'booking.rescheduled', updated);

    // Trigger audit log
    logAudit({ userId: req.user.id, action: 'booking.reschedule', entityType: 'bookings', entityId: id, req });

    res.json({ booking: updated });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.confirmPaidBooking = async (bookingId, req) => {
  try {
    const { data: booking, error: findError } = await supabase
      .from('bookings')
      .select('*, eventType:event_types(*)')
      .eq('id', bookingId)
      .maybeSingle();

    if (findError || !booking) {
      console.error('Confirm paid booking failed: Booking not found', bookingId);
      return null;
    }

    const hostId = booking.userId;
    const eventType = booking.eventType;

    let hangoutLink = null;
    try {
      const { data: connectedCals } = await supabase
        .from('calendars')
        .select('*')
        .eq('userId', hostId);

      if (connectedCals && connectedCals.length > 0) {
        const googleCalendarService = require('../services/googleCalendarService');
        for (const cal of connectedCals) {
          if (cal.provider === 'google' && cal.accessToken) {
            try {
              const eventPayload = {
                summary: `${eventType.title} with ${booking.guestName}`,
                description: booking.guestNotes || `Scheduled via Callendly. Guest Email: ${booking.guestEmail}`,
                start: { dateTime: booking.startTime },
                end: { dateTime: booking.endTime },
                attendees: [
                  { email: booking.guestEmail, displayName: booking.guestName }
                ]
              };

              if (eventType.location === 'Google Meet') {
                eventPayload.conferenceData = {
                  createRequest: {
                    requestId: require('crypto').randomUUID(),
                    conferenceSolutionKey: {
                      type: 'hangoutsMeet'
                    }
                  }
                };
              }

              const createdEvent = await googleCalendarService.createEvent(
                'primary',
                cal.accessToken,
                cal.refreshToken,
                eventPayload
              );

              if (createdEvent && createdEvent.hangoutLink) {
                hangoutLink = createdEvent.hangoutLink;
              }
            } catch (calErr) {
              console.error('Google Calendar confirm event error:', calErr);
            }
          }
        }
      }
    } catch (dbErr) {
      console.error('Failed to lookup calendar connections during confirm paid booking:', dbErr);
    }

    if (hangoutLink) {
      const { data: updatedBooking } = await supabase
        .from('bookings')
        .update({ location: hangoutLink, updatedAt: new Date().toISOString() })
        .eq('id', booking.id)
        .select()
        .single();
      if (updatedBooking) {
        booking.location = hangoutLink;
      }
    }

    try {
      await sendBookingNotification({
        userId: hostId,
        bookingId: booking.id,
        channel: 'confirmation'
      });
    } catch (mailError) {
      console.error('Paid booking confirmation email error:', mailError);
    }

    // Emit real-time update
    if (req && req.io) {
      req.io.to(`user_${hostId}`).emit('booking_created', booking);
    }

    // Trigger webhook notification
    triggerWebhooks(hostId, 'booking.created', booking);

    // Trigger audit log
    logAudit({ userId: hostId, action: 'booking.create', entityType: 'bookings', entityId: booking.id, req });

    return booking;
  } catch (err) {
    console.error('Error confirming paid booking:', err);
    return null;
  }
};
