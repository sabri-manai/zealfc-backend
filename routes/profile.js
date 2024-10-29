// routes/profile.js

const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { verifyToken } = require("../middlewares/authMiddleware"); // Ensure path is correct
const multer = require('multer');

// Fetch user profile securely using Authorization header
router.get(
    "/user-profile", 
    verifyToken, 
    profileController.getUserProfile
);

router.get(
    "/user-games", 
    verifyToken, 
    profileController.getUserGames
);

// Configure Multer storage
const storage = multer.memoryStorage(); // Store files in memory as Buffer

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit files to 5MB
    fileFilter: (req, file, cb) => {
      console.log('Received file:', file.originalname, 'of type:', file.mimetype);
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and GIF files are allowed.'));
      }
    },
  });

// Apply the middleware directly in the route
router.post(
  '/upload-profile-picture',
  verifyToken,
  upload.single('profilePicture'),
  profileController.uploadProfilePicture
);
  
module.exports = router;
