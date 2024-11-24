// controllers/leaderboardController.js

const User = require('../models/User');

exports.getLeaderboard = async (req, res) => {
  const { filter } = req.query;

  try {
    // Fetch users based on the filter
    let users = await User.find().sort({ points: -1 }).limit(100);

    // Map users to include profilePictureUrl and full name
    const leaderboardData = users.map(user => {
      // Convert profilePicture buffer to Base64 URL
      const profilePictureUrl = user.profilePicture
        ? `data:image/jpeg;base64,${user.profilePicture.toString('base64')}`
        : null;

      return {
        _id: user._id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        points: user.points,
        profilePictureUrl,
      };
    });

    res.status(200).json(leaderboardData);
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    res.status(500).json({ error: 'Server error while fetching leaderboard data.' });
  }
};
