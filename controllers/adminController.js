const { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand, SignUpCommand, ConfirmSignUpCommand, ResendConfirmationCodeCommand } = require("@aws-sdk/client-cognito-identity-provider");
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.ADMIN_AWS_REGION });
const Admin = require("../models/Admin");

// Admin Login
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ error: "Email and password are required." });
  }

  const params = {
    AuthFlow: "USER_PASSWORD_AUTH",
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
    if (error.name === 'UserNotConfirmedException') {
      return res.status(400).send({ error: "UserNotConfirmedException" });
    }
    res.status(400).send({ error: error.message });
  }
};

// Handle setting new password (after challenge)
exports.setNewPassword = async (req, res) => {
  const { email, newPassword, session, phone_number, given_name, family_name } = req.body;

  if (!email || !newPassword || !session || !phone_number || !given_name || !family_name) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const params = {
    ChallengeName: "NEW_PASSWORD_REQUIRED",
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
    res.status(400).send({ error: error.message });
  }
};

// User Registration
exports.register = async (req, res) => {
  const { first_name, last_name, email, password, phone_number } = req.body;

  if (!first_name || !last_name || !email || !password || !phone_number) {
    return res.status(400).json({ error: "Please fill in all fields" });
  }

  const params = {
    ClientId: process.env.ADMIN_CLIENT_ID,
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
    const existingUser = await Admin.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists." });
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
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Confirm User Registration
exports.confirm = async (req, res) => {
  const { email, confirmationCode, password } = req.body;

  if (!email || !confirmationCode || !password) {
    return res.status(400).json({ error: "Email, confirmation code, and password are required." });
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
      AuthFlow: "USER_PASSWORD_AUTH",
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
      return res.status(400).json({ error: "Authentication failed: No valid tokens received from the backend." });
    }
  } catch (error) {
    if (error.name === 'NotAuthorizedException') {
      return res.status(400).json({ error: "The confirmation code is incorrect or expired." });
    } else if (error.name === 'UserNotFoundException') {
      return res.status(400).json({ error: "User not found. Please register first." });
    } else if (error.name === 'ExpiredCodeException') {
      return res.status(400).json({ error: "The confirmation code has expired." });
    }
    res.status(400).json({ error: error.message });
  }
};

// Resend Confirmation Code
exports.resendConfirmation = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const params = {
    ClientId: process.env.ADMIN_CLIENT_ID,
    Username: email,
  };

  try {
    const command = new ResendConfirmationCodeCommand(params);
    await cognitoClient.send(command);
    res.status(200).json({ message: "Confirmation email resent successfully." });
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return res.status(400).json({ error: "User not found. Please register first." });
    } else if (error.name === 'InvalidParameterException') {
      return res.status(400).json({ error: "Invalid parameters. Please check the email format." });
    } else if (error.name === 'NotAuthorizedException') {
      return res.status(400).json({ error: "User is already confirmed." });
    }
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
    