const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true,
  },
  last_name: {
    type: String,
    required: true,
  },
  profilePicture: {
    type: Buffer,
    default: null,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone_number: {
    type: String,
    required: true,
  },
  games_played: {
    type: Number,
    default: 0,
    required: true,
  },
  goals: {
    type: Number,
    default: 0,
    required: true,
  },
  assists: { // New field
    type: Number,
    default: 0,
    required: true,
  },
  credits: { 
    type: Number,
    default: 0,
    required: true,
  },
  position: {
    type: String,
    default: "Unknown",
    required: true,
  },
  yellow_cards: {
    type: Number,
    default: 0,
    required: true,
  },
  red_cards: {
    type: Number,
    default: 0,
    required: true,
  },
  points: {
    type: Number,
    default: 0,
    required: true,
  },
  observations: {
    type: Object,
    default: {},
    required: true,
  },
  games: [
    {
      gameId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
      stadium: {
        type: String,
        required: true,
      }
    }
  ],
  subscription: {
    id: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      default: null,
    },
    current_period_end: {
      type: Date,
      default: null,
    },
  },
  stripeCustomerId: {
    type: String,
    default: null,
  },
  cognitoUserSub: {
    type: String,
    required: true,
  }
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
