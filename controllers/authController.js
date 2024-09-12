const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");
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
    res.status(400).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
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

    res.status(200).send({
      idToken: IdToken,
      accessToken: AccessToken,
      refreshToken: RefreshToken,
    });
  } catch (error) {
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
