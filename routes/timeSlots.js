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

// Book a time slot
router.post('/', protect, bookTimeSlot);

// Check availability for specific time range
router.get('/check-availability/:parkingLotId', checkTimeSlotAvailability);

// Get available time slots for a parking lot
router.get('/available/:parkingLotId', getAvailableTimeSlots);

// Cancel a time slot booking
router.put('/:id/cancel', protect, cancelTimeSlot);

// Get user's booking history
router.get('/history', protect, getUserBookingHistory);

// Get user's booking history grouped by time status
router.get('/history-grouped', protect, getUserBookingHistoryGrouped);

// Get user's booking statistics
router.get('/stats', protect, getUserBookingStats);

// Get company's booking history
router.get('/company/history', protect, getCompanyBookingHistory);

// Get company's booking statistics
router.get('/company/stats', protect, getCompanyBookingStats);

// Get filter options for user bookings
router.get('/filters/user', protect, getUserFilterOptions);

// Get filter options for company bookings
router.get('/filters/company', protect, getCompanyFilterOptions);

module.exports = router; 