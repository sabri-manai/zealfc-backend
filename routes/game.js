// routes/game.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Route to create a new game
router.post('/create', gameController.createGame);

// Route to fetch all games (public route)
router.get('/', gameController.getAllGames);

//signup player for a game
router.post('/signup/:gameId', gameController.signupForGame);

// Route to get a specific game by ID
router.get('/:gameId', gameController.getGameById);

// Cancel signup for a game
router.post('/cancel-signup/:gameId', gameController.cancelSignupForGame);

// Other game-related routes can be added here

module.exports = router;
