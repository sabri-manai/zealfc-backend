// routes/admin.js

const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminController');
const { authenticateToken } = require('../utils/auth');

// Admin Registration
router.post('/register', adminAuthController.registerAdmin);

// Admin Login
router.post('/login', adminAuthController.loginAdmin);

// Confirm Admin Registration
router.post('/confirm', adminAuthController.confirmAdminRegistration);

// Resend Confirmation Code
router.post('/resend-confirmation', adminAuthController.resendConfirmationCode);

// Refresh Token
router.post('/refresh-token', adminAuthController.refreshToken);

// Forgot Password
router.post('/forgot-password', adminAuthController.forgotPassword);

// Reset Password
router.post('/reset-password', adminAuthController.resetPassword);

// Get Admin Profile (Protected Route)
router.get('/profile', authenticateToken, adminAuthController.getAdminProfile);

// Get All Hosts (Protected Route)
router.get('/hosts', authenticateToken, adminAuthController.getAllHosts);

module.exports = router;
