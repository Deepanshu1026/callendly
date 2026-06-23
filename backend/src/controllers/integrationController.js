const supabase = require('../config/database');

exports.getIntegrations = async (req, res) => {
  try {
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ integrations: integrations || [] });
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.saveIntegration = async (req, res) => {
  try {
    const { type, config, isActive } = req.body;

    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('userId', req.user.id)
      .eq('type', type)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('integrations')
        .update({
          config,
          isActive: isActive ?? true,
          updatedAt: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('integrations')
        .insert({
          id: require('crypto').randomUUID(),
          userId: req.user.id,
          type,
          config,
          isActive: isActive ?? true,
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json({ integration: result });
  } catch (error) {
    console.error('Save integration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', id)
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ message: 'Integration deleted' });
  } catch (error) {
    console.error('Delete integration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
