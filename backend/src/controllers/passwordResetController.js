const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../config/database');
const { sendEmail } = require('../services/notificationService');
const { logAudit } = require('../utils/audit');

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*, user_profiles(*)')
      .eq('email', email)
      .maybeSingle();

    if (!user || !user.password) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('userId', user.id);

    await supabase
      .from('password_reset_tokens')
      .insert({
        id: crypto.randomUUID(),
        userId: user.id,
        token,
        expiresAt,
        used: false,
        createdAt: new Date().toISOString()
      });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await sendEmail({
        to: email,
        subject: 'Reset your Callendly password',
        html: `<p>Hi ${user.name || 'there'},</p><p>You requested a password reset.</p><p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Reset Password</a></p><p>Or copy this link: ${resetUrl}</p><p>This link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>`,
        text: `Hi ${user.name || 'there'}, reset your password: ${resetUrl}. This link expires in 1 hour.`
      });
    } catch (emailErr) {
      console.error('Password reset email error:', emailErr);
    }

    logAudit({ userId: user.id, action: 'user.password_reset_request', entityType: 'users', entityId: user.id, req });

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password || password.length < 6) {
      return res.status(400).json({ error: 'Token and a password (min 6 chars) are required' });
    }

    const { data: resetToken } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle();

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (new Date(resetToken.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword, updatedAt: new Date().toISOString() })
      .eq('id', resetToken.userId);

    if (updateError) throw updateError;

    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetToken.id);

    logAudit({ userId: resetToken.userId, action: 'user.password_reset', entityType: 'users', entityId: resetToken.userId, req });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
