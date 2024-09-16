const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  teams: {
    type: [[String]], // Nested arrays: each team is an array of player names
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
