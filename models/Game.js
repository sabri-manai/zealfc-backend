const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  teams: {
    type: [String], // List of team names
    required: true,
    validate: [arrayLimit, '{PATH} must have exactly 2 teams']
  },
  stadium: {
    type: String,
    required: true
  },
  host: {
    type: String,
    required: true
  },
  result: {
    type: String
  },
  date: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Friendly', 'Tournament'] // Limiting the type to specific values
  }
});

// Custom validator to ensure exactly 2 teams
function arrayLimit(val) {
  return val.length === 2;
}

module.exports = mongoose.model('Game', GameSchema);
