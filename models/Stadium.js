// models/Stadium.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Import the AdminSchema
const HostSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Include _id for reference
  email: { type: String, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  phone_number: { type: String, required: true },
});

const StadiumSchema = new Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  capacity: { type: Number, required: true, min: 0 },
  manager: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, match: /.+\@.+\..+/ },
  hosts: [{ type: HostSchema }], // Change from [{ type: String }] to [{ type: HostSchema }]
    slots: [{
    dayOfWeek: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    available: { type: Boolean, default: true },
    price: { type: Number, min: 0 },
  }],
  amenities: [{ type: String }],
  type: { type: String, enum: ['Indoor', 'Outdoor'] },
  surface: { type: String, enum: ['Grass', 'Artificial Turf'] },
});

module.exports = mongoose.model('Stadium', StadiumSchema);
