// controllers/subscriptionController.js

const Stripe = require('stripe');
const User = require('../models/User');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { verifyToken } = require('../middlewares/authMiddleware'); // Updated import
const { sendEmail } = require('../services/emailService');

// Handle Stripe webhook events securely
exports.handleWebhook = async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Use req.body (raw body) for verification
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event);
      break;
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Create a checkout session
exports.createCheckoutSession = [
  verifyToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;
    const { plan } = req.body; // 'Basic', 'Premium', 'Mate'

    let priceId;
    switch (plan) {
      case 'Basic':
        priceId = process.env.STRIPE_PRICE_ID_BASIC;
        break;
      case 'Premium':
        priceId = process.env.STRIPE_PRICE_ID_PREMIUM;
        break;
      case 'Mate':
        priceId = process.env.STRIPE_PRICE_ID_MATE;
        break;
      default:
        return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    try {
      const user = await User.findOne({ cognitoUserSub });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user has an active subscription
      if (user.subscription && user.subscription.status === 'active') {
        return res.status(400).json({ error: 'You already have an active subscription.' });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user._id.toString() },
        });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        user.lastModified = new Date();
        await user.save();
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL}/profile?userId=${user._id}`,
        cancel_url: `${process.env.FRONTEND_URL}/profile?userId=${user._id}`,
        metadata: { plan } // pass the chosen plan to the session
      });

      res.json({ id: session.id });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  },
];



// Cancel Subscription
exports.cancelSubscription = [
  verifyToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const user = await User.findOne({ cognitoUserSub });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const subscriptionId = user.subscription?.id;

      if (!subscriptionId) {
        return res.status(400).json({ error: 'No active subscription found' });
      }

      // Cancel the subscription in Stripe
      const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

      // Update the user subscription details
      user.subscription.id = null;
      user.subscription.status = 'canceled';
      user.subscription.current_period_end = null;
      user.lastModified = new Date(); // Update the lastModified field
      user.markModified('subscription');

      await user.save();
      res.json({ message: 'Subscription cancelled successfully', canceledSubscription });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  },
];


// Get Subscription
exports.getSubscription = [
  verifyToken, // Updated middleware
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const user = await User.findOne({ cognitoUserSub });
      if (user && user.subscription) {
        res.json({ subscription: user.subscription });
      } else {
        res.status(404).json({ error: 'Subscription not found' });
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  },
];

// Handle Checkout Session Completed
async function handleCheckoutSessionCompleted(event) {
  const session = event.data.object;

  try {
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      console.error('No subscription ID found in session.');
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription) {
      console.error(`Subscription ${subscriptionId} not found.`);
      return;
    }

    const customer = await stripe.customers.retrieve(subscription.customer);
    if (!customer) {
      console.error(`Customer ${subscription.customer} not found.`);
      return;
    }

    const userId = customer.metadata.userId;
    const user = await User.findById(userId);

    if (user) {
      user.subscription.id = subscription.id;
      user.subscription.status = subscription.status || 'active'; 
      user.subscription.current_period_end = new Date(subscription.current_period_end * 1000);
      user.subscription.type = session.metadata.plan || ''; 
      
      user.lastModified = new Date();
      user.markModified('subscription');

      await user.save();
      console.log(`User ${user.email} subscription updated successfully.`);
    } else {
      console.error(`User not found for customer ID: ${customer.id}`);
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}



  // Handle Invoice Payment Succeeded
  async function handleInvoicePaymentSucceeded(event) {
    const invoice = event.data.object;

    try {
      const subscriptionId = invoice.subscription;
      if (!subscriptionId) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (!subscription) return;

      const customer = await stripe.customers.retrieve(subscription.customer);
      if (!customer) return;

      const userId = customer.metadata.userId;
      const user = await User.findById(userId);
      if (!user) return;

      if (subscription.current_period_end) {
        user.subscription.current_period_end = new Date(subscription.current_period_end * 1000);
      }

      // Add credits based on subscription.type
      let creditsToAdd = 0;
      switch (user.subscription.type) {
        case 'Basic':
          creditsToAdd = 5;
          break;
        case 'Premium':
          creditsToAdd = 10;
          break;
        case 'Mate':
          creditsToAdd = 20;
          break;
        default:
          creditsToAdd = 0; 
      }

      user.credits = (typeof user.credits === 'number' ? user.credits : 0) + creditsToAdd;
      user.lastModified = new Date();
      await user.save()
      console.log(`User ${user.email} subscription renewed successfully.`);

      // Send subscription renewal email
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Subscription Renewed',
        html: `<p>Hello ${user.first_name},</p><p>Your subscription has been successfully renewed. Your next billing date is <strong>${new Date(subscription.current_period_end * 1000).toLocaleDateString()}</strong>.</p><p>Thank you for being with us!</p>`,
        text: `Hello ${user.first_name},\n\nYour subscription has been successfully renewed. Your next billing date is ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}.\n\nThank you for being with us!`,
      });
    }
   catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

// Handle Subscription Deleted
async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object;

  try {
    // Retrieve the customer
    const customer = await stripe.customers.retrieve(subscription.customer);

    // Find the user in your database
    const userId = customer.metadata.userId;
    const user = await User.findById(userId);

    if (user) {
      // Update user subscription details directly
      user.subscription.id = null;
      user.subscription.status = 'canceled';
      user.subscription.current_period_end = null;
      user.lastModified = new Date();
      user.markModified('subscription');

      await user.save();
      console.log(`User ${user.email} subscription canceled.`);

      // Send subscription cancellation email
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Subscription Canceled',
        html: `<p>Hello ${user.first_name},</p><p>Your subscription has been canceled. If this was not intentional, please contact support or renew your subscription to continue enjoying our services.</p><p>Best regards,<br>Zealfc Team</p>`,
        text: `Hello ${user.first_name},\n\nYour subscription has been canceled. If this was not intentional, please contact support or renew your subscription to continue enjoying our services.\n\nBest regards,\nZealfc Team`,
      });
    } else {
      console.error(`User not found for customer ID: ${customer.id}`);
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

// Handle Invoice Payment Failed
async function handleInvoicePaymentFailed(event) {
  const invoice = event.data.object;

  // Retrieve the subscription
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

  // Retrieve the customer
  const customer = await stripe.customers.retrieve(subscription.customer);

  // Find the user in your database
  const userId = customer.metadata.userId;
  const user = await User.findById(userId);

  if (user) {
    // Notify the user about the failed payment
    console.log(`Payment failed for user ${user.email}.`);
    // Implement your logic here
  } else {
    console.error(`User not found for customer ID: ${customer.id}`);
  }
}
