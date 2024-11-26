// models/User.js
const mongoose = require('mongoose');

const GameStatsSchema = new mongoose.Schema({
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
  },
  goals: {
    type: Number,
    default: 0,
  },
  assists: {
    type: Number,
    default: 0,
  },
  yellow_cards: {
    type: Number,
    default: 0,
  },
  red_cards: {
    type: Number,
    default: 0,
  },
  attendance: {
    type: String,
    enum: [
      'present', 
      'absent', 
      'late', 
      'registered',
      'waitlist'
    ],
    default: 'absent',
  },
  pointsEarned: {
    type: Number,
    default: 0,
  },
  result: {
    type: String,
    enum: ['win', 'loss', 'draw'],
  },
  teamIndex: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['upcoming', 'in progress', 'finished'], // Game status
    default: 'upcoming',
  },
});

const SubscriptionSchema = new mongoose.Schema({
  id: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'inactive'], // Define possible statuses
    default: 'inactive',
  },
  current_period_end: {
    type: Date,
    default: null,
  },
}, { _id: false }); // Prevent creation of an _id for the subscription subdocument

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
  assists: {
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
    default: 'Unknown',
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
  games: [GameStatsSchema],

  attendance_count: {
    type: Number,
    default: 0,
    required: true,
  },
  late_count: {
    type: Number,
    default: 0,
    required: true,
  },
  absence_count: {
    type: Number,
    default: 0,
    required: true,
  },
  subscription: {
    type: SubscriptionSchema,
    default: () => ({}),
  },
  stripeCustomerId: {
    type: String,
    default: null,
  },
  cognitoUserSub: {
    type: String,
    required: true,
  },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
