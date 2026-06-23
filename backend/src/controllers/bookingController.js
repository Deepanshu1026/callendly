const supabase = require('../config/database');

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
      new Date(b.startTime) <= parsedEndTime &&
      new Date(b.endTime) >= parsedStartTime
    );

    if (conflictingBookings.length > 0) {
      return res.status(409).json({ error: 'This time slot is no longer available. Please select another time.' });
    }

    // Check minimum notice
    if (eventType.minimumNotice > 0) {
      const noticeHours = (parsedStartTime - new Date()) / 36e5;
      if (noticeHours < eventType.minimumNotice) {
        return res.status(400).json({ error: `Booking must be made at least ${eventType.minimumNotice} hours in advance` });
      }
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

    // Create notification
    await supabase
      .from('notifications')
      .insert({
        id: require('crypto').randomUUID(),
        userId: hostId,
        bookingId: booking.id,
        type: 'email',
        channel: 'confirmation',
        status: 'pending',
        updatedAt: new Date().toISOString()
      });

    // Emit real-time update to host
    if (req.io) {
      req.io.to(`user_${hostId}`).emit('booking_created', booking);
    }

    booking.eventType = eventType;

    res.status(201).json({ booking });
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

    await supabase
      .from('notifications')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        bookingId: booking.id,
        type: 'email',
        channel: 'cancellation',
        status: 'pending',
        updatedAt: new Date().toISOString()
      });

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

    await supabase
      .from('notifications')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        bookingId: booking.id,
        type: 'email',
        channel: 'reschedule',
        status: 'pending',
        updatedAt: new Date().toISOString()
      });

    res.json({ booking: updated });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
