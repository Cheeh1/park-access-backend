const express = require('express');
const router = express.Router();
const {
    getParkingLots,
    getMyParkingLots,
    getParkingLot,
    createParkingLot,
    updateParkingLot,
    deleteParkingLot,
    searchParkingLots
} = require('../controllers/parkingLotController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');
const { readLimiter, createLimiter } = require('../middleware/rateLimiter');

// Search parking lots by location and price - read limiter
router.get('/search', readLimiter, searchParkingLots);

// Get my parking lots (company-specific) - protected route
router.get('/my-lots', protect, readLimiter, getMyParkingLots);

// Get all parking lots - read limiter
router.get('/', readLimiter, getParkingLots);

// Get single parking lot - read limiter
router.get('/:id', readLimiter, getParkingLot);

// Create parking lot route (with image upload) - create limiter
router.post('/', protect, createLimiter, upload.array('images', 5), createParkingLot);

// Update parking lot route (with image upload) - create limiter
router.put('/:id', protect, createLimiter, upload.array('images', 5), updateParkingLot);

// Delete parking lot route - create limiter
router.delete('/:id', protect, createLimiter, deleteParkingLot);

module.exports = router; 