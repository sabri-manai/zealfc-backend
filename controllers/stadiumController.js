// controllers/stadiumController.js
const Stadium = require('../models/Stadium');

// Get all stadiums
exports.getAllStadiums = async (req, res) => {
  try {
    const stadiums = await Stadium.find();
    res.json(stadiums);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get stadium by ID
exports.getStadiumById = async (req, res) => {
  try {
    const stadium = await Stadium.findById(req.params.id);
    if (!stadium) {
      return res.status(404).json({ message: 'Stadium not found' });
    }
    res.json(stadium);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create new stadium (protected)
exports.createStadium = async (req, res) => {
  const {
    name,
    address,
    capacity,
    manager,
    phone,
    email,
    hosts,
    price,
    slots,
    amenities,
    type,
    surface,
  } = req.body;

  // Optionally, you can get the user who is creating the stadium
  const creator = req.user; // Contains the decoded JWT payload

  const stadium = new Stadium({
    name,
    address,
    capacity,
    manager,
    phone,
    email,
    hosts,
    price,
    slots,
    amenities,
    type,
    surface,
    createdBy: creator.sub, // You can store the user's Cognito sub if you add this field to your Stadium model
  });

  try {
    const newStadium = await stadium.save();
    res.status(201).json(newStadium);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update stadium
exports.updateStadium = async (req, res) => {
  try {
    const stadium = await Stadium.findById(req.params.id);
    if (!stadium) {
      return res.status(404).json({ message: 'Stadium not found' });
    }

    Object.keys(req.body).forEach((key) => {
      stadium[key] = req.body[key];
    });

    const updatedStadium = await stadium.save();
    res.json(updatedStadium);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete stadium
exports.deleteStadium = async (req, res) => {
  try {
    const stadium = await Stadium.findById(req.params.id);
    if (!stadium) {
      return res.status(404).json({ message: 'Stadium not found' });
    }

    await stadium.remove();
    res.json({ message: 'Stadium deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
