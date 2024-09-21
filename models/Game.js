const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  teams: {
    type: [[{
      first_name: { type: String, required: true },
      last_name: { type: String, required: true },
      email: { type: String, required: true },
      position: { type: String, default: "Unknown" },
      yellow_cards: { type: Number, default: 0 },
      red_cards: { type: Number, default: 0 },
      goals: { type: Number, default: 0 },
    }]], // Store full user objects in the teams array
    validate: {
      validator: function (val) {
        return val.length === 2; // Ensure there are exactly 2 teams
      },
      message: '{PATH} must have exactly 2 teams'
    }
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
  }
});

module.exports = mongoose.model('Game', GameSchema);
