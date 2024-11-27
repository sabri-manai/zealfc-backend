// controllers/authController.js

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const User = require('../models/User');

// User Registration
exports.register = async (req, res) => {
  const { first_name, last_name, email, password, phone_number } = req.body;

  // Input validation
  if (!first_name || !last_name || !email || !password || !phone_number) {
    return res.status(400).json({ error: 'Please fill in all fields' });
  }

  const params = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'phone_number', Value: phone_number },
      { Name: 'given_name', Value: first_name },
      { Name: 'family_name', Value: last_name },
    ],
  };

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists.' });
    }

    const command = new SignUpCommand(params);
    const cognitoResponse = await cognitoClient.send(command);

    const newUser = new User({
      first_name,
      last_name,
      email,
      phone_number,
      cognitoUserSub: cognitoResponse.UserSub,
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during user registration:', error);
    if (error.name === 'UsernameExistsException') {
      return res.status(400).json({ error: 'User already exists in Cognito.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// User Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const params = {
    AuthFlow: 'USER_PASSWORD_AUTH',
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
    console.error('Error during user login:', error);
    if (error.name === 'NotAuthorizedException') {
      return res.status(401).send({ error: 'Incorrect username or password.' });
    } else if (error.name === 'UserNotConfirmedException') {
      return res.status(400).send({ error: 'User not confirmed.' });
    }
    res.status(400).send({ error: error.message });
  }
};

// Confirm User Registration
exports.confirm = async (req, res) => {
  const { email, confirmationCode, password } = req.body;

  // Input validation
  if (!email || !confirmationCode || !password) {
    return res.status(400).json({ error: 'Email, confirmation code, and password are required.' });
  }

  const confirmParams = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  };

  try {
    const confirmCommand = new ConfirmSignUpCommand(confirmParams);
    await cognitoClient.send(confirmCommand);

    const authParams = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    const authCommand = new InitiateAuthCommand(authParams);
    const authResponse = await cognitoClient.send(authCommand);

    const { IdToken, AccessToken, RefreshToken } = authResponse.AuthenticationResult;

    res.status(200).send({
      IdToken: IdToken,
      AccessToken: AccessToken,
      RefreshToken: RefreshToken,
    });
  } catch (error) {
    console.error('Error during user confirmation:', error);
    if (error.name === 'NotAuthorizedException') {
      return res.status(400).json({ error: 'The confirmation code is incorrect or expired.' });
    } else if (error.name === 'UserNotFoundException') {
      return res.status(400).json({ error: 'User not found. Please register first.' });
    } else if (error.name === 'ExpiredCodeException') {
      return res.status(400).json({ error: 'The confirmation code has expired.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  // Input validation
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  const params = {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
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
    console.error('Error refreshing token:', error);
    res.status(400).json({ error: 'Failed to refresh token' });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  // Input validation
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const params = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
  };

  try {
    const command = new ForgotPasswordCommand(params);
    await cognitoClient.send(command);
    res.status(200).json({ message: 'Password reset code sent successfully.' });
  } catch (error) {
    console.error('Error initiating password reset:', error);
    res.status(400).json({ error: error.message });
  }
};

// Confirm New Password
exports.resetPassword = async (req, res) => {
  const { email, confirmationCode, newPassword } = req.body;

  // Input validation
  if (!email || !confirmationCode || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const params = {
    ClientId: process.env.CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
    Password: newPassword,
  };

  try {
    const command = new ConfirmForgotPasswordCommand(params);
    await cognitoClient.send(command);
    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(400).json({ error: error.message });
  }
};
