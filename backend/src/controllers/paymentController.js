const crypto = require('crypto');
const supabase = require('../config/database');
const { confirmPaidBooking } = require('./bookingController');

exports.createOrder = async (req, res) => {
  try {
    const { bookingId, amount, currency } = req.body;

    // Lookup host user id from booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('userId')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingErr || !booking) {
      return res.status(404).json({ error: 'Booking not found for order creation' });
    }

    let keyId = process.env.RAZORPAY_KEY_ID;
    let keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Check if host has custom Razorpay integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('userId', booking.userId)
      .eq('type', 'razorpay')
      .eq('isActive', true)
      .maybeSingle();

    if (integration && integration.config?.keyId && integration.config?.keySecret) {
      keyId = integration.config.keyId;
      keySecret = integration.config.keySecret;
    }

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay keys are missing in environment and host configurations' });
    }

    const value = Math.round(parseFloat(amount) * 100); 

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64')
      },
      body: JSON.stringify({
        amount: value,
        currency: currency || 'INR',
        receipt: `receipt_${bookingId.substring(0, 10)}`
      })
    });

    const razorpayOrder = await response.json();
    if (!response.ok) {
      console.error('Razorpay API error:', razorpayOrder);
      return res.status(400).json({ error: 'Razorpay order creation failed', details: razorpayOrder });
    }

    // Upsert or insert payment record
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('bookingId', bookingId)
      .maybeSingle();

    if (existingPayment) {
      await supabase
        .from('payments')
        .update({
          amount: parseFloat(amount),
          currency: currency || 'INR',
          transactionId: razorpayOrder.id,
          status: 'pending',
          updatedAt: new Date().toISOString()
        })
        .eq('id', existingPayment.id);
    } else {
      await supabase
        .from('payments')
        .insert({
          id: require('crypto').randomUUID(),
          bookingId,
          amount: parseFloat(amount),
          currency: currency || 'INR',
          provider: 'razorpay',
          status: 'pending',
          transactionId: razorpayOrder.id,
          updatedAt: new Date().toISOString()
        });
    }

    res.json({
      orderId: razorpayOrder.id,
      amount: value,
      currency: razorpayOrder.currency,
      keyId
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, bookingId } = req.body;

    // Lookup host user id from booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('userId')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingErr || !booking) {
      return res.status(404).json({ error: 'Booking not found for signature verification' });
    }

    let keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Check if host has custom Razorpay integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('userId', booking.userId)
      .eq('type', 'razorpay')
      .eq('isActive', true)
      .maybeSingle();

    if (integration && integration.config?.keySecret) {
      keySecret = integration.config.keySecret;
    }

    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay key secret is missing' });
    }

    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const expectedSignature = hmac.digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature verification' });
    }

    await supabase
      .from('payments')
      .update({
        status: 'completed',
        transactionId: razorpay_payment_id,
        updatedAt: new Date().toISOString()
      })
      .eq('bookingId', bookingId);

    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        updatedAt: new Date().toISOString()
      })
      .eq('id', bookingId);

    // Call confirmation workflow (calendar event creation, notifications, webhooks)
    await confirmPaidBooking(bookingId, req);

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
