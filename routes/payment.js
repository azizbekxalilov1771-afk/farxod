const express = require('express');
const stripe = require('stripe');
const router = express.Router();
const db = require('../config/database');
const config = require('../config/config');

// Initialize Stripe
const stripeClient = stripe(config.stripe.secretKey);

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token talab qilinadi' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Yaroqsiz token' });
  }
};

// Create payment intent for quiz rewards
router.post('/create-intent/quiz', verifyToken, async (req, res) => {
  try {
    const { quizId, amount, currency = 'usd' } = req.body;

    if (!quizId || !amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Quiz ID va to\'g\'ri miqdor talab qilinadi' 
      });
    }

    // Verify quiz exists and get details
    const quiz = await db.query(
      'SELECT * FROM quizzes WHERE id = ? AND is_active = 1',
      [quizId]
    );

    if (quiz.length === 0) {
      return res.status(404).json({ error: 'Quiz topilmadi' });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      metadata: {
        type: 'quiz_reward',
        quiz_id: quizId,
        user_id: req.user.id,
        quiz_title: quiz[0].title
      },
      description: `Quiz mukofoti: ${quiz[0].title}`
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ 
      error: 'To\'lov yaratishda xatolik: ' + error.message 
    });
  }
});

// Create payment intent for business services
router.post('/create-intent/service', verifyToken, async (req, res) => {
  try {
    const { serviceId, amount, currency = 'usd', description } = req.body;

    if (!serviceId || !amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Xizmat ID va to\'g\'ri miqdor talab qilinadi' 
      });
    }

    // Verify service exists
    const service = await db.query(
      'SELECT * FROM services WHERE id = ? AND is_active = 1',
      [serviceId]
    );

    if (service.length === 0) {
      return res.status(404).json({ error: 'Xizmat topilmadi' });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      metadata: {
        type: 'service_payment',
        service_id: serviceId,
        user_id: req.user.id,
        service_name: service[0].name
      },
      description: description || `Xizmat to'lovi: ${service[0].name}`
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Create service payment intent error:', error);
    res.status(500).json({ 
      error: 'To\'lov yaratishda xatolik: ' + error.message 
    });
  }
});

// Create payment intent for products
router.post('/create-intent/product', verifyToken, async (req, res) => {
  try {
    const { items, currency = 'usd' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Mahsulotlar ro\'yxati talab qilinadi' 
      });
    }

    let totalAmount = 0;
    const productDetails = [];

    // Verify products and calculate total
    for (const item of items) {
      const product = await db.query(
        'SELECT * FROM products WHERE id = ? AND is_active = 1',
        [item.productId]
      );

      if (product.length === 0) {
        return res.status(404).json({ 
          error: `Mahsulot topilmadi: ${item.productId}` 
        });
      }

      const productData = product[0];
      const quantity = item.quantity || 1;
      const itemTotal = productData.price * quantity;

      totalAmount += itemTotal;
      productDetails.push({
        id: productData.id,
        name: productData.name,
        price: productData.price,
        quantity: quantity,
        total: itemTotal
      });
    }

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Yaroqsiz to\'lov miqdori' });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: currency,
      metadata: {
        type: 'product_purchase',
        user_id: req.user.id,
        items: JSON.stringify(productDetails)
      },
      description: `Mahsulot xaridi: ${productDetails.length} ta element`
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totalAmount: totalAmount,
      items: productDetails
    });

  } catch (error) {
    console.error('Create product payment intent error:', error);
    res.status(500).json({ 
      error: 'To\'lov yaratishda xatolik: ' + error.message 
    });
  }
});

// Confirm payment and process reward/order
router.post('/confirm-payment', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment Intent ID talab qilinadi' });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'To\'lov hali yakunlanmagan' 
      });
    }

    const metadata = paymentIntent.metadata;
    const paymentType = metadata.type;

    // Process based on payment type
    switch (paymentType) {
      case 'quiz_reward':
        await processQuizReward(paymentIntent, req.user.id);
        break;
      case 'service_payment':
        await processServicePayment(paymentIntent, req.user.id);
        break;
      case 'product_purchase':
        await processProductPurchase(paymentIntent, req.user.id);
        break;
      default:
        throw new Error('Noma\'lum to\'lov turi');
    }

    res.json({
      success: true,
      message: 'To\'lov muvaffaqiyatli amalga oshirildi',
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency
      }
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ 
      error: 'To\'lovni tasdiqlashda xatolik: ' + error.message 
    });
  }
});

// Process quiz reward payment
async function processQuizReward(paymentIntent, userId) {
  const metadata = paymentIntent.metadata;
  const quizId = metadata.quiz_id;
  const amount = paymentIntent.amount / 100;

  // Record the reward payment
  await db.run(`
    INSERT INTO reward_payments (
      user_id, quiz_id, payment_intent_id, amount, status, created_at
    ) VALUES (?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
  `, [userId, quizId, paymentIntent.id, amount]);

  // You can add additional logic here like:
  // - Updating user balance
  // - Sending notification
  // - Triggering analytics events
}

// Process service payment
async function processServicePayment(paymentIntent, userId) {
  const metadata = paymentIntent.metadata;
  const serviceId = metadata.service_id;
  const amount = paymentIntent.amount / 100;

  // Create service order
  await db.run(`
    INSERT INTO service_orders (
      user_id, service_id, payment_intent_id, amount, status, created_at
    ) VALUES (?, ?, ?, ?, 'paid', CURRENT_TIMESTAMP)
  `, [userId, serviceId, paymentIntent.id, amount]);

  // Additional service-specific logic can be added here
}

// Process product purchase
async function processProductPurchase(paymentIntent, userId) {
  const metadata = paymentIntent.metadata;
  const items = JSON.parse(metadata.items);
  const totalAmount = paymentIntent.amount / 100;

  // Create order
  const orderResult = await db.run(`
    INSERT INTO orders (
      user_id, total_amount, status, payment_intent_id, items, created_at
    ) VALUES (?, ?, 'completed', ?, ?, CURRENT_TIMESTAMP)
  `, [userId, totalAmount, paymentIntent.id, JSON.stringify(items)]);

  // Update product stock
  for (const item of items) {
    await db.run(
      'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
      [item.quantity, item.id]
    );
  }
}

// Get payment history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        'quiz_reward' as type,
        payment_intent_id,
        amount,
        status,
        created_at,
        quiz_id as related_id,
        (SELECT title FROM quizzes WHERE id = rp.quiz_id) as title
      FROM reward_payments rp
      WHERE user_id = ?
      
      UNION ALL
      
      SELECT 
        'service' as type,
        payment_intent_id,
        amount,
        status,
        created_at,
        service_id as related_id,
        (SELECT name FROM services WHERE id = so.service_id) as title
      FROM service_orders so
      WHERE user_id = ?
      
      UNION ALL
      
      SELECT 
        'product' as type,
        payment_intent_id,
        total_amount as amount,
        status,
        created_at,
        id as related_id,
        'Mahsulot xaridi' as title
      FROM orders
      WHERE user_id = ?
      
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const payments = await db.query(query, [
      req.user.id, req.user.id, req.user.id, limit, offset
    ]);

    res.json({
      success: true,
      payments: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: payments.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ 
      error: 'To\'lovlar tarixini olishda xatolik' 
    });
  }
});

// Webhook endpoint for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature (you need to set STRIPE_WEBHOOK_SECRET in env)
    event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('Payment succeeded:', event.data.object.id);
      // Additional processing can be added here
      break;
    case 'payment_intent.payment_failed':
      console.log('Payment failed:', event.data.object.id);
      // Handle failed payment
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Get Stripe public key
router.get('/config', (req, res) => {
  res.json({
    publicKey: config.stripe.publicKey
  });
});

module.exports = router;