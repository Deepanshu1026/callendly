const supabase = require('./src/config/database');

async function checkNotifications() {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*, booking:bookings(guestEmail, guestName, startTime, eventType:event_types(title))')
      .order('updatedAt', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    console.log('Recent 10 notifications:');
    console.log(JSON.stringify(notifications, null, 2));
  } catch (err) {
    console.error('Execution error:', err);
  }
}

checkNotifications();
