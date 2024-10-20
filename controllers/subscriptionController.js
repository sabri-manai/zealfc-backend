// controllers/subscriptionController.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User'); // Adjust the path as necessary

exports.createCheckoutSession = async (req, res) => {
  const { userId } = req.body; // Assuming you pass the user ID in the request

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: req.body.email, // Optionally pre-fill the customer's email
      line_items: [
        {
          price: 'price_1QAX7PIhXAFLKnnRKxCOp07I', // Replace with your actual Price ID
          quantity: 1,
        },
      ],
      success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}`,
      cancel_url: 'http://localhost:3000/cancel',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

exports.handleWebhook = async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];
  const rawBody = req.body; // Use raw body parser

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;

      // Retrieve the subscription
      const subscription = await stripe.subscriptions.retrieve(session.subscription);

      // Update user in the database
      await User.findOneAndUpdate(
        { email: session.customer_email },
        {
          subscription: {
            id: subscription.id,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000),
          },
        }
      );

      console.log('Subscription created:', subscription.id);
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

exports.cancelSubscription = async (req, res) => {
  const { subscriptionId, userId } = req.body;

  try {
    const deletedSubscription = await stripe.subscriptions.del(subscriptionId);

    // Update user in the database
    await User.findByIdAndUpdate(userId, {
      $set: { 'subscription.status': deletedSubscription.status },
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