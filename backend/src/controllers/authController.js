const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const supabase = require('../config/database');
const { generateToken } = require('../utils/jwt');

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: user, error: createError } = await supabase
      .from('users')
      .insert({
        id: require('crypto').randomUUID(),
        email,
        password: hashedPassword,
        name,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) throw createError;

    // Create profile
    const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
    const { data: profile } = await supabase
      .from('user_profiles')
      .insert({
        id: require('crypto').randomUUID(),
        userId: user.id,
        username,
        timezone: 'UTC',
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    user.profile = profile;

    // Create default event types
    await supabase
      .from('event_types')
      .insert([
        { id: require('crypto').randomUUID(), userId: user.id, title: '15 Min Meeting', slug: '15min', duration: 15, location: 'Google Meet', color: '#3b82f6', updatedAt: new Date().toISOString() },
        { id: require('crypto').randomUUID(), userId: user.id, title: '30 Min Meeting', slug: '30min', duration: 30, location: 'Zoom', color: '#10b981', updatedAt: new Date().toISOString() },
        { id: require('crypto').randomUUID(), userId: user.id, title: '60 Min Meeting', slug: '60min', duration: 60, location: 'In-person', color: '#f59e0b', updatedAt: new Date().toISOString() }
      ]);

    // Create default availability rules
    await supabase
      .from('availability_rules')
      .insert([
        { id: require('crypto').randomUUID(), userId: user.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
        { id: require('crypto').randomUUID(), userId: user.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
        { id: require('crypto').randomUUID(), userId: user.id, dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
        { id: require('crypto').randomUUID(), userId: user.id, dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
        { id: require('crypto').randomUUID(), userId: user.id, dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() }
      ]);

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*, user_profiles(*)')
      .eq('email', email)
      .maybeSingle();

    if (error || !user || !user.password) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.user_profiles && user.user_profiles.length > 0) {
      user.profile = user.user_profiles[0];
    } else {
      user.profile = null;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*, user_profiles(*), calendars(*), event_types(*)')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.profile = user.user_profiles?.[0] || null;
    user.eventTypes = user.event_types || [];
    delete user.user_profiles;
    delete user.event_types;

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
