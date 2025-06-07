
const express = require('express');
const router = express.Router();
const { register, login, getMe, changePassword, updateUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, createLimiter } = require('../middleware/rateLimiter');

// Register route - strict rate limiting
router.post('/register', authLimiter, register);

// Login route - strict rate limiting
router.post('/login', authLimiter, login);

// Get current user route
router.get('/me', protect, getMe);

// Change password route - moderate rate limiting
router.put('/change-password', protect, createLimiter, changePassword);

// Update user profile route - moderate rate limiting
router.put('/update-profile', protect, createLimiter, updateUser);

module.exports = router;