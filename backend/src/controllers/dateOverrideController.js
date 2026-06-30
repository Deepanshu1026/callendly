const supabase = require('../config/database');

exports.getDateOverrides = async (req, res) => {
  try {
    const { data: overrides, error } = await supabase
      .from('date_overrides')
      .select('*')
      .eq('userId', req.user.id)
      .order('date', { ascending: true });

    if (error) throw error;
    res.json({ overrides: overrides || [] });
  } catch (error) {
    console.error('Get date overrides error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createDateOverride = async (req, res) => {
  try {
    const { date, startTime, endTime, isActive } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, startTime, and endTime are required' });
    }

    const { data: existing } = await supabase
      .from('date_overrides')
      .select('*')
      .eq('userId', req.user.id)
      .eq('date', date)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from('date_overrides')
        .update({
          startTime,
          endTime,
          isActive: isActive ?? true,
          updatedAt: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ override: updated });
    }

    const { data: override, error } = await supabase
      .from('date_overrides')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        date,
        startTime,
        endTime,
        isActive: isActive ?? true,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ override });
  } catch (error) {
    console.error('Create date override error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteDateOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('date_overrides')
      .delete()
      .eq('id', id)
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ message: 'Date override deleted' });
  } catch (error) {
    console.error('Delete date override error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
