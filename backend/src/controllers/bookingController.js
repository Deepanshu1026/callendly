const supabase = require('../config/database');
const { triggerWebhooks } = require('../utils/webhooks');
const { logAudit } = require('../utils/audit');
const { sendBookingNotification, sendEmail } = require('../services/notificationService');
const { generateICS } = require('../utils/icsGenerator');
const { generateToken } = require('../utils/jwt');

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

    // Check maximum bookings per day
    if (eventType.maximumBookingsPerDay > 0) {
      const dayStart = new Date(parsedStartTime);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCHours(23, 59, 59, 999);
      const dayBookings = (user.bookings || []).filter(b =>
        b.eventTypeId === eventType.id &&
        b.status !== 'cancelled' &&
        new Date(b.startTime) >= dayStart &&
        new Date(b.startTime) <= dayEnd
      );
      if (dayBookings.length >= eventType.maximumBookingsPerDay) {
        return res.status(400).json({ error: `Maximum bookings for this event type reached for this date` });
      }
    }

    // Parse payment config from description
    const { requiresPayment, price, currency } = parsePaymentConfig(eventType.description);
    let initialStatus = 'confirmed';
    if (requiresPayment) {
      initialStatus = 'pending';
    } else if (eventType.requiresConfirmation) {
      initialStatus = 'pending';
    }

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

    // If it requires confirmation, return early - host must approve
    if (eventType.requiresConfirmation && !requiresPayment) {
      try {
        await sendBookingNotification({
          userId: hostId,
          bookingId: booking.id,
          channel: 'pending'
        });
      } catch (mailError) {
        console.error('Booking pending confirmation email error:', mailError);
      }

      if (req.io) {
        req.io.to(`user_${hostId}`).emit('booking_pending', booking);
      }

      triggerWebhooks(hostId, 'booking.pending', booking);
      logAudit({ userId: hostId, action: 'booking.create_pending', entityType: 'bookings', entityId: booking.id, req });

      return res.status(201).json({ booking, requiresConfirmation: true });
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

exports.approveBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, eventType:event_types(*)')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending bookings can be approved' });
    }

    let hangoutLink = null;
    try {
      const { data: connectedCals } = await supabase
        .from('calendars')
        .select('*')
        .eq('userId', req.user.id);

      if (connectedCals && connectedCals.length > 0) {
        const googleCalendarService = require('../services/googleCalendarService');
        for (const cal of connectedCals) {
          if (cal.provider === 'google' && cal.accessToken) {
            try {
              const eventPayload = {
                summary: `${booking.eventType.title} with ${booking.guestName}`,
                description: booking.guestNotes || `Scheduled via Callendly. Guest Email: ${booking.guestEmail}`,
                start: { dateTime: booking.startTime },
                end: { dateTime: booking.endTime },
                attendees: [{ email: booking.guestEmail, displayName: booking.guestName }]
              };

              if (booking.eventType.location === 'Google Meet') {
                eventPayload.conferenceData = {
                  createRequest: {
                    requestId: require('crypto').randomUUID(),
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                  }
                };
              }

              const createdEvent = await googleCalendarService.createEvent('primary', cal.accessToken, cal.refreshToken, eventPayload);
              if (createdEvent && createdEvent.hangoutLink) {
                hangoutLink = createdEvent.hangoutLink;
              }
            } catch (calErr) {
              console.error('Google Calendar approve event error:', calErr);
            }
          }
        }
      }
    } catch (dbErr) {
      console.error('Failed to lookup calendars during approval:', dbErr);
    }

    const updateData = { status: 'confirmed', updatedAt: new Date().toISOString() };
    if (hangoutLink) updateData.location = hangoutLink;

    const { data: updated, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    try {
      await sendBookingNotification({ userId: req.user.id, bookingId: booking.id, channel: 'confirmation' });
    } catch (mailError) {
      console.error('Booking approval email error:', mailError);
    }

    if (req.io) {
      req.io.to(`user_${req.user.id}`).emit('booking_updated', updated);
    }

    triggerWebhooks(req.user.id, 'booking.approved', updated);
    logAudit({ userId: req.user.id, action: 'booking.approve', entityType: 'bookings', entityId: id, req });

    res.json({ booking: updated });
  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.declineBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending bookings can be declined' });
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason || 'Declined by host',
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    try {
      await sendBookingNotification({ userId: req.user.id, bookingId: booking.id, channel: 'cancellation' });
    } catch (mailError) {
      console.error('Booking decline email error:', mailError);
    }

    if (req.io) {
      req.io.to(`user_${req.user.id}`).emit('booking_updated', updated);
    }

    triggerWebhooks(req.user.id, 'booking.declined', updated);
    logAudit({ userId: req.user.id, action: 'booking.decline', entityType: 'bookings', entityId: id, req });

    res.json({ booking: updated });
  } catch (error) {
    console.error('Decline booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.guestCancelBooking = async (req, res) => {
  try {
    const { token } = req.params;

    const decoded = require('../utils/jwt').verifyToken(token);
    if (!decoded || decoded.purpose !== 'guest_cancel' || !decoded.bookingId) {
      return res.status(400).json({ error: 'Invalid or expired link' });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', decoded.bookingId)
      .maybeSingle();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Booking cannot be cancelled' });
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Cancelled by guest',
        updatedAt: new Date().toISOString()
      })
      .eq('id', decoded.bookingId)
      .select()
      .single();

    if (error) throw error;

    try {
      await sendBookingNotification({ userId: booking.userId, bookingId: booking.id, channel: 'cancellation' });
    } catch (mailError) {
      console.error('Guest cancellation email error:', mailError);
    }

    res.json({ booking: updated, message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Guest cancel booking error:', error);
    res.status(400).json({ error: 'Invalid or expired cancellation link' });
  }
};

exports.guestRescheduleBooking = async (req, res) => {
  try {
    const { token } = req.params;
    const { newStartTime, newEndTime } = req.body;

    const decoded = require('../utils/jwt').verifyToken(token);
    if (!decoded || decoded.purpose !== 'guest_reschedule' || !decoded.bookingId) {
      return res.status(400).json({ error: 'Invalid or expired link' });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', decoded.bookingId)
      .maybeSingle();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Booking cannot be rescheduled' });
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({
        startTime: new Date(newStartTime).toISOString(),
        endTime: new Date(newEndTime).toISOString(),
        status: 'rescheduled',
        updatedAt: new Date().toISOString()
      })
      .eq('id', decoded.bookingId)
      .select()
      .single();

    if (error) throw error;

    try {
      await sendBookingNotification({ userId: booking.userId, bookingId: booking.id, channel: 'reschedule' });
    } catch (mailError) {
      console.error('Guest reschedule email error:', mailError);
    }

    res.json({ booking: updated, message: 'Booking rescheduled successfully' });
  } catch (error) {
    console.error('Guest reschedule booking error:', error);
    res.status(400).json({ error: 'Invalid or expired reschedule link' });
  }
};

exports.downloadICS = async (req, res) => {
  try {
    const { id } = req.params;

    let booking;
    if (req.user) {
      const { data } = await supabase
        .from('bookings')
        .select('*, eventType:event_types(*)')
        .eq('id', id)
        .eq('userId', req.user.id)
        .maybeSingle();
      booking = data;
    } else {
      const { data } = await supabase
        .from('bookings')
        .select('*, eventType:event_types(*)')
        .eq('id', id)
        .maybeSingle();
      booking = data;
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data: host } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', booking.userId)
      .maybeSingle();

    const icsContent = generateICS({
      title: booking.eventType?.title || 'Meeting',
      description: booking.guestNotes || '',
      startTime: booking.startTime,
      endTime: booking.endTime,
      location: booking.location,
      organizerName: host?.name || '',
      organizerEmail: host?.email || '',
      attendeeName: booking.guestName,
      attendeeEmail: booking.guestEmail,
      timezone: booking.timezone,
      uid: booking.id
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="callendly-booking-${booking.id}.ics"`);
    res.send(icsContent);
  } catch (error) {
    console.error('Download ICS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.markNoShow = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({ status: 'no-show', updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logAudit({ userId: req.user.id, action: 'booking.no_show', entityType: 'bookings', entityId: id, req });

    res.json({ booking: updated });
  } catch (error) {
    console.error('Mark no-show error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
