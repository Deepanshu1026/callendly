const supabase = require('../config/database');

exports.getCalendars = async (req, res) => {
  try {
    const { data: calendars, error } = await supabase
      .from('calendars')
      .select('*')
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ calendars: calendars || [] });
  } catch (error) {
    console.error('Get calendars error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.connectCalendar = async (req, res) => {
  try {
    const { provider, name, externalId, accessToken, refreshToken, expiresAt } = req.body;

    const { data: calendar, error } = await supabase
      .from('calendars')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        provider,
        name,
        externalId: externalId || `manual-${Date.now()}`,
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isPrimary: false,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ calendar });
  } catch (error) {
    console.error('Connect calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.disconnectCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('calendars')
      .delete()
      .eq('id', id)
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ message: 'Calendar disconnected' });
  } catch (error) {
    console.error('Disconnect calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
