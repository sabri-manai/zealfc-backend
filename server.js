require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(cors());

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.MY_ACCESS_KEY_ID,
  secretAccessKey: process.env.MY_SECRET_ACCESS_KEY,
});


const cognito = new AWS.CognitoIdentityServiceProvider();

function generateSecretHash(username, clientId, clientSecret) {
  return crypto
    .createHmac("SHA256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}

app.post("/register", async (req, res) => {
  const { username, password, email } = req.body;

  const params = {
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
    UserAttributes: [{ Name: "email", Value: email }],
    TemporaryPassword: password,
    MessageAction: "SUPPRESS",
  };

  try {
    await cognito.adminCreateUser(params).promise();
    const setPasswordParams = {
      Password: password,
      UserPoolId: process.env.USER_POOL_ID,
      Username: username,
      Permanent: true,
    };
    await cognito.adminSetUserPassword(setPasswordParams).promise();
    res.status(200).send({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(400).send({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const clientSecret = process.env.CLIENT_SECRET;

  const secretHash = generateSecretHash(
    username,
    process.env.CLIENT_ID,
    clientSecret
  );

  const params = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: process.env.CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: secretHash,
    },
  };

  try {
    const response = await cognito.initiateAuth(params).promise();
    const idToken = response.AuthenticationResult.IdToken;
    const accessToken = response.AuthenticationResult.AccessToken;
    const refreshToken = response.AuthenticationResult.RefreshToken;
    res.status(200).send({ idToken, accessToken, refreshToken });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(400).send({ error: error.message });
  }
});
app.get("/", (req, res) => {
  res.send("Backend is working!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
