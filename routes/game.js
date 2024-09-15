const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Route to create a new game
router.post('/create', gameController.createGame);

// Other game-related routes can be added here

module.exports = router;
