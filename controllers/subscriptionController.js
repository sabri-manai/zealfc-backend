// controllers/subscriptionController.js

const Stripe = require('stripe');
const User = require('../models/User'); // Adjust the path as necessary

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)




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
    // You might want to notify the user about the failed payment
    console.log(`Payment failed for user ${user.email}.`);
    // Implement your logic here
  } else {
    console.error(`User not found for customer ID: ${customer.id}`);
  }
}

async function handleCheckoutSessionCompleted(event) {
  const session = event.data.object;

  // Retrieve the customer
  const customer = await stripe.customers.retrieve(session.customer);

  // Find the user in your database
  // Using stripeCustomerId as the identifier
  const user = await User.findOne({ stripeCustomerId: customer.id });

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


exports.createCheckoutSession = async (req, res) => {
  const { userId, email } = req.body;

  try {
    // Retrieve the user from the database
    const user = await User.findById(userId);

    // Check if the user already has a Stripe customer ID
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      // Create a new customer in Stripe
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          userId: userId,
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
          userId: userId,
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
          price: 'price_1QAX7PIhXAFLKnnRKxCOp07I', // Replace with your actual Price ID
          quantity: 1,
        },
      ],
      success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: 'http://localhost:3000/cancel',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};


// controllers/subscriptionController.js

exports.handleWebhook = async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Use req.body (which contains the raw body) for verification
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


// Add this function
exports.cancelSubscription = async (req, res) => {
  const { subscriptionId, userId } = req.body;
  console.log('Received cancelSubscription request with subscriptionId:', subscriptionId, 'userId:', userId);

  try {
    // Cancel the subscription in Stripe
    const deletedSubscription = await stripe.subscriptions.cancel(subscriptionId);
    console.log('deletedSubscription:', deletedSubscription);

    // Validate deletedSubscription and userId
    if (!deletedSubscription || !userId) {
      throw new Error('Invalid deletedSubscription or userId');
    }

    // Update the user's subscription status in your database
    const updateData = {
      'subscription.status': deletedSubscription.status || 'canceled',
      'subscription.current_period_end': null,
      'subscription.id': null,
    };

    // Remove undefined values from updateData
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update in the user subscription.');
    }

    await User.findByIdAndUpdate(userId, {
      $set: updateData,
    });

    res.json({ message: 'Subscription cancelled successfully', deletedSubscription });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};


exports.getSubscription = async (req, res) => {
    const userId = req.params.userId;
  
    try {
      const user = await User.findById(userId);
  
      if (user && user.subscription) {
        res.json({ subscription: user.subscription });
      } else {
        res.status(404).json({ error: 'Subscription not found' });
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  };