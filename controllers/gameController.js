const Game = require('../models/Game');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const mongoose = require('mongoose'); 

// Configure JWKS client
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`
});

// Helper function to get the signing key
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error("Error getting signing key:", err);
      return callback(err);
    }
    
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}


// Create a new game
exports.createGame = async (req, res) => {
  const { teams, stadium, host, result, date, duration, type } = req.body;

  if (!teams || !stadium || !host || !date || !duration || !type) {
    return res.status(400).json({ error: 'All required fields must be provided.' });
  }

  try {
    const newGame = new Game({
      teams,
      stadium,
      host,
      result,
      date,
      duration,
      type
    });

    await newGame.save();
    res.status(201).json(newGame);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Server error while creating the game.' });
  }
};



// Fetch all games (public route)
exports.getAllGames = async (req, res) => {
  try {
    const games = await Game.find(); // Fetch all games from the database
    res.status(200).json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Server error while fetching games.' });
  }
};

exports.signupForGame = async (req, res) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  // Verify JWT
  jwt.verify(token.split(' ')[1], getKey, {}, async (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ error: 'Token verification failed' });
    }

    const cognitoUserSub = decoded.sub; // Extract user ID (sub) from the token

    try {
      // Retrieve the user based on the Cognito User Sub (user ID)
      const user = await User.findOne({ cognitoUserSub });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Retrieve the game ID from the request parameters
      const { gameId } = req.params;

      if (!gameId) {
        return res.status(400).json({ error: 'No game ID provided' });
      }

      // Find the game
      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      const userObject = {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        position: user.position,
        yellow_cards: user.yellow_cards,
        red_cards: user.red_cards,
        goals: user.goals
      };

      // Check if the user is already signed up for this game
      const isAlreadySignedUp = game.teams[0].some(player => player && player.email === user.email) ||
                                game.teams[1].some(player => player && player.email === user.email);

      if (isAlreadySignedUp) {
        return res.status(400).json({ error: 'You are already signed up for this game.' });
      }

      let assigned = false;

      // Look for an empty slot (null) in the first team
      for (let i = 0; i < game.teams[0].length; i++) {
        if (game.teams[0][i] === null) {
          game.teams[0][i] = userObject;
          assigned = true;
          break;
        }
      }

      // If no slot in the first team, check the second team
      if (!assigned) {
        for (let i = 0; i < game.teams[1].length; i++) {
          if (game.teams[1][i] === null) {
            game.teams[1][i] = userObject;
            assigned = true;
            break;
          }
        }
      }

      // If both teams are full
      if (!assigned) {
        return res.status(400).json({ error: 'Game is full' });
      }

      // Save the updated game
      await game.save();

      // Add the game to the user's list of played games (if this is your user structure)
      user.games.push({
        gameId: game._id,
        date: game.date,
        stadium: game.stadium
      });

      // Update the user's games_played field
      user.games_played += 1;

      await user.save();

      // Respond with success
      res.status(200).json({ message: 'Signed up for the game successfully' });
    } catch (error) {
      console.error('Error signing up for the game:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });
};

// Fetch a specific game by ID (public route)
exports.getGameById = async (req, res) => {
  const { gameId } = req.params;

  // Validate the gameId if using MongoDB
  if (!mongoose.Types.ObjectId.isValid(gameId)) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.status(200).json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Server error while fetching the game.' });
  }
};

