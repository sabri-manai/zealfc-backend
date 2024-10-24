// routes/subscription.js

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// Remove the webhook route from here since it's defined in server.js

// Use express.json() for parsing JSON bodies
// No need to apply express.json() here since it's already applied in server.js

// Create a Checkout Session
router.post('/create-checkout-session', subscriptionController.createCheckoutSession);

// Cancel Subscription
router.post('/cancel-subscription', subscriptionController.cancelSubscription);

// Get Subscription
router.get('/:userId', subscriptionController.getSubscription);

module.exports = router;
