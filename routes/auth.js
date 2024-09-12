const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Register route
router.post("/register", authController.register);

// Login route
router.post("/login", authController.login);

// Confirm profile route
router.post("/confirm", authController.confirm);

module.exports = router;
