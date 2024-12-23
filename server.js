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
app.use(cors({
  origin: `${process.env.FRONTEND_URL}`,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Route for handling Stripe webhooks (must be before any other middleware)
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleWebhook
);

// Parse JSON bodies for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import and use other routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const profileRoutes = require("./routes/profile");
const adminProfileRoutes = require("./routes/adminProfile");
const gameRoutes = require('./routes/game');
const stadiumRoutes = require('./routes/stadium');
const subscriptionRoutes = require('./routes/subscription');
const leaderboardRoutes = require("./routes/leaderboard");

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/profile", profileRoutes);
app.use("/adminProfile", adminProfileRoutes);
app.use('/games', gameRoutes);
app.use('/stadiums', stadiumRoutes);
app.use("/leaderboard", leaderboardRoutes); // Register the route

// Use JSON body parser for subscription routes (excluding webhook)
app.use('/subscription', subscriptionRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
