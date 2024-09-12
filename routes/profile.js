const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");

// Fetch user profile securely using Authorization header
router.get("/user-profile", profileController.getUserProfile);

module.exports = router;
