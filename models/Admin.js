const mongoose = require("mongoose");

// Define the Admin schema
const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,  // Ensures no extra spaces
    lowercase: true, // Converts email to lowercase
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],  // Email validation
  },
  first_name: {
    type: String,
    required: true,
    trim: true,
  },
  last_name: {
    type: String,
    required: true,
    trim: true,
  },
  phone_number: {
    type: String,
    required: true,
    match: [/^\+[1-9]\d{1,14}$/, 'Please provide a valid phone number in E.164 format'],
  },
  cognitoUserSub: {
    type: String,
    required: true,
    unique: true, // This ensures that each Cognito user is unique in the database
  },
  role: {
    type: String,
    enum: ["superadmin", "admin", "moderator"], // Different levels of admin access
    default: "admin",  // Default role for new admins
  },
  permissions: {
    type: [String],  // Optional permissions array for fine-grained access control
    default: ["manage-users", "manage-games"], // Example default permissions
  },
  createdAt: {
    type: Date,
    default: Date.now,  // Automatically record when the admin was created
  }
});

// Create a mongoose model called "Admin"
const Admin = mongoose.model("Admin", AdminSchema);

module.exports = Admin;
