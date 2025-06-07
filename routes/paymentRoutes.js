const express = require('express');
const router = express.Router();
const {
    initializePayment,
    handleWebhook,
    verifyPayment
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { paymentLimiter, readLimiter } = require('../middleware/rateLimiter');

// Initialize payment - very strict rate limiting
router.post('/initialize', protect, paymentLimiter, initializePayment);

// Paystack webhook
router.post('/webhook', handleWebhook);

// Verify payment status - lenient rate limiting
router.get('/verify/:reference', protect, readLimiter, verifyPayment);

module.exports = router; 