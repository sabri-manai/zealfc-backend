// models/Game.js

const mongoose = require('mongoose');

// 1) New sub-schema to store each used credit’s amount, type, and expiry
const UsedCreditSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  type: { 
    type: String, 
    enum: ['subscription', 'permanent'], 
    default: 'subscription' 
  },
  expires_at: { type: Date, default: null },
}, { _id: false });

// Define the PlayerSchema
const PlayerSchema = new mongoose.Schema({
  first_name: { type: String },
  last_name: { type: String },
  email: { type: String },
  position: { type: String, default: 'Unknown' },
  yellow_cards: { type: Number, default: 0 },
  red_cards: { type: Number, default: 0 },
  goals: { type: Number, default: 0 },
  assists: { type: Number, default: 0 },
  attendance: {
    type: String,
    enum: ['present','absent','late','registered','waitlist'],
    default: 'absent',
  },
  // 2) Store the used credits for this exact game signup
  usedCreditsForThisGame: {
    type: [UsedCreditSchema],
    default: [],
  },
}, { _id: false });

// Define the HostSchema
const HostSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, required: true },
  email: { type: String, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  phone_number: { type: String, required: true },
});

// Define the StadiumSchema
const StadiumSchema = new mongoose.Schema({
  name: { type: String, required: true },
  capacity: { type: Number, required: true },
  address: { type: String, required: true },
  image: { type: String },
  hosts: [{ type: HostSchema }],
  slots: [
    {
      startTime: { type: String },
      endTime: { type: String },
    },
  ],
});

const GameSchema = new mongoose.Schema({
  teams: {
    type: [[PlayerSchema]],
    default: [[], []], // Initialize as empty arrays
    validate: {
      validator: function (val) {
        return val.length === 2;
      },
      message: '{PATH} must have exactly 2 teams',
    },
  },
  stadium: {
    type: StadiumSchema,
    required: true,
  },
  host: { type: HostSchema, required: true },
  result: {
    team1Goals: { type: Number, default: 0 },
    team2Goals: { type: Number, default: 0 },
    outcome: {
      type: String,
      enum: ['Team 1 wins', 'Team 2 wins', 'Draw'],
      default: 'Draw',
    },
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
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
  status: {
    type: String,
    enum: ['upcoming', 'in progress', 'finished'],
    default: 'upcoming',
    required: true,
  },
  waitlist: [PlayerSchema],
});

module.exports = mongoose.model('Game', GameSchema);
