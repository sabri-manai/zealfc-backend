// controllers/gameController.js

const Game = require('../models/Game');
const Stadium = require('../models/Stadium');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { sendEmail } = require('../services/emailService');
const mongoose = require('mongoose');

// Import the authenticateToken middleware
const { authenticateToken } = require('../utils/auth');

// Create a new game
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
      host,
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
    const games = await Game.find();
    res.status(200).json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Server error while fetching games.' });
  }
};

// Fetch a specific game by ID (public route)
exports.getGameById = async (req, res) => {
  const { gameId } = req.params;

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

// Signup player for a game
exports.signupForGame = [
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const user = await User.findOne({ cognitoUserSub });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { gameId } = req.params;

      if (!gameId) {
        return res.status(400).json({ error: 'No game ID provided' });
      }

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
        goals: user.goals,
      };

      // Check if the user is already signed up for this game
      const isAlreadySignedUp =
        game.teams[0].some((player) => player && player.email === user.email) ||
        game.teams[1].some((player) => player && player.email === user.email);

      if (isAlreadySignedUp) {
        return res.status(400).json({ error: 'You are already signed up for this game.' });
      }

      // Remove the user from the waitlist if they're on it
      game.waitlist = game.waitlist.filter((waitlistUser) => waitlistUser.email !== user.email);

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

      // Add the game to the user's list of games
      user.games.push({
        gameId: game._id,
        date: game.date,
        stadium: game.stadium.name,
      });

      await user.save();

      // Send confirmation email
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Game Signup Confirmation',
        html: `<p>Hello ${user.first_name},</p><p>You have successfully signed up for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>.</p><p>Thank you for joining!</p><p>Best regards,<br>Your App Team</p>`,
        text: `Hello ${user.first_name},\n\nYou have successfully signed up for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}.\n\nThank you for joining!\n\nBest regards,\nYour App Team`,
      });

      res.status(200).json({ message: 'Signed up for the game successfully' });
    } catch (error) {
      console.error('Error signing up for the game:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },
];

// Cancel signup for a game
exports.cancelSignupForGame = [
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const user = await User.findOne({ cognitoUserSub });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { gameId } = req.params;

      if (!gameId || !mongoose.Types.ObjectId.isValid(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID' });
      }

      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      let removed = false;
      for (let i = 0; i < game.teams[0].length; i++) {
        if (game.teams[0][i] && game.teams[0][i].email === user.email) {
          game.teams[0][i] = null;
          removed = true;
          break;
        }
      }

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

      await game.save();

      // Remove the game from the user's list of games
      user.games = user.games.filter((g) => !g.gameId.equals(game._id));
      await user.save();

      // Send cancellation email
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Game Cancellation',
        html: `<p>Hello ${user.first_name},</p><p>You have successfully canceled your registration for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>.</p><p>Thank you!</p><p>Best regards,<br>Your App Team</p>`,
        text: `Hello ${user.first_name},\n\nYou have successfully canceled your registration for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}.\n\nThank you!\n\nBest regards,\nYour App Team`,
      });

      // Notify users in the waitlist
      if (game.waitlist && game.waitlist.length > 0) {
        await Promise.all(
          game.waitlist.map(async (waitlistUser) => {
            await sendEmail({
              to: { email: waitlistUser.email, name: `${waitlistUser.first_name} ${waitlistUser.last_name}` },
              subject: 'Spot Available for Game',
              html: `<p>Hello ${waitlistUser.first_name},</p><p>A spot has opened up for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>.</p><p>Sign up quickly if you wish to join!</p><p>Best regards,<br>Your App Team</p>`,
              text: `Hello ${waitlistUser.first_name},\n\nA spot has opened up for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}.\n\nSign up quickly if you wish to join!\n\nBest regards,\nYour App Team`,
            });
          })
        );
      }

      res.status(200).json({ message: 'Successfully canceled signup for the game.' });
    } catch (error) {
      console.error('Error canceling signup for the game:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },
];

// Update game status
exports.updateGameStatus = [
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const { gameId } = req.params;
      const { status, stats } = req.body;

      if (!['upcoming', 'in progress', 'finished'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value.' });
      }

      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Check if the user is an admin or the host of the game
      const adminUser = await Admin.findOne({ cognitoUserSub });
      if (!adminUser && game.host.cognitoUserSub !== cognitoUserSub) {
        return res.status(403).json({ error: 'Forbidden: You are not authorized to perform this action' });
      }

      // Update the game status
      game.status = status;

      // If stats are provided, update player statistics
      if (stats && Array.isArray(stats)) {
        stats.forEach((stat) => {
          const player = game.teams.flat().find((p) => p && p.email === stat.email);
          if (player) {
            if (typeof stat.goals === 'number') {
              player.goals = (player.goals || 0) + stat.goals;
            }
            if (typeof stat.assists === 'number') {
              player.assists = (player.assists || 0) + stat.assists;
            }
            if (typeof stat.yellow_cards === 'number') {
              player.yellow_cards = (player.yellow_cards || 0) + stat.yellow_cards;
            }
            if (typeof stat.red_cards === 'number') {
              player.red_cards = (player.red_cards || 0) + stat.red_cards;
            }
            player.attendance = stat.attendance || 'absent';
          }
        });
      }

      // After updating player stats, calculate team goals
      const teamGoals = [0, 0];
      game.teams.forEach((team, teamIndex) => {
        team.forEach((playerData) => {
          if (playerData && ['present', 'late'].includes(playerData.attendance)) {
            teamGoals[teamIndex] += playerData.goals || 0;
          }
        });
      });

      // Determine and set the game result
      let gameOutcome;
      if (teamGoals[0] > teamGoals[1]) {
        gameOutcome = 'Team 1 wins';
      } else if (teamGoals[0] < teamGoals[1]) {
        gameOutcome = 'Team 2 wins';
      } else {
        gameOutcome = 'Draw';
      }

      game.result = {
        team1Goals: teamGoals[0],
        team2Goals: teamGoals[1],
        outcome: gameOutcome,
      };

      await game.save();

      // Aggregate stats for users if game is finished
      if (status === 'finished') {
        await exports.aggregateGameStats(gameId, teamGoals, gameOutcome);
      }

      res.status(200).json({
        message: `Game status updated to ${status} and stats saved.`,
        game,
      });
    } catch (error) {
      console.error('Error updating game status and stats:', error);
      res.status(500).json({ error: 'Server error while updating game status and stats.' });
    }
  },
];

// Aggregate stats after game ends
exports.aggregateGameStats = async (gameId, teamGoals, gameOutcome) => {
  try {
    const game = await Game.findById(gameId);
    if (!game || game.status !== 'finished') {
      throw new Error('Game not found or not finished.');
    }

    // Determine the game result for each team
    let teamResults = [];
    if (teamGoals[0] > teamGoals[1]) {
      teamResults = ['win', 'loss'];
    } else if (teamGoals[0] < teamGoals[1]) {
      teamResults = ['loss', 'win'];
    } else {
      teamResults = ['draw', 'draw'];
    }

    // Loop through both teams and update each player's stats in User model
    for (let teamIndex = 0; teamIndex < game.teams.length; teamIndex++) {
      const team = game.teams[teamIndex];
      const teamResult = teamResults[teamIndex];

      for (const playerData of team) {
        if (playerData && ['present', 'late'].includes(playerData.attendance)) {
          const user = await User.findOne({ email: playerData.email });
          if (user) {
            // Update attendance count
            user.attendance_count = (user.attendance_count || 0) + 1;

            // Update games played
            user.games_played += 1;

            // Update each user's stats based on their performance in the game
            user.goals += playerData.goals || 0;
            user.assists += playerData.assists || 0;
            user.yellow_cards += playerData.yellow_cards || 0;
            user.red_cards += playerData.red_cards || 0;

            // Assign points based on game result
            if (teamResult === 'win') {
              user.points += 3;
            } else if (teamResult === 'draw') {
              user.points += 1;
            }

            // Increment late count if attendance is 'late'
            if (playerData.attendance === 'late') {
              user.late_count = (user.late_count || 0) + 1;
            }

            // Save the user's updated stats
            await user.save();
          }
        } else if (playerData && playerData.attendance === 'absent') {
          // Record absence
          const user = await User.findOne({ email: playerData.email });
          if (user) {
            user.absence_count = (user.absence_count || 0) + 1;
            await user.save();
          }
        }
      }
    }

    console.log(`Game stats aggregated successfully for game ID: ${gameId}`);
  } catch (error) {
    console.error('Error aggregating game stats:', error);
  }
};

// Fetch upcoming games
exports.fetchUpcomingGames = async (req, res) => {
  try {
    const today = new Date();
    const games = await Game.find({ date: { $gte: today }, status: 'upcoming' })
      .populate('stadium')
      .sort({ date: 1, time: 1 });

    res.status(200).json(games);
  } catch (error) {
    console.error('Error fetching upcoming games:', error);
    res.status(500).json({ error: 'Server error while fetching upcoming games.' });
  }
};

// Add user to the waitlist
exports.joinWaitlist = [
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const user = await User.findOne({ cognitoUserSub });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { gameId } = req.params;
      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Check if user is already in teams or waitlist
      const isAlreadyInGame =
        game.teams.some((team) => team.some((player) => player && player.email === user.email)) ||
        game.waitlist.some((waitlistUser) => waitlistUser.email === user.email);

      if (isAlreadyInGame) {
        return res.status(400).json({ error: 'You are already signed up for this game or on the waitlist.' });
      }

      game.waitlist.push({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        position: user.position,
      });

      await game.save();

      // Send confirmation email about waitlist status
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Waitlist Confirmation for Game',
        html: `<p>Hello ${user.first_name},</p><p>You have been added to the waitlist for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>. You will receive an email if a spot becomes available.</p><p>Best regards,<br>Your App Team</p>`,
        text: `Hello ${user.first_name},\n\nYou have been added to the waitlist for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}. You will receive an email if a spot becomes available.\n\nBest regards,\nYour App Team`,
      });

      res.status(200).json({ message: 'You have been added to the waitlist.' });
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
];

// Remove user from the waitlist
exports.leaveWaitlist = [
  authenticateToken,
  async (req, res) => {
    const cognitoUserSub = req.user.sub;

    try {
      const user = await User.findOne({ cognitoUserSub });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { gameId } = req.params;
      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Remove user from the waitlist
      game.waitlist = game.waitlist.filter((waitlistUser) => waitlistUser.email !== user.email);
      await game.save();

      // Send confirmation email about leaving the waitlist
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Removed from Waitlist for Game',
        html: `<p>Hello ${user.first_name},</p><p>You have been removed from the waitlist for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>. You will no longer receive notifications about available spots for this game.</p><p>Best regards,<br>Your App Team</p>`,
        text: `Hello ${user.first_name},\n\nYou have been removed from the waitlist for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}. You will no longer receive notifications about available spots for this game.\n\nBest regards,\nYour App Team`,
      });

      res.status(200).json({ message: 'You have been removed from the waitlist.' });
    } catch (error) {
      console.error('Error removing from waitlist:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
];
