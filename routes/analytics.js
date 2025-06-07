const express = require('express');
const router = express.Router();
const {
    getCompanySummary,
    getRevenueChart,
    getLiveOccupancy,
    getDetailedAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { readLimiter } = require('../middleware/rateLimiter');

// All analytics routes require authentication
router.use(protect);

// Company analytics routes - read limiter applied
router.get('/company/summary', readLimiter, getCompanySummary);
router.get('/company/revenue-chart', readLimiter, getRevenueChart);
router.get('/company/occupancy/live', readLimiter, getLiveOccupancy);
router.get('/company/detailed', readLimiter, getDetailedAnalytics);

module.exports = router; 