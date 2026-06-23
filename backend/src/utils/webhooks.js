const crypto = require('crypto');
const supabase = require('../config/database');

async function triggerWebhooks(userId, event, payload) {
  try {
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('userId', userId)
      .eq('isActive', true);

    if (error || !webhooks || webhooks.length === 0) return;

    const body = JSON.stringify({ event, payload, timestamp: Date.now() });

    for (const hook of webhooks) {
      const eventsList = hook.events.split(',');
      if (eventsList.includes(event) || hook.events === '*') {
        const signature = crypto
          .createHmac('sha256', hook.secret)
          .update(body)
          .digest('hex');

        fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-callendly-signature': signature
          },
          body
        }).catch(err => {
          console.error(`Failed to send webhook to ${hook.url}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('Trigger webhooks error:', err);
  }
}

module.exports = { triggerWebhooks };
