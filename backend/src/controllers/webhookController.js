const supabase = require('../config/database');

exports.getWebhooks = async (req, res) => {
  try {
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ webhooks: webhooks || [] });
  } catch (error) {
    console.error('Get webhooks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createWebhook = async (req, res) => {
  try {
    const { url, events, secret } = req.body;

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        id: require('crypto').randomUUID(),
        userId: req.user.id,
        url,
        events: events || 'booking.created,booking.cancelled',
        secret: secret || require('crypto').randomBytes(16).toString('hex'),
        isActive: true,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ webhook });
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('userId', req.user.id);

    if (error) throw error;
    res.json({ message: 'Webhook deleted' });
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
