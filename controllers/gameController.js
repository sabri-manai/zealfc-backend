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
      // Find the user associated with the cognitoUserSub
      const user = await User.findOne({ cognitoUserSub });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { gameId } = req.params;

      // Validate the gameId
      if (!mongoose.Types.ObjectId.isValid(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID provided' });
      }

      // Find the game using the provided gameId
      const game = await Game.findById(gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });

      // Check if the user has enough credits
      if (user.credits < 1) {
        return res.status(400).json({ error: 'Not enough credits to sign up for the game.' });
      }

      // Prepare the user object specific to this game
      const userObject = {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        position: user.position,
        yellow_cards: 0, // Reset stats for the game
        red_cards: 0,
        goals: 0,
        assists: 0,
        attendance: 'registered',
      };

      // Check if the user is already signed up for this game
      const isAlreadySignedUp = game.teams.some(team =>
        team.some(player => player && player.email === user.email)
      );
      if (isAlreadySignedUp) {
        return res.status(400).json({ error: 'You are already signed up for this game.' });
      }

      // Remove the user from the waitlist if they are on it
      game.waitlist = game.waitlist.filter(waitlistUser => waitlistUser.email !== user.email);

      // Assign the user to the first available slot in either team
      let assigned = false;
      for (let i = 0; i < game.teams[0].length; i++) {
        if (!game.teams[0][i]) {
          game.teams[0][i] = userObject;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        for (let i = 0; i < game.teams[1].length; i++) {
          if (!game.teams[1][i]) {
            game.teams[1][i] = userObject;
            assigned = true;
            break;
          }
        }
      }

      if (!assigned) return res.status(400).json({ error: 'Game is full' });

      // Deduct one credit from the user
      user.credits -= 1;

      // Mark the `teams` field as modified to ensure Mongoose tracks the change
      game.markModified('teams');
      await game.save();

      // Add the game to the user's list of games
      user.games = user.games || [];
      user.games.push({
        gameId: game._id,
        date: game.date,
        stadium: game.stadium.name,
        status: game.status,
        attendance: 'registered',
      });

      // Increment the user's games_played count
      user.games_played = (user.games_played || 0) + 1;
      await user.save();

      // Send confirmation email
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Game Signup Confirmation',
        html: `<p>Hello ${user.first_name},</p>
               <p>You have successfully signed up for the game at <strong>${game.stadium.name}</strong> on 
               <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>.</p>
               <p>One credit has been deducted from your account.</p>
               <p>Thank you for joining!</p>
               <p>Best regards,<br>Zealfc Team</p>`,
      });

      // Respond with success
      res.status(200).json({ message: 'Signed up for the game successfully. One credit has been deducted from your account.' });
    } catch (error) {
      console.error('Error signing up for the game:', error);

      // Explicitly log the error stack for debugging
      console.error(error.stack);

      // Respond with a server error
      res.status(500).json({ error: 'Server error' });
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
          game.teams[0][i] = null; // Use null instead of undefined
          removed = true;
          break;
        }
      }

      if (!removed) {
        for (let i = 0; i < game.teams[1].length; i++) {
          if (game.teams[1][i] && game.teams[1][i].email === user.email) {
            game.teams[1][i] = null; // Use null instead of undefined
            removed = true;
            break;
          }
        }
      }

      if (!removed) {
        return res.status(400).json({ error: 'User is not signed up for this game.' });
      }

      // Inform Mongoose that 'teams' field has been modified
      game.markModified('teams');

      // Save the updated game
      await game.save();

      // Remove the game from the user's list of games
      user.games = user.games.filter((g) => !g.gameId.equals(game._id));

      // Inform Mongoose that 'games' field has been modified
      user.markModified('games');

      // Check if cancellation is before 48 hours from game time
      const gameDateTime = new Date(`${game.date.toISOString().split('T')[0]}T${game.time}`);
      const now = new Date();
      const hoursDifference = (gameDateTime - now) / (1000 * 60 * 60);

      if (hoursDifference >= 48) {
        // Refund one credit to the user
        user.credits += 1;
      }

      // Save the updated user
      await user.save();

      // Send cancellation email
      await sendEmail({
        to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
        subject: 'Game Cancellation',
        html: `<p>Hello ${user.first_name},</p>
               <p>You have successfully canceled your registration for the game at <strong>${game.stadium.name}</strong> on 
               <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>.</p>
               ${hoursDifference >= 48 ? '<p>Your credit has been refunded.</p>' : ''}
               <p>Thank you!</p>
               <p>Best regards,<br>Zealfc Team</p>`,
        text: `Hello ${user.first_name},\n\nYou have successfully canceled your registration for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}.\n\n${hoursDifference >= 48 ? 'Your credit has been refunded.\n\n' : ''}Thank you!\n\nBest regards,\nZealfc Team`,
      });

      // Notify users in the waitlist
      if (game.waitlist && game.waitlist.length > 0) {
        await Promise.all(
          game.waitlist.map(async (waitlistUser) => {
            await sendEmail({
              to: { email: waitlistUser.email, name: `${waitlistUser.first_name} ${waitlistUser.last_name}` },
              subject: 'Spot Available for Game',
              html: `<p>Hello ${waitlistUser.first_name},</p><p>A spot has opened up for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>.</p><p>Sign up quickly if you wish to join!</p><p>Best regards,<br>Zealfc Team</p>`,
              text: `Hello ${waitlistUser.first_name},\n\nA spot has opened up for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}.\n\nSign up quickly if you wish to join!\n\nBest regards,\nZealfc Team`,
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

    // controllers/gameController.js
    exports.aggregateGameStats = async (gameId, teamGoals, gameOutcome) => {
      try {
        console.log(`Starting aggregation for game ID: ${gameId}`);
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
    
        // Loop through both teams and update user stats
        for (let teamIndex = 0; teamIndex < game.teams.length; teamIndex++) {
          const team = game.teams[teamIndex];
          const teamResult = teamResults[teamIndex];
    
          for (const playerData of team) {
            if (!playerData) continue;
    
            console.log(`Processing player: ${playerData.email}`);
    
            const user = await User.findOne({ email: playerData.email });
            if (!user) {
              console.warn(`User not found for email: ${playerData.email}`);
              continue;
            }
    
            if (['present', 'late'].includes(playerData.attendance)) {
              // Determine points earned in this game
              let pointsEarned = 0;
              if (teamResult === 'win') {
                pointsEarned = 3;
                user.wins = (user.wins || 0) + 1;
              } else if (teamResult === 'draw') {
                pointsEarned = 1;
                user.draws = (user.draws || 0) + 1;
              } else {
                user.losses = (user.losses || 0) + 1;
              }
    
              // Update user's total points
              user.points += pointsEarned;
    
              // Update user stats
              user.games_played += 1;
              user.goals += playerData.goals || 0;
              user.assists += playerData.assists || 0;
              user.yellow_cards += playerData.yellow_cards || 0;
              user.red_cards += playerData.red_cards || 0;
    
              // Update attendance counts
              user.attendance_count += 1;
              if (playerData.attendance === 'late') {
                user.late_count += 1;
              }
    
              // Update or add game entry
              let gameEntry = user.games.find((g) => g.gameId.equals(game._id));
              if (gameEntry) {
                // Update existing game entry
                gameEntry.pointsEarned = pointsEarned;
                gameEntry.goals = playerData.goals || 0;
                gameEntry.assists = playerData.assists || 0;
                gameEntry.yellow_cards = playerData.yellow_cards || 0;
                gameEntry.red_cards = playerData.red_cards || 0;
                gameEntry.attendance = playerData.attendance;
                gameEntry.result = teamResult;
                gameEntry.teamIndex = teamIndex;
                gameEntry.status = 'finished'; // Update the game status to finished
              } else {
                // Add new game entry
                user.games.push({
                  gameId: game._id,
                  date: game.date,
                  stadium: game.stadium.name,
                  pointsEarned: pointsEarned,
                  goals: playerData.goals || 0,
                  assists: playerData.assists || 0,
                  yellow_cards: playerData.yellow_cards || 0,
                  red_cards: playerData.red_cards || 0,
                  attendance: playerData.attendance,
                  result: teamResult,
                  teamIndex: teamIndex,
                  status: 'finished', // Add the status as finished
                });
              }
    
              // Save user
              await user.save();
              console.log(`Stats saved for user: ${user.email}`);
            } else if (playerData.attendance === 'absent') {
              // Record absence
              user.absence_count += 1;
    
              // Update or add game entry for absence
              let gameEntry = user.games.find((g) => g.gameId.equals(game._id));
              if (!gameEntry) {
                user.games.push({
                  gameId: game._id,
                  date: game.date,
                  stadium: game.stadium.name,
                  attendance: 'absent',
                  status: 'finished', // Add the status as finished
                });
              } else {
                gameEntry.attendance = 'absent';
                gameEntry.status = 'finished'; // Update the status to finished
              }
    
              await user.save();
              console.log(`Absence recorded for user: ${user.email}`);
            }
          }
        }
    
        console.log(`Aggregation completed for game ID: ${gameId}`);
      } catch (error) {
        console.error('Error in aggregateGameStats:', error);
        throw error;
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

          // Add game to user's games array with attendance 'waitlist' using set()
          user.set('games', [
            ...user.games,
            {
              gameId: game._id,
              date: game.date,
              stadium: game.stadium.name,
              status: game.status,
              attendance: 'waitlist',
            },
          ]);

          // Optionally, modify a top-level field to force change detection
          user.lastModified = new Date();
          await user.save();

          // Send confirmation email about waitlist status
          await sendEmail({
            to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
            subject: 'Waitlist Confirmation for Game',
            html: `<p>Hello ${user.first_name},</p><p>You have been added to the waitlist for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>. You will receive an email if a spot becomes available.</p><p>Best regards,<br>Zealfc Team</p>`,
            text: `Hello ${user.first_name},\n\nYou have been added to the waitlist for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}. You will receive an email if a spot becomes available.\n\nBest regards,\nZealfc Team`,
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

          // **Ensure user.games is initialized**
          user.games = user.games || [];

          // **Remove the game from the user's games array**
          user.games = user.games.filter((g) => !g.gameId.equals(game._id));

          // **Mark the 'games' field as modified**
          user.markModified('games');

          await user.save();

          // Send confirmation email about leaving the waitlist
          await sendEmail({
            to: { email: user.email, name: `${user.first_name} ${user.last_name}` },
            subject: 'Removed from Waitlist for Game',
            html: `<p>Hello ${user.first_name},</p><p>You have been removed from the waitlist for the game at <strong>${game.stadium.name}</strong> on <strong>${game.date.toLocaleDateString()} at ${game.time}</strong>. You will no longer receive notifications about available spots for this game.</p><p>Best regards,<br>Zealfc Team</p>`,
            text: `Hello ${user.first_name},\n\nYou have been removed from the waitlist for the game at ${game.stadium.name} on ${game.date.toLocaleDateString()} at ${game.time}. You will no longer receive notifications about available spots for this game.\n\nBest regards,\nZealfc Team`,
          });

          res.status(200).json({ message: 'You have been removed from the waitlist.' });
        } catch (error) {
          console.error('Error removing from waitlist:', error);
          res.status(500).json({ error: 'Server error' });
        }
      },
    ];
