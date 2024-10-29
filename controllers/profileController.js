// controllers/profileController.js

const User = require("../models/User"); // Ensure the path is correct
// controllers/profileController.js

// Upload profile picture and save it as a Buffer in MongoDB
exports.uploadProfilePicture = async (req, res) => {
  const file = req.file; // The uploaded file

  if (!file) {
    console.error('No file uploaded or invalid file type.');
    return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
  }

  const cognitoUserSub = req.user.sub;

  try {
    const user = await User.findOne({ cognitoUserSub });
    if (!user) {
      console.error('User not found.');
      return res.status(404).json({ error: 'User not found' });
    }

    // Save the file buffer directly to MongoDB
    user.profilePicture = file.buffer;
    await user.save();

    res.status(200).json({
      profilePictureUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Server error while uploading profile picture.' });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  // req.user is available thanks to verifyToken middleware
  const cognitoUserSub = req.user.sub;

  try {
    const user = await User.findOne({ cognitoUserSub });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Convert profile picture to Base64 if it exists
    const profilePictureUrl = user.profilePicture
      ? `data:image/png;base64,${user.profilePicture.toString("base64")}`
      : null;

    // Send user data with profile picture
    res.status(200).json({ ...user.toObject(), profilePictureUrl });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch the games the user has played
exports.getUserGames = async (req, res) => {
  // req.user is available thanks to verifyToken middleware
  const cognitoUserSub = req.user.sub;

  try {
    // Fetch the user from the database based on cognitoUserSub
    const user = await User.findOne({ cognitoUserSub }).populate("games.gameId");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return the user's games
    res.status(200).json(user.games);
  } catch (error) {
    console.error("Error fetching user games:", error);
    res.status(500).json({ error: "Server error while fetching games." });
  }
};

