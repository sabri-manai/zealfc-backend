const Game = require('../models/Game');
const Stadium = require('../models/Stadium');
const User = require('../models/User');
const Admin = require('../models/Admin');

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const mongoose = require('mongoose'); 
const { sendEmail } = require('../services/emailService');

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


// controllers/gameController.js
exports.createGame = async (req, res) => {
  const { stadiumId, hostId, date, time, duration, type } = req.body;

  // Validate required fields
  if (!stadiumId || !hostId || !date || !time || !duration || !type) {
    return res.status(400).json({ error: 'All required fields must be provided.' });
  }

  try {
    const stadium = await Stadium.findById(stadiumId).lean();
    if (!stadium) {
      return res.status(404).json({ error: 'Stadium not found.' });
    }

    const host = await Admin.findById(hostId)
      .select('-cognitoUserSub -role -permissions -createdAt')
      .lean();
    if (!host) {
      return res.status(404).json({ error: 'Host not found.' });
    }

    // Initialize teams
    const teamSize = Math.floor(stadium.capacity / 2);
    const teams = [Array(teamSize).fill(null), Array(teamSize).fill(null)];

    // Create a new game with embedded stadium and host data
    const newGame = new Game({
      teams,
      stadium,
      host, // Use 'host' instead of 'hosts'
      date: new Date(date),
      time,
      duration,
      type,
      status: 'upcoming',
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
            // Send confirmation email
      await sendEmail({
          to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
          subject: 'Game Signup Confirmation',
          html: `<p>Hello ${user.first_name},</p><p>You have successfully signed up for the game at <strong>${game.stadium.name}</strong> on <strong>${new Date(game.date).toLocaleString()}</strong>.</p><p>Thank you for joining!</p><p>Best regards,<br>Your App Team</p>`,
          text: `Hello ${user.first_name},\n\nYou have successfully signed up for the game at ${game.stadium.name} on ${new Date(game.date).toLocaleString()}.\n\nThank you for joining!\n\nBest regards,\nYour App Team`
      });

      // Respond with success
      res.status(200).json({ message: 'Signed up for the game successfully' });
    } catch (error) {
      console.error('Error signing up for the game:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });
};


// Cancel signup for a game
exports.cancelSignupForGame = async (req, res) => {
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

      // Validate the gameId if using MongoDB
      if (!mongoose.Types.ObjectId.isValid(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID' });
      }

      // Find the game
      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Remove user from the teams
      let removed = false;

      // Remove from team 0
      for (let i = 0; i < game.teams[0].length; i++) {
        if (game.teams[0][i] && game.teams[0][i].email === user.email) {
          game.teams[0][i] = null;
          removed = true;
          break;
        }
      }

      // Remove from team 1 if not found in team 0
      if (!removed) {
        for (let i = 0; i < game.teams[1].length; i++) {
          if (game.teams[1][i] && game.teams[1][i].email === user.email) {
            game.teams[1][i] = null;
            removed = true;
            break;
          }
        }
      }

      if (!removed) {
        return res.status(400).json({ error: 'User is not signed up for this game.' });
      }

      // Save the updated game
      await game.save();

      // Remove the game from the user's games list
      user.games = user.games.filter(g => !g.gameId.equals(game._id));

      // Decrement the user's games_played field
      if (user.games_played > 0) {
        user.games_played -= 1;
      }

      await user.save();
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Game Cancelation',
        html: `<p>Hello ${user.first_name},</p><p>You have successfully canceled your registration for the game at <strong>${game.stadium.name}</strong> on <strong>${new Date(game.date).toLocaleString()}</strong>.</p><p>Thank you !</p><p>Best regards,<br>Zeal Team</p>`,
        text: `Hello ${user.first_name},\n\nYou have successfully canceled your registration for the game at ${game.stadium.name} on ${new Date(game.date).toLocaleString()}.\n\nThank you!\n\nBest regards,\nZeal Team`
    });

      // Respond with success
      res.status(200).json({ message: 'Successfully canceled signup for the game.' });
    } catch (error) {
      console.error('Error canceling signup for the game:', error);
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

// Update game status
exports.updateGameStatus = async (req, res) => {
  const { gameId } = req.params;
  const { status } = req.body;

  // Validate the status value
  if (!['upcoming', 'in progress', 'finished'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    game.status = status;
    await game.save();

    res.status(200).json({ message: `Game status updated to ${status}.`, game });
  } catch (error) {
    console.error('Error updating game status:', error);
    res.status(500).json({ error: 'Server error while updating game status.' });
  }
};


// Update player stats
exports.updatePlayerStats = async (req, res) => {
  const { gameId } = req.params;
  const { teamIndex, playerEmail, goals, assists, yellow_cards, red_cards } = req.body;

  if (teamIndex !== 0 && teamIndex !== 1) {
    return res.status(400).json({ error: 'Invalid team index. Must be 0 or 1.' });
  }

  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const player = game.teams[teamIndex].find(p => p.email === playerEmail);
    if (!player) {
      return res.status(404).json({ error: 'Player not found in the specified team.' });
    }

    // Update stats if provided
    if (goals !== undefined) player.goals += goals;
    if (assists !== undefined) player.assists += assists;
    if (yellow_cards !== undefined) player.yellow_cards += yellow_cards;
    if (red_cards !== undefined) player.red_cards += red_cards;

    await game.save();

    res.status(200).json({ message: 'Player stats updated successfully.', player });
  } catch (error) {
    console.error('Error updating player stats:', error);
    res.status(500).json({ error: 'Server error while updating player stats.' });
  }
};

// Aggregate stats after game ends
exports.aggregateGameStats = async (gameId) => {
  try {
    const game = await Game.findById(gameId);
    if (!game || game.status !== 'finished') {
      throw new Error('Game not found or not finished.');
    }

    // Loop through both teams
    for (const team of game.teams) {
      for (const playerData of team) {
        if (playerData) {
          const user = await User.findOne({ email: playerData.email });
          if (user) {
            user.games_played += 1;
            user.goals += playerData.goals;
            user.assists += playerData.assists || 0;
            user.yellow_cards += playerData.yellow_cards;
            user.red_cards += playerData.red_cards;

            await user.save();
          }
        }
      }
    }
  } catch (error) {
    console.error('Error aggregating game stats:', error);
  }
};

// Fetch upcoming games
exports.fetchUpcomingGames = async (req, res) => {
  try {
    const today = new Date();
    const games = await Game.find({ date: { $gte: today }, status: 'upcoming' })
      .populate('stadium') // Populate stadium details
      .sort({ date: 1, time: 1 });

    res.status(200).json(games);
  } catch (error) {
    console.error('Error fetching upcoming games:', error);
    res.status(500).json({ error: 'Server error while fetching upcoming games.' });
  }
};
