require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const port = process.env.PORT || 5000;

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const profileRoutes = require("./routes/profile");
const adminProfileRoutes = require("./routes/adminProfile");
const gameRoutes = require('./routes/game');
const subscriptionRoutes = require('./routes/subscription')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/profile", profileRoutes);
app.use("/adminProfile", adminProfileRoutes);
app.use('/games', gameRoutes);
app.use('/subscription', subscriptionRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
