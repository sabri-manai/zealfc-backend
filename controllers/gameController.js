const Game = require('../models/Game');

// Create a new game
exports.createGame = async (req, res) => {
  const { teams, stadium, host, result, date, duration, type } = req.body;

  if (!teams || !stadium || !host || !date || !duration || !type) {
    return res.status(400).json({ error: 'All required fields must be provided.' });
  }

  try {
    const newGame = new Game({
      teams,
      stadium,
      host,
      result,
      date,
      duration,
      type
    });

    await newGame.save();
    res.status(201).json(newGame);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Server error while creating the game.' });
  }
};



// Fetch all games (public route)
exports.getAllGames = async (req, res) => {
  try {
    const games = await Game.find(); // Fetch all games from the database
    res.status(200).json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Server error while fetching games.' });
  }
};



// Other controller functions for game management can go here
