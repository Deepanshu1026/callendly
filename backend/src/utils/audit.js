const supabase = require('../config/database');

async function logAudit({ userId, action, entityType, entityId, metadata, req }) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    const userAgent = req ? req.headers['user-agent'] : null;

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        id: require('crypto').randomUUID(),
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata || {},
        ipAddress: typeof ipAddress === 'string' ? ipAddress : JSON.stringify(ipAddress),
        userAgent
      });

    if (error) {
      console.error('Failed to save audit log:', error);
    }
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

module.exports = { logAudit };
