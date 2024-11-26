const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Create a Checkout Session
router.post('/create-checkout-session', verifyToken, subscriptionController.createCheckoutSession);

// Cancel Subscription
router.post('/cancel-subscription', verifyToken, subscriptionController.cancelSubscription);

// Get Subscription
router.get('/', verifyToken, subscriptionController.getSubscription);

// // Get Subscription
// router.get('/:userId', subscriptionController.getSubscription);

module.exports = router;