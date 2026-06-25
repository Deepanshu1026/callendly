const supabase = require('../config/database');

const { Resend } = require('resend');
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    console.log(`[Email mock] To: ${to}, Subject: ${subject}`);
    return { id: 'mock-id' };
  }
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'notifications@newsadda.blog',
      to,
      subject,
      html,
      text
    });
    return result;
  } catch (error) {
    console.error('Resend email error:', error);
    throw error;
  }
}

async function processPendingNotifications() {
  const { data: pending, error } = await supabase
    .from('notifications')
    .select('*, booking:bookings(*, eventType:event_types(*), user:users(*, user_profiles(*)))')
    .eq('status', 'pending')
    .limit(50);

  if (error || !pending) return;

  for (const notif of pending) {
    try {
      if (!notif.booking) continue;
      const booking = notif.booking;
      const host = booking.user;
      if (!host) continue;

      if (host.user_profiles && host.user_profiles.length > 0) {
        host.profile = host.user_profiles[0];
      } else {
        host.profile = null;
      }

      const guestEmail = booking.guestEmail;
      const hostEmail = host.email;

      let subject = '';
      let html = '';

      if (notif.channel === 'confirmation') {
        subject = `Booking Confirmed: ${booking.eventType.title}`;
        html = `<p>Hi ${booking.guestName},</p><p>Your booking with ${host.name || host.email} for ${booking.eventType.title} is confirmed.</p><p>Date: ${new Date(booking.startTime).toLocaleString()}</p>`;
      } else if (notif.channel === 'cancellation') {
        subject = `Booking Cancelled: ${booking.eventType.title}`;
        html = `<p>Hi ${booking.guestName},</p><p>Your booking for ${booking.eventType.title} has been cancelled.</p>`;
      } else if (notif.channel === 'reschedule') {
        subject = `Booking Rescheduled: ${booking.eventType.title}`;
        html = `<p>Hi ${booking.guestName},</p><p>Your booking for ${booking.eventType.title} has been rescheduled to ${new Date(booking.startTime).toLocaleString()}.</p>`;
      }

      await sendEmail({ to: guestEmail, subject, html });
      if (hostEmail && hostEmail !== guestEmail) {
        await sendEmail({ to: hostEmail, subject, html });
      }

      await supabase
        .from('notifications')
        .update({ status: 'sent', sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .eq('id', notif.id);
    } catch (error) {
      console.error('Notification processing error:', error);
      await supabase
        .from('notifications')
        .update({ status: 'failed', updatedAt: new Date().toISOString() })
        .eq('id', notif.id);
    }
  }
}

module.exports = { sendEmail, processPendingNotifications };
