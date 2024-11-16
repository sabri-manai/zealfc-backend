// controllers/leaderboardController.js

const User = require('../models/User');

exports.getLeaderboard = async (req, res) => {
  try {
    // Fetch top users based on total points
    const leaderboard = await User.find()
      .select('first_name last_name points goals assists games_played')
      .sort({ points: -1 })
      .limit(10);

    res.status(200).json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard data.' });
  }
};
