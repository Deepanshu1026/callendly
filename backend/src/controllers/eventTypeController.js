const supabase = require('../config/database');
const { logAudit } = require('../utils/audit');

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

const serializePaymentConfig = (cleanDesc, requiresPayment, price, currency) => {
  const marker = '\n\n---PAYMENT_METADATA---\n';
  if (!requiresPayment) return cleanDesc || '';
  const meta = { requiresPayment: true, price: parseFloat(price) || 0, currency: currency || 'INR' };
  return `${cleanDesc || ''}${marker}${JSON.stringify(meta)}`;
};


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

        const { cleanDescription, requiresPayment, price, currency } = parsePaymentConfig(et.description);
        et.description = cleanDescription;
        et.requiresPayment = requiresPayment;
        et.price = price;
        et.currency = currency;
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
    const { title, slug, description, duration, location, color, bufferBefore, bufferAfter, minimumNotice, requiresPayment, price, currency } = req.body;

    const { data: existing } = await supabase
      .from('event_types')
      .select('*')
      .eq('userId', req.user.id)
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Event type with this slug already exists' });
    }

    const serializedDescription = serializePaymentConfig(description, requiresPayment, price, currency);

    const { data: eventType, error } = await supabase
      .from('event_types')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        title,
        slug,
        description: serializedDescription,
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

    logAudit({ userId: req.user.id, action: 'event_type.create', entityType: 'event_types', entityId: eventType.id, req });

    res.status(201).json({ eventType });
  } catch (error) {
    console.error('Create event type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateEventType = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, duration, location, color, isActive, bufferBefore, bufferAfter, minimumNotice, requiresPayment, price, currency } = req.body;

    let finalDescription = undefined;
    if (description !== undefined || requiresPayment !== undefined || price !== undefined || currency !== undefined) {
      const { data: existing } = await supabase
        .from('event_types')
        .select('description')
        .eq('id', id)
        .eq('userId', req.user.id)
        .maybeSingle();

      const currentMeta = parsePaymentConfig(existing ? existing.description : '');
      const newCleanDesc = description !== undefined ? description : currentMeta.cleanDescription;
      const newReqPayment = requiresPayment !== undefined ? requiresPayment : currentMeta.requiresPayment;
      const newPrice = price !== undefined ? price : currentMeta.price;
      const newCurrency = currency !== undefined ? currency : currentMeta.currency;

      finalDescription = serializePaymentConfig(newCleanDesc, newReqPayment, newPrice, newCurrency);
    }

    const updateData = {
      updatedAt: new Date().toISOString()
    };
    if (title !== undefined) updateData.title = title;
    if (finalDescription !== undefined) updateData.description = finalDescription;
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

    const updatedEventType = updatedList && updatedList.length > 0 ? updatedList[0] : null;
    if (updatedEventType) {
      const { cleanDescription, requiresPayment: rp, price: pr, currency: cr } = parsePaymentConfig(updatedEventType.description);
      updatedEventType.description = cleanDescription;
      updatedEventType.requiresPayment = rp;
      updatedEventType.price = pr;
      updatedEventType.currency = cr;
    }

    logAudit({ userId: req.user.id, action: 'event_type.update', entityType: 'event_types', entityId: id, req });

    res.json({ eventType: updatedEventType });
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
    logAudit({ userId: req.user.id, action: 'event_type.delete', entityType: 'event_types', entityId: id, req });

    res.json({ message: 'Event type deleted' });
  } catch (error) {
    console.error('Delete event type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.duplicateEventType = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase
      .from('event_types')
      .select('*, booking_questions(*)')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const newSlug = existing.slug + '-copy';
    const { data: slugCheck } = await supabase
      .from('event_types')
      .select('id')
      .eq('userId', req.user.id)
      .eq('slug', newSlug)
      .maybeSingle();

    const finalSlug = slugCheck ? `${existing.slug}-copy-${Date.now()}` : newSlug;

    const { data: newEventType, error: createError } = await supabase
      .from('event_types')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        title: existing.title + ' (Copy)',
        slug: finalSlug,
        description: existing.description,
        duration: existing.duration,
        location: existing.location,
        color: existing.color,
        isActive: false,
        bufferBefore: existing.bufferBefore,
        bufferAfter: existing.bufferAfter,
        minimumNotice: existing.minimumNotice,
        maximumBookingsPerDay: existing.maximumBookingsPerDay,
        requiresConfirmation: existing.requiresConfirmation,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) throw createError;

    if (existing.booking_questions && existing.booking_questions.length > 0) {
      const questionsData = existing.booking_questions.map(q => ({
        id: require('crypto').randomUUID(),
        eventTypeId: newEventType.id,
        label: q.label,
        type: q.type,
        required: q.required,
        options: q.options,
        order: q.order,
        updatedAt: new Date().toISOString()
      }));
      await supabase.from('booking_questions').insert(questionsData);
    }

    logAudit({ userId: req.user.id, action: 'event_type.duplicate', entityType: 'event_types', entityId: newEventType.id, req });

    const { cleanDescription, requiresPayment, price, currency } = parsePaymentConfig(newEventType.description);
    newEventType.description = cleanDescription;
    newEventType.requiresPayment = requiresPayment;
    newEventType.price = price;
    newEventType.currency = currency;

    res.status(201).json({ eventType: newEventType });
  } catch (error) {
    console.error('Duplicate event type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.toggleEventType = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('event_types')
      .select('isActive')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const { data: updated, error } = await supabase
      .from('event_types')
      .update({ isActive: !existing.isActive, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .eq('userId', req.user.id)
      .select();

    if (error) throw error;

    const updatedEventType = updated && updated.length > 0 ? updated[0] : null;
    if (updatedEventType) {
      const { cleanDescription, requiresPayment, price, currency } = parsePaymentConfig(updatedEventType.description);
      updatedEventType.description = cleanDescription;
      updatedEventType.requiresPayment = requiresPayment;
      updatedEventType.price = price;
      updatedEventType.currency = currency;
    }

    logAudit({ userId: req.user.id, action: 'event_type.toggle', entityType: 'event_types', entityId: id, req });

    res.json({ eventType: updatedEventType });
  } catch (error) {
    console.error('Toggle event type error:', error);
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

    const { cleanDescription, requiresPayment, price, currency } = parsePaymentConfig(eventType.description);
    eventType.description = cleanDescription;
    eventType.requiresPayment = requiresPayment;
    eventType.price = price;
    eventType.currency = currency;

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

exports.createQuestion = async (req, res) => {
  try {
    const { eventTypeId } = req.params;
    const { label, type, required, options, order } = req.body;

    const { data: question, error } = await supabase
      .from('booking_questions')
      .insert({
        id: require('crypto').randomUUID(),
        eventTypeId,
        label,
        type: type || 'text',
        required: required || false,
        options: options || '',
        order: order || 0,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ question });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { label, type, required, options, order } = req.body;

    const { data: question, error } = await supabase
      .from('booking_questions')
      .update({
        label,
        type,
        required,
        options,
        order,
        updatedAt: new Date().toISOString()
      })
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw error;
    res.json({ question });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const { error } = await supabase
      .from('booking_questions')
      .delete()
      .eq('id', questionId);

    if (error) throw error;
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

