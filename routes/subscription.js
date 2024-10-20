// routes/subscription.js

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const bodyParser = require('body-parser');

// Create a Checkout Session
router.post('/create-checkout-session', subscriptionController.createCheckoutSession);

// Handle Stripe Webhooks
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), subscriptionController.handleWebhook);

// Cancel Subscription
router.post('/cancel-subscription', subscriptionController.cancelSubscription);

// Get Subscription
router.get('/:userId', subscriptionController.getSubscription);

module.exports = router;
