const express = require("express");
const router = express.Router();
const adminProfileController = require("../controllers/adminProfileController");

// Fetch user profile securely using Authorization header
router.get("/admin-profile", adminProfileController.getAdminProfile);

module.exports = router;
