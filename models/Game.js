// src/models/Game.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the PlayerSchema
const PlayerSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true },
  position: { type: String, default: "Unknown" },
  yellow_cards: { type: Number, default: 0 },
  red_cards: { type: Number, default: 0 },
  goals: { type: Number, default: 0 },
  assists: { type: Number, default: 0 },
});

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
  hosts: [{ type: HostSchema }], // Updated hosts field
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
  host: { type: HostSchema, required: true }, // Single host for the game
  result: {
    type: String,
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
