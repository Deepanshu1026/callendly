const supabase = require('../config/database');

exports.getAnalytics = async (req, res) => {
  try {
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('userId', req.user.id);

    if (bookingsError) throw bookingsError;

    const totalBookings = bookings ? bookings.length : 0;
    const confirmed = bookings ? bookings.filter(b => b.status === 'confirmed').length : 0;
    const cancelled = bookings ? bookings.filter(b => b.status === 'cancelled').length : 0;
    const rescheduled = bookings ? bookings.filter(b => b.status === 'rescheduled').length : 0;

    const trend = {};
    if (bookings) {
      bookings.forEach(b => {
        const dateStr = b.startTime.split('T')[0];
        trend[dateStr] = (trend[dateStr] || 0) + 1;
      });
    }

    const trendData = Object.entries(trend).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      stats: {
        totalBookings,
        confirmed,
        cancelled,
        rescheduled,
        conversionRate: totalBookings > 0 ? Math.round((confirmed / totalBookings) * 100) : 0
      },
      trend: trendData
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
