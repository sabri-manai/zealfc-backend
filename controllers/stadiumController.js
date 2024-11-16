// controllers/stadiumController.js

const Stadium = require('../models/Stadium');
const Admin = require('../models/Admin');
const { authenticateToken } = require('../utils/auth');

// Get all stadiums
exports.getAllStadiums = async (req, res) => {
  try {
    const stadiums = await Stadium.find().lean();
    res.json(stadiums);
  } catch (err) {
    console.error('Error fetching stadiums:', err);
    res.status(500).json({ message: 'Server error while fetching stadiums.' });
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
    console.error('Error fetching stadium:', err);
    res.status(500).json({ message: 'Server error while fetching stadium.' });
  }
};

// Create new stadium (protected)
exports.createStadium = [
  authenticateToken,
  async (req, res) => {
    const {
      name,
      address,
      capacity,
      manager,
      phone,
      email,
      hosts,
      slots,
      amenities,
      type,
      surface,
    } = req.body;

    // Validate required fields
    if (!name || !address || !capacity || !manager || !phone || !email) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }

    // Validate slots
    if (slots && slots.length > 0) {
      for (const slot of slots) {
        if (!slot.dayOfWeek || !slot.startTime || !slot.endTime || !slot.startDate || !slot.endDate) {
          return res.status(400).json({ message: 'All slot fields are required.' });
        }
      }
    }

    try {
      // Fetch full host details excluding sensitive fields
      const fullHostDetails = await Admin.find({ _id: { $in: hosts } })
        .select('_id email first_name last_name phone_number')
        .lean();

      const stadium = new Stadium({
        name,
        address,
        capacity,
        manager,
        phone,
        email,
        hosts: fullHostDetails,
        slots,
        amenities,
        type,
        surface,
      });

      const newStadium = await stadium.save();
      res.status(201).json(newStadium);
    } catch (error) {
      console.error('Error creating stadium:', error);
      res.status(500).json({ message: 'Server error while creating the stadium.' });
    }
  },
];

// Update stadium (protected)
exports.updateStadium = [
  authenticateToken,
  async (req, res) => {
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
      console.error('Error updating stadium:', err);
      res.status(400).json({ message: 'Error updating stadium.' });
    }
  },
];

// Delete stadium (protected)
exports.deleteStadium = [
  authenticateToken,
  async (req, res) => {
    try {
      const stadium = await Stadium.findById(req.params.id);
      if (!stadium) {
        return res.status(404).json({ message: 'Stadium not found' });
      }

      await stadium.remove();
      res.json({ message: 'Stadium deleted' });
    } catch (err) {
      console.error('Error deleting stadium:', err);
      res.status(500).json({ message: 'Server error while deleting stadium.' });
    }
  },
];
