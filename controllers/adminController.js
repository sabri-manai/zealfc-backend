// controllers/adminAuthController.js

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.ADMIN_AWS_REGION });
const Admin = require('../models/Admin');
const { authenticateToken } = require('../utils/auth');

// Admin Login
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).send({ error: 'Email and password are required.' });
  }

  const params = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.ADMIN_CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);

    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return res.status(200).json({
        challengeName: response.ChallengeName,
        session: response.Session,
        requiredAttributes: response.ChallengeParameters.requiredAttributes,
      });
    }

    const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;

    res.status(200).send({
      idToken: IdToken,
      accessToken: AccessToken,
      refreshToken: RefreshToken,
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    if (error.name === 'UserNotConfirmedException') {
      return res.status(400).send({ error: 'User not confirmed.' });
    } else if (error.name === 'NotAuthorizedException') {
      return res.status(401).send({ error: 'Incorrect username or password.' });
    }
    res.status(400).send({ error: error.message });
  }
};

// Handle setting new password (after challenge)
exports.setNewPassword = async (req, res) => {
  const { email, newPassword, session, phone_number, given_name, family_name } = req.body;

  // Input validation
  if (!email || !newPassword || !session || !phone_number || !given_name || !family_name) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const params = {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ClientId: process.env.ADMIN_CLIENT_ID,
    ChallengeResponses: {
      USERNAME: email,
      NEW_PASSWORD: newPassword,
      'userAttributes.phone_number': phone_number,
      'userAttributes.given_name': given_name,
      'userAttributes.family_name': family_name,
    },
    Session: session,
  };

  try {
    const command = new RespondToAuthChallengeCommand(params);
    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult) {
      const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;
      const decodedIdToken = JSON.parse(Buffer.from(IdToken.split('.')[1], 'base64').toString('utf-8'));
      const cognitoUserSub = decodedIdToken.sub;

      let user = await Admin.findOne({ email });
      if (!user) {
        user = new Admin({
          first_name: given_name,
          last_name: family_name,
          email,
          phone_number,
          cognitoUserSub,
        });
        await user.save();
      }

      return res.status(200).send({
        idToken: IdToken,
        accessToken: AccessToken,
        refreshToken: RefreshToken,
      });
    } else {
      return res.status(400).send({ error: 'Authentication failed: Unable to set new password.' });
    }
  } catch (error) {
    console.error('Error setting new password:', error);
    res.status(400).send({ error: error.message });
  }
};

// Admin Registration
exports.registerAdmin = async (req, res) => {
  const { first_name, last_name, email, password, phone_number } = req.body;

  // Input validation
  if (!first_name || !last_name || !email || !password || !phone_number) {
    return res.status(400).json({ error: 'Please fill in all fields' });
  }

  const params = {
    ClientId: process.env.ADMIN_CLIENT_ID,
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
    const existingUser = await Admin.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const command = new SignUpCommand(params);
    const cognitoResponse = await cognitoClient.send(command);

    const newUser = new Admin({
      first_name,
      last_name,
      email,
      phone_number,
      cognitoUserSub: cognitoResponse.UserSub,
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during admin registration:', error);
    if (error.name === 'UsernameExistsException') {
      return res.status(400).json({ error: 'User already exists.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// Confirm Admin Registration
exports.confirmAdminRegistration = async (req, res) => {
  const { email, confirmationCode, password } = req.body;

  // Input validation
  if (!email || !confirmationCode || !password) {
    return res.status(400).json({ error: 'Email, confirmation code, and password are required.' });
  }

  const confirmParams = {
    ClientId: process.env.ADMIN_CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  };

  try {
    const confirmCommand = new ConfirmSignUpCommand(confirmParams);
    await cognitoClient.send(confirmCommand);

    const authParams = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.ADMIN_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    const authCommand = new InitiateAuthCommand(authParams);
    const authResponse = await cognitoClient.send(authCommand);

    if (authResponse.AuthenticationResult) {
      const { IdToken, AccessToken, RefreshToken } = authResponse.AuthenticationResult;
      return res.status(200).send({ idToken: IdToken, accessToken: AccessToken, refreshToken: RefreshToken });
    } else {
      return res.status(400).json({ error: 'Authentication failed: No valid tokens received from the backend.' });
    }
  } catch (error) {
    console.error('Error during admin confirmation:', error);
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

// Resend Confirmation Code
exports.resendConfirmationCode = async (req, res) => {
  const { email } = req.body;

  // Input validation
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const params = {
    ClientId: process.env.ADMIN_CLIENT_ID,
    Username: email,
  };

  try {
    const command = new ResendConfirmationCodeCommand(params);
    await cognitoClient.send(command);
    res.status(200).json({ message: 'Confirmation email resent successfully.' });
  } catch (error) {
    console.error('Error resending confirmation code:', error);
    if (error.name === 'UserNotFoundException') {
      return res.status(400).json({ error: 'User not found. Please register first.' });
    } else if (error.name === 'InvalidParameterException') {
      return res.status(400).json({ error: 'Invalid parameters. Please check the email format.' });
    } else if (error.name === 'NotAuthorizedException') {
      return res.status(400).json({ error: 'User is already confirmed.' });
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
    ClientId: process.env.ADMIN_CLIENT_ID,
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

// Get Admin Profile
exports.getAdminProfile = [
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const admin = await Admin.findOne({ cognitoUserSub });
      if (!admin) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json(admin);
    } catch (error) {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
];

// Get All Hosts
exports.getAllHosts = [
  authenticateToken,
  async (req, res) => {
    try {
      const hosts = await Admin.find().select('-password -cognitoUserSub');
      res.status(200).json(hosts);
    } catch (error) {
      console.error('Error retrieving hosts:', error);
      res.status(500).json({ error: 'Failed to retrieve hosts' });
    }
  },
];

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  // Input validation
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const params = {
    ClientId: process.env.ADMIN_CLIENT_ID,
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
    ClientId: process.env.ADMIN_CLIENT_ID,
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
