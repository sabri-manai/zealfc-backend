// controllers/subscriptionController.js

const Stripe = require('stripe');
const User = require('../models/User');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { verifyToken } = require('../middlewares/authMiddleware'); // Updated import

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
    const cognitoUserSub = req.user.sub; // Extract user info from token

    try {
      const user = await User.findOne({ cognitoUserSub });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let customerId = user.stripeCustomerId;

      // If the user doesn't have a Stripe customer ID, create one
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user._id.toString() },
        });
        customerId = customer.id;

        // Save the Stripe customer ID
        user.stripeCustomerId = customerId;
        user.lastModified = new Date(); // Ensure Mongoose detects changes
        await user.save();
      }

      // Create the Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID, // Your Stripe price ID
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
    const cognitoUserSub = req.user.sub; // Get sub from decoded token

    try {
      console.log("Before findOne:", cognitoUserSub);
      const user = await User.findOne({ cognitoUserSub });
      console.log("After findOne:", user);
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
    // Retrieve the subscription from the session
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      console.error('No subscription ID found in session.');
      return;
    }

    // Retrieve the subscription object from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription) {
      console.error(`Subscription ${subscriptionId} not found.`);
      return;
    }

    // Retrieve the customer associated with the subscription
    const customer = await stripe.customers.retrieve(subscription.customer);
    if (!customer) {
      console.error(`Customer ${subscription.customer} not found.`);
      return;
    }

    // Find the user in your database
    const userId = customer.metadata.userId;
    const user = await User.findById(userId);

    if (user) {
      // Update user subscription details
      user.subscription.id = subscription.id;
      user.subscription.status = subscription.status; // e.g., 'active'
      user.subscription.current_period_end = new Date(subscription.current_period_end * 1000);
      user.lastModified = new Date(); // Update the lastModified field
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
    // Retrieve the subscription from the invoice
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      console.error('No subscription ID found in invoice.');
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription) {
      console.error(`Subscription ${subscriptionId} not found.`);
      return;
    }

    // Retrieve the customer associated with the subscription
    const customer = await stripe.customers.retrieve(subscription.customer);
    if (!customer) {
      console.error(`Customer ${subscription.customer} not found.`);
      return;
    }

    // Find the user in your database
    const userId = customer.metadata.userId;
    const user = await User.findById(userId);

    if (user) {
      // Update user's subscription period end
      if (subscription.current_period_end) {
        user.subscription.current_period_end = new Date(subscription.current_period_end * 1000);
      }

      // Ensure credits is a number before incrementing
      user.credits = (typeof user.credits === 'number' ? user.credits : 0) + 10;

      user.lastModified = new Date(); // Update the lastModified field

      await user.save();
      console.log(`User ${user.email} subscription renewed successfully.`);
    } else {
      console.error(`User not found for customer ID: ${customer.id}`);
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
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
    // Update user subscription details directly
    user.subscription.id = null;
    user.subscription.status = 'canceled';
    user.subscription.current_period_end = null;
    user.lastModified = new Date();
    user.markModified('subscription');

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
