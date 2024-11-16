// controllers/subscriptionController.js

const Stripe = require('stripe');
const User = require('../models/User');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require('../utils/auth');

// Handle Stripe webhook events securely
exports.handleWebhook = async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Use raw body for verification
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
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
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      // Retrieve the user from the database
      const user = await User.findOne({ cognitoUserSub });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const email = user.email;

      // Check if the user already has a Stripe customer ID
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        // Create a new customer in Stripe
        const customer = await stripe.customers.create({
          email: email,
          metadata: {
            userId: user._id.toString(),
          },
        });
        customerId = customer.id;

        // Save the customer ID to the user record
        user.stripeCustomerId = customerId;
        await user.save();
      } else {
        // Update the existing customer's metadata
        await stripe.customers.update(customerId, {
          metadata: {
            userId: user._id.toString(),
          },
        });
      }

      // Create the checkout session
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID, // Replace with your actual Price ID
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
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
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      // Retrieve the user from the database
      const user = await User.findOne({ cognitoUserSub });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const subscriptionId = user.subscription.id;

      if (!subscriptionId) {
        return res.status(400).json({ error: 'No active subscription found' });
      }

      // Cancel the subscription in Stripe
      const deletedSubscription = await stripe.subscriptions.del(subscriptionId);

      // Update the user's subscription status in your database
      user.subscription.status = deletedSubscription.status || 'canceled';
      user.subscription.current_period_end = null;
      user.subscription.id = null;
      await user.save();

      res.json({ message: 'Subscription cancelled successfully', deletedSubscription });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  },
];

// Get Subscription
exports.getSubscription = [
  authenticateToken,
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

  // Retrieve the customer
  const customer = await stripe.customers.retrieve(session.customer);

  // Find the user in your database
  const userId = customer.metadata.userId;
  const user = await User.findById(userId);

  if (user) {
    // Update user subscription details
    user.subscription = {
      id: session.subscription,
      status: 'active',
      current_period_end: new Date(session.expires_at * 1000),
    };

    await user.save();
    console.log(`User ${user.email} subscription updated successfully.`);
  } else {
    console.error(`User not found for customer ID: ${customer.id}`);
  }
}

// Handle Invoice Payment Succeeded
async function handleInvoicePaymentSucceeded(event) {
  const invoice = event.data.object;

  // Retrieve the subscription
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

  // Retrieve the customer
  const customer = await stripe.customers.retrieve(subscription.customer);

  // Find the user in your database
  const userId = customer.metadata.userId;
  const user = await User.findById(userId);

  if (user) {
    // Update user's subscription period end
    user.subscription.current_period_end = new Date(subscription.current_period_end * 1000);
    user.credits += 10; // Add credits for renewal
    await user.save();
    console.log(`User ${user.email} subscription renewed successfully.`);
  } else {
    console.error(`User not found for customer ID: ${customer.id}`);
  }
}

// Handle Subscription Deleted
async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object;

  // Retrieve the customer
  const customer = await stripe.customers.retrieve(subscription.customer);

  // Find the user in your database
  const userId = customer.metadata.userId;
  const user = await User.findById(userId);

  if (user) {
    // Update user's subscription status
    user.subscription.status = subscription.status;
    await user.save();
    console.log(`User ${user.email} subscription canceled.`);
  } else {
    console.error(`User not found for customer ID: ${customer.id}`);
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
