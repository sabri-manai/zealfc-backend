// models/Stadium.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StadiumSchema = new Schema({
  name: { 
    type: String, 
    required: true 
},
  address: { 
    type: String, 
    required: true 
},
  capacity: { 
    type: Number, 
    required: true 
},
  manager: { 
    type: String, 
    required: true 
},
  phone: { 
    type: String ,
    required: true 
},
  email: { 
    type: String,
    required: true 
},
  hosts: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Admin' 
}],
  price: { 
    type: Number,
    required: true 
},
  slots: [{ 
    type: String,
    required: true 
}],
  amenities: [{ 
    type: String 
}],
  type: { 
    type: String 
},
  surface: { 
    type: String 
},
});

module.exports = mongoose.model('Stadium', StadiumSchema);
