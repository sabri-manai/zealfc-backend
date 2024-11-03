const User = require("../models/User"); // Assuming your User model has necessary data

exports.getLeaderboard = async (req, res) => {
  try {
    // Fetch top users based on some criteria (e.g., total points)
    const leaderboard = await User.find().sort({ points: -1 }).limit(10);
    res.status(200).json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard data." });
  }
};
