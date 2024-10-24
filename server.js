// server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// Import controllers
const subscriptionController = require('./controllers/subscriptionController');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Configure CORS
app.use(cors());

// Route for handling webhooks (must be before any body parser middleware)
app.post('/subscription/webhook', express.raw({ type: 'application/json' }), subscriptionController.handleWebhook);

// Parse JSON bodies for all other routes
app.use(express.json());

// Import and use other routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const profileRoutes = require("./routes/profile");
const adminProfileRoutes = require("./routes/adminProfile");
const gameRoutes = require('./routes/game');
const stadiumRoutes = require('./routes/stadium');
const subscriptionRoutes = require('./routes/subscription'); // Import after express.json()

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/profile", profileRoutes);
app.use("/adminProfile", adminProfileRoutes);
app.use('/games', gameRoutes);
app.use('/stadiums', stadiumRoutes);

// Use JSON body parser for subscription routes (excluding webhook)
app.use('/subscription', subscriptionRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
