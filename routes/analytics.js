const express = require('express');
const router = express.Router();
const {
    getCompanySummary,
    getRevenueChart,
    getLiveOccupancy,
    getDetailedAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

// All analytics routes require authentication
router.use(protect);

// Company analytics routes
router.get('/company/summary', getCompanySummary);
router.get('/company/revenue-chart', getRevenueChart);
router.get('/company/occupancy/live', getLiveOccupancy);
router.get('/company/detailed', getDetailedAnalytics);

module.exports = router; 