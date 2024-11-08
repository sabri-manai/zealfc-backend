const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PlayerSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true },
  position: { type: String, default: "Unknown" },
  yellow_cards: { type: Number, default: 0 },
  red_cards: { type: Number, default: 0 },
  goals: { type: Number, default: 0 },
  assists: { type: Number, default: 0 }, // Add assists field
});

const GameSchema = new mongoose.Schema({
  teams: {
    type: [[PlayerSchema]], // Use the PlayerSchema for players
    validate: {
      validator: function (val) {
        return val.length === 2; // Ensure there are exactly 2 teams
      },
      message: '{PATH} must have exactly 2 teams',
    },
  },
  stadium: {
    type: Schema.Types.ObjectId,
    ref: 'Stadium',
    required: true,
  },
  host: {
    type: String,
    required: true,
  },
  result: {
    type: String,
  },
  date: {
    type: Date,
    required: true,
  },
  time: { // New field
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  status: { // New field
    type: String,
    enum: ['upcoming', 'in progress', 'finished'],
    default: 'upcoming',
    required: true,
  },
});

module.exports = mongoose.model('Game', GameSchema);
