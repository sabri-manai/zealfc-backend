// models/Stadium.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StadiumSchema = new Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  capacity: { type: Number, required: true, min: 0 },
  manager: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, match: /.+\@.+\..+/ },
  hosts: [{ type: Schema.Types.ObjectId, ref: 'Admin' }],
  slots: [{
    dayOfWeek: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    startTime: { type: String, required: true }, // e.g., '09:00 AM'
    endTime: { type: String, required: true }, // e.g., '10:00 AM'
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    available: { type: Boolean, default: true },
    price: { type: Number, min: 0 }, // Optional slot-specific price
  }],
  amenities: [{ type: String }],
  type: { type: String, enum: ['Indoor', 'Outdoor'] },
  surface: { type: String, enum: ['Grass', 'Artificial Turf'] },
});

module.exports = mongoose.model('Stadium', StadiumSchema);
