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
    return await resend.emails.send({
      from: getSenderEmail(),
      to,
      subject,
      html,
      text
    });
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
        html: `<p>Hi ${booking.guestName},</p><p>Your booking with ${hostName} for ${eventTitle} has been rescheduled.</p><p><strong>New time:</strong> ${when}</p>${locationLine}`,
        text: `Hi ${booking.guestName}, your booking with ${hostName} for ${eventTitle} has been rescheduled to ${when}.`
      },
      host: {
        subject: `Booking Rescheduled: ${eventTitle}`,
        html: `<p>Hi ${hostName},</p><p>Your booking with ${booking.guestName} for ${eventTitle} has been rescheduled.</p><p><strong>New time:</strong> ${when}</p>${locationLine}`,
        text: `Hi ${hostName}, your booking with ${booking.guestName} for ${eventTitle} has been rescheduled to ${when}.`
      }
    };
  }

  return {
    guest: {
      subject: `Booking Confirmed: ${eventTitle}`,
      html: `<p>Hi ${booking.guestName},</p><p>Your booking with ${hostName} for ${eventTitle} is confirmed.</p><p><strong>When:</strong> ${when}</p>${locationLine}`,
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

async function queueBookingNotification({ userId, bookingId, channel }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      id: require('crypto').randomUUID(),
      userId,
      bookingId,
      type: 'email',
      channel,
      status: 'pending',
      updatedAt: new Date().toISOString()
    })
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

module.exports = {
  sendEmail,
  sendLoginNotification,
  sendBookingNotification,
  queueBookingNotification,
  processPendingNotifications
};
