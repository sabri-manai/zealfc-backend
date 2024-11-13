// routes/game.js

const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Route to create a new game
router.post('/create', gameController.createGame);

// Fetch upcoming games
router.get('/upcoming', gameController.fetchUpcomingGames);

// Route to fetch all games (public route)
router.get('/', gameController.getAllGames);

// Signup player for a game
router.post('/signup/:gameId', gameController.signupForGame);

// Cancel signup for a game
router.post('/cancel-signup/:gameId', gameController.cancelSignupForGame);

router.post('/waitlist/:gameId', gameController.joinWaitlist);

router.delete('/waitlist/:gameId', gameController.leaveWaitlist);

// Update game status
router.patch('/:gameId/status', gameController.updateGameStatus);

// Update player stats
router.patch('/:gameId/player-stats', gameController.updatePlayerStats);

// Route to get a specific game by ID (should be last)
router.get('/:gameId', gameController.getGameById);


// Other game-related routes can be added here

module.exports = router;
