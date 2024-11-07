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
    name, address, capacity, 
    manager, phone, email, 
    hosts, slots, amenities, 
    type, surface,
  } = req.body;

  // Validate required fields before creating a stadium
  if (!name || !address || !capacity || !manager || !phone || !email ) {
    return res.status(400).json({ message: 'All required fields must be provided.' });
  }

  // Check slot details for each slot in the slots array
  if (slots && slots.length > 0) {
    for (const slot of slots) {
      if (!slot.dayOfWeek || !slot.startTime || !slot.endTime || !slot.startDate || !slot.endDate) {
        return res.status(400).json({ message: 'All slot fields (dayOfWeek, startTime, endTime, startDate, endDate) are required.' });
      }
    }
  }

  const stadium = new Stadium({
    name, address, capacity, 
    manager, phone, email, hosts,
     slots, amenities, type, surface,
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
