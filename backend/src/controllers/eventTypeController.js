const supabase = require('../config/database');

exports.getEventTypes = async (req, res) => {
  try {
    const { data: eventTypes, error } = await supabase
      .from('event_types')
      .select('*, booking_questions(*)')
      .eq('userId', req.user.id)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    if (eventTypes) {
      eventTypes.forEach(et => {
        et.questions = (et.booking_questions || []).sort((a, b) => a.order - b.order);
        delete et.booking_questions;
      });
    }

    res.json({ eventTypes: eventTypes || [] });
  } catch (error) {
    console.error('Get event types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createEventType = async (req, res) => {
  try {
    const { title, slug, description, duration, location, color, bufferBefore, bufferAfter, minimumNotice } = req.body;

    const { data: existing } = await supabase
      .from('event_types')
      .select('*')
      .eq('userId', req.user.id)
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Event type with this slug already exists' });
    }

    const { data: eventType, error } = await supabase
      .from('event_types')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        title,
        slug,
        description,
        duration: parseInt(duration),
        location,
        color,
        bufferBefore: bufferBefore || 0,
        bufferAfter: bufferAfter || 0,
        minimumNotice: minimumNotice || 0,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ eventType });
  } catch (error) {
    console.error('Create event type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateEventType = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, duration, location, color, isActive, bufferBefore, bufferAfter, minimumNotice } = req.body;

    const updateData = {
      updatedAt: new Date().toISOString()
    };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (duration !== undefined) updateData.duration = duration ? parseInt(duration) : undefined;
    if (location !== undefined) updateData.location = location;
    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (bufferBefore !== undefined) updateData.bufferBefore = bufferBefore;
    if (bufferAfter !== undefined) updateData.bufferAfter = bufferAfter;
    if (minimumNotice !== undefined) updateData.minimumNotice = minimumNotice;

    const { data: updatedList, error } = await supabase
      .from('event_types')
      .update(updateData)
      .eq('id', id)
      .eq('userId', req.user.id)
      .select();

    if (error) throw error;

    res.json({ eventType: updatedList && updatedList.length > 0 ? updatedList[0] : null });
  } catch (error) {
    console.error('Update event type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteEventType = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('event_types')
      .delete()
      .eq('id', id)
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ message: 'Event type deleted' });
  } catch (error) {
    console.error('Delete event type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getPublicEventType = async (req, res) => {
  try {
    const { username, slug } = req.params;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*, user:users(*, event_types(*, booking_questions(*)))')
      .eq('username', username)
      .maybeSingle();

    if (error || !profile || !profile.publicBookingPage || !profile.user) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const matchedEventTypes = (profile.user.event_types || []).filter(et => et.slug === slug && et.isActive);
    if (matchedEventTypes.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const eventType = matchedEventTypes[0];
    eventType.questions = (eventType.booking_questions || []).sort((a, b) => a.order - b.order);
    delete eventType.booking_questions;

    const host = {
      id: profile.user.id,
      name: profile.user.name
    };

    res.json({ eventType, host });
  } catch (error) {
    console.error('Get public event type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
