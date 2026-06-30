const supabase = require('../config/database');
const { Resend } = require('resend');

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

function getSenderEmail() {
  return (
    process.env.FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    'onboarding@resend.dev'
  );
}

function getEmailConfigSummary() {
  return {
    configured: Boolean(process.env.RESEND_API_KEY),
    sender: getSenderEmail()
  };
}

function formatDateTime(dateValue, timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone || 'UTC'
    }).format(new Date(dateValue));
  } catch (error) {
    return new Date(dateValue).toLocaleString();
  }
}

async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    console.log(`[Email mock] To: ${to}, Subject: ${subject}`);
    return { id: 'mock-id' };
  }

  try {
    const result = await resend.emails.send({
      from: getSenderEmail(),
      to,
      subject,
      html,
      text
    });

    if (result?.error) {
      throw new Error(result.error.message || 'Resend returned an unknown email error');
    }

    if (result?.data?.id) {
      console.log(`Email sent successfully: ${result.data.id} -> ${to}`);
    }

    return result;
  } catch (error) {
    console.error('Resend email error:', error);
    throw error;
  }
}

function buildBookingEmailContent(channel, booking, host) {
  const hostName = host.name || host.email || 'your host';
  const eventTitle = booking.eventType?.title || 'your meeting';
  const when = formatDateTime(booking.startTime, booking.timezone);
  const locationLine = booking.location ? `<p><strong>Location:</strong> ${booking.location}</p>` : '';
  const cancelReasonLine = booking.cancellationReason ? `<p><strong>Reason:</strong> ${booking.cancellationReason}</p>` : '';
  const { generateToken } = require('../utils/jwt');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  let guestLinks = '';
  let icsLink = '';

  if (channel === 'confirmation' || channel === 'reschedule' || channel === 'reminder') {
    try {
      const guestCancelToken = generateToken({ purpose: 'guest_cancel', bookingId: booking.id });
      const guestRescheduleToken = generateToken({ purpose: 'guest_reschedule', bookingId: booking.id });

      guestLinks = `
        <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Need to make changes?</p>
          <a href="${frontendUrl}/guest/cancel?token=${guestCancelToken}" style="display:inline-block;padding:6px 14px;margin-right:8px;background:#fef2f2;color:#dc2626;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Cancel Booking</a>
          <a href="${frontendUrl}/guest/reschedule?token=${guestRescheduleToken}" style="display:inline-block;padding:6px 14px;background:#eff6ff;color:#2563eb;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Reschedule</a>
        </div>
      `;
    } catch (e) {
      console.error('Failed to generate guest tokens:', e);
    }

    const apiUrl = process.env.API_URL || `${frontendUrl}/api`;
    icsLink = `
      <div style="margin-top:12px;">
        <a href="${apiUrl}/bookings/${booking.id}/ics" style="display:inline-block;padding:6px 14px;background:#f0fdf4;color:#16a34a;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Add to Calendar (.ics)</a>
      </div>
    `;
  }

  if (channel === 'cancellation') {
    return {
      guest: {
        subject: `Booking Cancelled: ${eventTitle}`,
        html: `<p>Hi ${booking.guestName},</p><p>Your booking with ${hostName} for ${eventTitle} has been cancelled.</p>${cancelReasonLine}`,
        text: `Hi ${booking.guestName}, your booking with ${hostName} for ${eventTitle} has been cancelled.`
      },
      host: {
        subject: `Booking Cancelled: ${eventTitle}`,
        html: `<p>Hi ${hostName},</p><p>The booking with ${booking.guestName} for ${eventTitle} has been cancelled.</p>${cancelReasonLine}`,
        text: `Hi ${hostName}, the booking with ${booking.guestName} for ${eventTitle} has been cancelled.`
      }
    };
  }

  if (channel === 'reschedule') {
    return {
      guest: {
        subject: `Booking Rescheduled: ${eventTitle}`,
        html: `<p>Hi ${booking.guestName},</p><p>Your booking with ${hostName} for ${eventTitle} has been rescheduled.</p><p><strong>New time:</strong> ${when}</p>${locationLine}${guestLinks}`,
        text: `Hi ${booking.guestName}, your booking with ${hostName} for ${eventTitle} has been rescheduled to ${when}.`
      },
      host: {
        subject: `Booking Rescheduled: ${eventTitle}`,
        html: `<p>Hi ${hostName},</p><p>The booking with ${booking.guestName} for ${eventTitle} has been rescheduled.</p><p><strong>New time:</strong> ${when}</p>${locationLine}`,
        text: `Hi ${hostName}, the booking with ${booking.guestName} for ${eventTitle} has been rescheduled to ${when}.`
      }
    };
  }

  if (channel === 'reminder') {
    return {
      guest: {
        subject: `Reminder: Upcoming Meeting - ${eventTitle}`,
        html: `<p>Hi ${booking.guestName},</p><p>This is a reminder for your upcoming meeting with ${hostName}.</p><p><strong>When:</strong> ${when}</p>${locationLine}${guestLinks}${icsLink}`,
        text: `Hi ${booking.guestName}, reminder: your meeting with ${hostName} for ${eventTitle} is at ${when}.`
      },
      host: {
        subject: `Reminder: Upcoming Meeting - ${eventTitle}`,
        html: `<p>Hi ${hostName},</p><p>Reminder: you have an upcoming meeting with ${booking.guestName}.</p><p><strong>When:</strong> ${when}</p>${locationLine}`,
        text: `Hi ${hostName}, reminder: your meeting with ${booking.guestName} for ${eventTitle} is at ${when}.`
      }
    };
  }

  if (channel === 'pending') {
    const dashboardUrl = `${frontendUrl}/dashboard`;
    return {
      guest: {
        subject: `Booking Request Sent: ${eventTitle}`,
        html: `<p>Hi ${booking.guestName},</p><p>Your booking request for ${eventTitle} with ${hostName} has been sent.</p><p><strong>Requested time:</strong> ${when}</p><p>We will notify you once it is confirmed.</p>`,
        text: `Hi ${booking.guestName}, your booking request for ${eventTitle} with ${hostName} at ${when} has been sent. We will notify you once confirmed.`
      },
      host: {
        subject: `Action Required: New Booking Request - ${eventTitle}`,
        html: `<p>Hi ${hostName},</p><p>${booking.guestName} requested ${eventTitle} with you.</p><p><strong>Requested time:</strong> ${when}</p><p><strong>Guest email:</strong> ${booking.guestEmail}</p>${locationLine}<div style="margin-top:16px;"><a href="${dashboardUrl}" style="display:inline-block;padding:8px 16px;background:#006bff;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Review in Dashboard</a></div>`,
        text: `Hi ${hostName}, ${booking.guestName} requested ${eventTitle} with you for ${when}. Review in your dashboard: ${dashboardUrl}`
      }
    };
  }

  return {
    guest: {
      subject: `Booking Confirmed: ${eventTitle}`,
      html: `<p>Hi ${booking.guestName},</p><p>Your booking with ${hostName} for ${eventTitle} is confirmed.</p><p><strong>When:</strong> ${when}</p>${locationLine}${guestLinks}${icsLink}`,
      text: `Hi ${booking.guestName}, your booking with ${hostName} for ${eventTitle} is confirmed for ${when}.`
    },
    host: {
      subject: `New Booking: ${eventTitle}`,
      html: `<p>Hi ${hostName},</p><p>${booking.guestName} booked ${eventTitle} with you.</p><p><strong>When:</strong> ${when}</p><p><strong>Guest email:</strong> ${booking.guestEmail}</p>${locationLine}`,
      text: `Hi ${hostName}, ${booking.guestName} booked ${eventTitle} with you for ${when}.`
    }
  };
}

async function getNotificationContext(notification) {
  if (notification.booking && notification.booking.user && notification.booking.eventType) {
    const booking = notification.booking;
    const host = booking.user;
    host.profile = host.user_profiles?.[0] || null;
    return { booking, host };
  }

  if (!notification.bookingId) {
    return null;
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, eventType:event_types(*), user:users(*, user_profiles(*))')
    .eq('id', notification.bookingId)
    .maybeSingle();

  if (error || !booking || !booking.user) {
    return null;
  }

  const host = booking.user;
  host.profile = host.user_profiles?.[0] || null;
  return { booking, host };
}

async function markNotificationStatus(id, status) {
  const update = {
    status,
    updatedAt: new Date().toISOString()
  };

  if (status === 'sent') {
    update.sentAt = new Date().toISOString();
  }

  await supabase
    .from('notifications')
    .update(update)
    .eq('id', id);
}

async function deliverBookingNotification(notification) {
  const context = await getNotificationContext(notification);
  if (!context) {
    throw new Error(`Notification context not found for ${notification.id}`);
  }

  const { booking, host } = context;
  const emailContent = buildBookingEmailContent(notification.channel, booking, host);

  await sendEmail({
    to: booking.guestEmail,
    subject: emailContent.guest.subject,
    html: emailContent.guest.html,
    text: emailContent.guest.text
  });

  if (host.email && host.email !== booking.guestEmail) {
    await sendEmail({
      to: host.email,
      subject: emailContent.host.subject,
      html: emailContent.host.html,
      text: emailContent.host.text
    });
  }
}

async function queueBookingNotification({ userId, bookingId, channel, scheduledAt }) {
  const insertData = {
    id: require('crypto').randomUUID(),
    userId,
    bookingId,
    type: 'email',
    channel,
    status: 'pending',
    updatedAt: new Date().toISOString()
  };

  if (scheduledAt) {
    insertData.scheduledAt = scheduledAt;
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function sendBookingNotification({ userId, bookingId, channel }) {
  const notification = await queueBookingNotification({ userId, bookingId, channel });

  try {
    await deliverBookingNotification(notification);
    await markNotificationStatus(notification.id, 'sent');
  } catch (error) {
    await markNotificationStatus(notification.id, 'failed');
    throw error;
  }

  return notification;
}

async function sendLoginNotification(user) {
  if (!user?.email) {
    return null;
  }

  const timestamp = formatDateTime(new Date().toISOString(), user.profile?.timezone || 'UTC');
  const name = user.name || user.email;

  return sendEmail({
    to: user.email,
    subject: 'New login to your Callendly account',
    html: `<p>Hi ${name},</p><p>We noticed a successful login to your Callendly account.</p><p><strong>Time:</strong> ${timestamp}</p><p>If this was you, no action is needed.</p>`,
    text: `Hi ${name}, we noticed a successful login to your Callendly account at ${timestamp}. If this was you, no action is needed.`
  });
}

async function processPendingNotifications() {
  const { data: pending, error } = await supabase
    .from('notifications')
    .select('*, booking:bookings(*, eventType:event_types(*), user:users(*, user_profiles(*)))')
    .eq('status', 'pending')
    .limit(50);

  if (error || !pending) {
    return;
  }

  for (const notification of pending) {
    try {
      await deliverBookingNotification(notification);
      await markNotificationStatus(notification.id, 'sent');
    } catch (error) {
      console.error('Notification processing error:', error);
      await markNotificationStatus(notification.id, 'failed');
    }
  }
}

async function sendBookingReminders() {
  const now = new Date();
  const reminderWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: upcomingBookings, error } = await supabase
    .from('bookings')
    .select('*, eventType:event_types(*), user:users(*, user_profiles(*))')
    .eq('status', 'confirmed')
    .gte('startTime', now.toISOString())
    .lte('startTime', reminderWindow.toISOString());

  if (error || !upcomingBookings) {
    return;
  }

  for (const booking of upcomingBookings) {
    if (!booking.user) continue;

    const { data: existingReminder } = await supabase
      .from('notifications')
      .select('id')
      .eq('bookingId', booking.id)
      .eq('channel', 'reminder')
      .eq('status', 'sent')
      .maybeSingle();

    if (existingReminder) continue;

    const host = booking.user;
    host.profile = host.user_profiles?.[0] || null;

    try {
      const emailContent = buildBookingEmailContent('reminder', booking, host);

      await sendEmail({
        to: booking.guestEmail,
        subject: emailContent.guest.subject,
        html: emailContent.guest.html,
        text: emailContent.guest.text
      });

      if (host.email && host.email !== booking.guestEmail) {
        await sendEmail({
          to: host.email,
          subject: emailContent.host.subject,
          html: emailContent.host.html,
          text: emailContent.host.text
        });
      }

      await supabase
        .from('notifications')
        .insert({
          id: require('crypto').randomUUID(),
          userId: booking.userId,
          bookingId: booking.id,
          type: 'email',
          channel: 'reminder',
          status: 'sent',
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

      console.log(`Reminder sent for booking ${booking.id}`);
    } catch (err) {
      console.error(`Reminder error for booking ${booking.id}:`, err);
    }
  }
}

module.exports = {
  sendEmail,
  sendLoginNotification,
  sendBookingNotification,
  queueBookingNotification,
  processPendingNotifications,
  sendBookingReminders,
  getEmailConfigSummary
};
