const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");


// Admin Login Route
router.post("/login", adminController.loginAdmin);

// Admin Login Route
router.post("/register", adminController.register);

// Handle NEW_PASSWORD_REQUIRED challenge
router.post("/set-new-password", adminController.setNewPassword);

// Confirm profile route
router.post("/confirm", adminController.confirm);

// In adminRoutes.js
router.post("/resend-confirmation", adminController.resendConfirmation);

//refresh token route
router.post("/refresh-token", adminController.refreshToken);

module.exports = router;
