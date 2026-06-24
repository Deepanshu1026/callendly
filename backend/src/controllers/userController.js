const supabase = require('../config/database');

exports.getProfile = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('userId', req.user.id)
      .maybeSingle();

    if (error) throw error;
    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, username, bio, timezone, language, publicBookingPage } = req.body;

    // Update user name
    if (name) {
      await supabase
        .from('users')
        .update({ name, updatedAt: new Date().toISOString() })
        .eq('id', req.user.id);
    }

    // Check username uniqueness if changing
    if (username) {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('username', username)
        .neq('userId', req.user.id)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // Find profile ID first to ensure we keep the same profile ID or generate a new one
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('userId', req.user.id)
      .maybeSingle();

    const profileId = existingProfile?.id || require('crypto').randomUUID();

    const { data: profile, error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        id: profileId,
        userId: req.user.id,
        username,
        bio,
        timezone: timezone || 'UTC',
        language: language || 'en',
        publicBookingPage: publicBookingPage ?? true,
        updatedAt: new Date().toISOString()
      }, { onConflict: 'userId' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    res.json({ profile });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*, user:users(*, event_types(*), availability_rules(*))')
      .eq('username', username)
      .maybeSingle();

    if (error || !profile || !profile.publicBookingPage) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Reshape object to match expected Prisma output
    if (profile.user) {
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

      const activeEventTypes = (profile.user.event_types || [])
        .filter(et => et.isActive)
        .map(et => {
          const { cleanDescription, requiresPayment, price, currency } = parsePaymentConfig(et.description);
          return {
            id: et.id,
            title: et.title,
            slug: et.slug,
            description: cleanDescription,
            duration: et.duration,
            location: et.location,
            color: et.color,
            requiresPayment,
            price,
            currency
          };
        });

      profile.user = {
        id: profile.user.id,
        name: profile.user.name,
        email: profile.user.email,
        avatar: profile.user.avatar,
        eventTypes: activeEventTypes,
        integrations: profile.user.integrations || [],
        availabilityRules: (profile.user.availability_rules || []).filter(r => r.isActive && r.eventTypeId === null)
      };
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
