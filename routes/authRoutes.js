
const express = require('express');
const router = express.Router();
const { register, login, getMe, changePassword, updateUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Register route
router.post('/register', register);

// Login route
router.post('/login', login);

// Get current user route
router.get('/me', protect, getMe);

// Change password route
router.put('/change-password', protect, changePassword);

// Update user profile route
router.put('/update-profile', protect, updateUser);

module.exports = router;