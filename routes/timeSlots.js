const express = require('express');
const router = express.Router();
const {
    bookTimeSlot,
    getAvailableTimeSlots,
    checkTimeSlotAvailability,
    cancelTimeSlot,
    getUserBookingHistory,
    getUserBookingHistoryGrouped,
    getUserBookingStats,
    getCompanyBookingHistory,
    getCompanyBookingStats,
    getUserFilterOptions,
    getCompanyFilterOptions
} = require('../controllers/timeSlotController');
const { protect } = require('../middleware/authMiddleware');
const { readLimiter, createLimiter } = require('../middleware/rateLimiter');

// Book a time slot - create limiter
router.post('/', protect, createLimiter, bookTimeSlot);

// Check availability for specific time range - read limiter
router.get('/check-availability/:parkingLotId', readLimiter, checkTimeSlotAvailability);

// Get available time slots for a parking lot - read limiter
router.get('/available/:parkingLotId', readLimiter, getAvailableTimeSlots);

// Cancel a time slot booking - create limiter
router.put('/:id/cancel', protect, createLimiter, cancelTimeSlot);

// Get user's booking history - read limiter
router.get('/history', protect, readLimiter, getUserBookingHistory);

// Get user's booking history grouped by time status - read limiter
router.get('/history-grouped', protect, readLimiter, getUserBookingHistoryGrouped);

// Get user's booking statistics - read limiter
router.get('/stats', protect, readLimiter, getUserBookingStats);

// Get company's booking history - read limiter
router.get('/company/history', protect, readLimiter, getCompanyBookingHistory);

// Get company's booking statistics - read limiter
router.get('/company/stats', protect, readLimiter, getCompanyBookingStats);

// Get filter options for user bookings - read limiter
router.get('/filters/user', protect, readLimiter, getUserFilterOptions);

// Get filter options for company bookings - read limiter
router.get('/filters/company', protect, readLimiter, getCompanyFilterOptions);

module.exports = router; 