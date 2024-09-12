require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const cors = require("cors");
const mongoose = require("mongoose");

const User = require("./models/User");

const app = express();
const port = process.env.PORT || 5000;
const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");
// Create a Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Configure AWS Cognito
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.MY_ACCESS_KEY_ID,
  secretAccessKey: process.env.MY_SECRET_ACCESS_KEY,
});


// Register Route: Create a user in Cognito and store additional data in MongoDB
app.post("/register", async (req, res) => {
  const { first_name, last_name, email, password, phone_number } = req.body;

  if (!first_name || !last_name || !email || !password || !phone_number) {
    return res.status(400).json({ error: "Please fill in all fields" });
  }

  const params = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "phone_number", Value: phone_number },
      { Name: "given_name", Value: first_name },
      { Name: "family_name", Value: last_name },
    ],
  };

  try {
    const command = new SignUpCommand(params);
    const cognitoResponse = await cognitoClient.send(command);

    // Save user to MongoDB
    const newUser = new User({
      first_name,
      last_name,
      email,
      phone_number,
      cognitoUserSub: cognitoResponse.UserSub, // Make sure UserSub is captured and saved
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(400).json({ error: error.message });
  }
});


// Login Route: Authenticate with Cognito
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const params = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: process.env.CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);
    const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;

    res.status(200).send({ IdToken, AccessToken, RefreshToken });
  } catch (error) {
    if (error.name === "UserNotConfirmedException") {
      // Handle the case where the user is not confirmed
      res.status(400).send({ error: "UserNotConfirmedException", message: "User is not confirmed. Please confirm your account." });
    } else if (error.name === "NotAuthorizedException") {
      res.status(400).send({ error: "Invalid credentials. Please check your email and password." });
    } else {
      console.error("Error logging in user:", error);
      res.status(400).send({ error: error.message });
    }
  }
});



//Profile Confirmation
app.post("/confirm", async (req, res) => {
  const { email, confirmationCode, password } = req.body;

  const confirmParams = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  };

  try {
    // Confirm the user's account
    const confirmCommand = new ConfirmSignUpCommand(confirmParams);
    await cognitoClient.send(confirmCommand);

    // Automatically log the user in after confirmation
    const authParams = {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    const authCommand = new InitiateAuthCommand(authParams);
    const authResponse = await cognitoClient.send(authCommand);
    const { IdToken, AccessToken, RefreshToken } = authResponse.AuthenticationResult;

    // Send the tokens to the frontend
    res.status(200).send({ IdToken, AccessToken, RefreshToken });
  } catch (error) {
    if (error.name === "CodeMismatchException") {
      res.status(400).send({ error: "Invalid confirmation code." });
    } else if (error.name === "ExpiredCodeException") {
      res.status(400).send({ error: "The confirmation code has expired." });
    } else {
      console.error("Error confirming user or logging in:", error);
      res.status(400).json({ error: error.message });
    }
  }
});


// Fetch User Profile Route
app.get("/user-profile", async (req, res) => {
  const { email } = req.query; // Use email to fetch user profile

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
