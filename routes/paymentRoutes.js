const express = require('express');
const router = express.Router();
const {
    initializePayment,
    handleWebhook,
    verifyPayment
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Initialize payment
router.post('/initialize', protect, initializePayment);

// Paystack webhook
router.post('/webhook', handleWebhook);

// Verify payment status
router.get('/verify/:reference', protect, verifyPayment);

module.exports = router; 