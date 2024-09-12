require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const port = process.env.PORT || 5000;

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");

app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
