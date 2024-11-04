// routes/stadium.js
const express = require('express');
const router = express.Router();
const stadiumController = require('../controllers/stadiumController');
const { verifyToken } = require('../middlewares/authMiddlewareAdmin'); // Adjust the path as needed

// GET all stadiums (public route)
router.get('/', stadiumController.getAllStadiums);

// GET a stadium by ID (public route)
router.get('/:id', stadiumController.getStadiumById);

// POST a new stadium (protected route)
router.post('/create', verifyToken, stadiumController.createStadium);

// PUT update a stadium (protected route)
router.put('/:id', verifyToken, stadiumController.updateStadium);

// DELETE a stadium (protected route)
router.delete('/:id', verifyToken, stadiumController.deleteStadium);

module.exports = router;
