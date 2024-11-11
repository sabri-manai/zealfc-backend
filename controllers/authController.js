const { 
  CognitoIdentityProviderClient, 
  SignUpCommand, 
  ConfirmSignUpCommand, 
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const User = require("../models/User");
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

exports.register = async (req, res) => {
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

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }

    const newUser = new User({
      first_name,
      last_name,
      email,
      phone_number,
      cognitoUserSub: cognitoResponse.UserSub,
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      return res.status(400).json({ error: 'User already exists in Cognito.' });
    }
    res.status(400).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

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

    res.status(200).send({
      idToken: IdToken,
      accessToken: AccessToken,
      refreshToken: RefreshToken,
    });
  } catch (error) {
    if (error.name === 'NotAuthorizedException') {
      return res.status(401).send({ error: 'Incorrect username or password.' });
    }

    res.status(400).send({ error: error.message });
  }
};

exports.confirm = async (req, res) => {
  const { email, confirmationCode, password } = req.body;
  const confirmParams = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  };

  try {
    const confirmCommand = new ConfirmSignUpCommand(confirmParams);
    await cognitoClient.send(confirmCommand);

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

    res.status(200).send({ IdToken, AccessToken, RefreshToken });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New function for handling refresh token
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required." });
  }

  const params = {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: process.env.CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);

    const { IdToken, AccessToken } = response.AuthenticationResult;

    res.status(200).send({
      idToken: IdToken,
      accessToken: AccessToken,
    });
  } catch (error) {
    res.status(400).json({ error: "Failed to refresh token" });
  }
};


// Initiate password reset
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const params = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
  };

  try {
    const command = new ForgotPasswordCommand(params);
    await cognitoClient.send(command);
    res.status(200).json({ message: "Password reset code sent successfully." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Confirm new password
exports.resetPassword = async (req, res) => {
  const { email, confirmationCode, newPassword } = req.body;

  const params = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
    Password: newPassword,
  };

  try {
    const command = new ConfirmForgotPasswordCommand(params);
    await cognitoClient.send(command);
    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};