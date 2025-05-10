const express = require('express');
const router = express.Router();
const {
    getParkingLots,
    getParkingLot,
    createParkingLot,
    updateParkingLot,
    deleteParkingLot,
    searchParkingLots
} = require('../controllers/parkingLotController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Search parking lots by location and price
router.get('/search', searchParkingLots);

// Get all parking lots
router.get('/', getParkingLots);

// Get single parking lot
router.get('/:id', getParkingLot);

// Create parking lot route (with image upload)
router.post('/', protect, upload.array('images', 5), createParkingLot);

// Update parking lot route (with image upload)
router.put('/:id', protect, upload.array('images', 5), updateParkingLot);

// Delete parking lot route
router.delete('/:id', protect, deleteParkingLot);

module.exports = router; 