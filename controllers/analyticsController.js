const TimeSlot = require('../models/timeSlot');
const ParkingLot = require('../models/parkingLot');

// @desc    Get company summary analytics
// @route   GET /api/analytics/company/summary
// @access  Private (Company only)
exports.getCompanySummary = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only companies can view analytics.'
            });
        }

        const { month, year } = req.query;
        
        // Get current date info
        const now = new Date();
        const currentYear = year ? parseInt(year) : now.getFullYear();
        const currentMonth = month ? parseInt(month) : now.getMonth() + 1;
        
        // Calculate date ranges
        const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
        const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        const previousMonthStart = new Date(currentYear, currentMonth - 2, 1);
        const previousMonthEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59);

        // Get company's parking lots
        const companyParkingLots = await ParkingLot.find({ createdBy: req.user.id });
        const parkingLotIds = companyParkingLots.map(lot => lot._id);

        if (parkingLotIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    currentMonth: {
                        revenue: { total: 0, growthPercentage: 0, previousMonth: 0 },
                        bookings: { total: 0, growthPercentage: 0, previousMonth: 0 },
                        customers: { total: 0, newCustomers: 0, returningCustomers: 0 }
                    },
                    occupancy: {
                        currentOccupancy: 0,
                        totalSpots: 0,
                        occupiedSpots: 0,
                        availableSpots: 0,
                        occupancyPercentage: 0
                    }
                }
            });
        }

        // Get current month revenue
        const currentMonthRevenue = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    'payment.status': 'success',
                    'payment.paidAt': {
                        $gte: currentMonthStart,
                        $lte: currentMonthEnd
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$payment.amount' }
                }
            }
        ]);

        // Get previous month revenue
        const previousMonthRevenue = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    'payment.status': 'success',
                    'payment.paidAt': {
                        $gte: previousMonthStart,
                        $lte: previousMonthEnd
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$payment.amount' }
                }
            }
        ]);

        // Get current month bookings
        const currentMonthBookings = await TimeSlot.countDocuments({
            parkingLot: { $in: parkingLotIds },
            createdAt: {
                $gte: currentMonthStart,
                $lte: currentMonthEnd
            }
        });

        // Get previous month bookings
        const previousMonthBookings = await TimeSlot.countDocuments({
            parkingLot: { $in: parkingLotIds },
            createdAt: {
                $gte: previousMonthStart,
                $lte: previousMonthEnd
            }
        });

        // Get unique customers for current month
        const currentMonthCustomers = await TimeSlot.distinct('bookedBy', {
            parkingLot: { $in: parkingLotIds },
            createdAt: {
                $gte: currentMonthStart,
                $lte: currentMonthEnd
            }
        });

        // Get new customers (first time bookers this month)
        const previousCustomers = await TimeSlot.distinct('bookedBy', {
            parkingLot: { $in: parkingLotIds },
            createdAt: { $lt: currentMonthStart }
        });

        const newCustomers = currentMonthCustomers.filter(
            customer => !previousCustomers.includes(customer)
        );

        // Calculate current occupancy
        const totalSpots = companyParkingLots.reduce((sum, lot) => sum + lot.totalSpots, 0);
        const currentlyOccupied = await TimeSlot.countDocuments({
            parkingLot: { $in: parkingLotIds },
            status: 'booked',
            startTime: { $lte: now },
            endTime: { $gte: now }
        });

        // Calculate growth percentages
        const currentRevenue = currentMonthRevenue[0]?.total || 0;
        const prevRevenue = previousMonthRevenue[0]?.total || 0;
        const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const bookingsGrowth = previousMonthBookings > 0 ? 
            ((currentMonthBookings - previousMonthBookings) / previousMonthBookings) * 100 : 0;

        res.status(200).json({
            success: true,
            data: {
                currentMonth: {
                    revenue: {
                        total: currentRevenue,
                        growthPercentage: Math.round(revenueGrowth * 100) / 100,
                        previousMonth: prevRevenue
                    },
                    bookings: {
                        total: currentMonthBookings,
                        growthPercentage: Math.round(bookingsGrowth * 100) / 100,
                        previousMonth: previousMonthBookings
                    },
                    customers: {
                        total: currentMonthCustomers.length,
                        newCustomers: newCustomers.length,
                        returningCustomers: currentMonthCustomers.length - newCustomers.length
                    }
                },
                occupancy: {
                    currentOccupancy: currentlyOccupied,
                    totalSpots,
                    occupiedSpots: currentlyOccupied,
                    availableSpots: totalSpots - currentlyOccupied,
                    occupancyPercentage: totalSpots > 0 ? Math.round((currentlyOccupied / totalSpots) * 100) : 0
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get monthly revenue chart data
// @route   GET /api/analytics/company/revenue-chart
// @access  Private (Company only)
exports.getRevenueChart = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only companies can view analytics.'
            });
        }

        const { months = 12, year } = req.query;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        const monthsToShow = parseInt(months);

        // Get company's parking lots
        const companyParkingLots = await ParkingLot.find({ createdBy: req.user.id });
        const parkingLotIds = companyParkingLots.map(lot => lot._id);

        if (parkingLotIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const chartData = [];

        for (let i = monthsToShow - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            date.setFullYear(currentYear);
            
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            // Get revenue for this month
            const monthRevenue = await TimeSlot.aggregate([
                {
                    $match: {
                        parkingLot: { $in: parkingLotIds },
                        'payment.status': 'success',
                        'payment.paidAt': {
                            $gte: monthStart,
                            $lte: monthEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$payment.amount' }
                    }
                }
            ]);

            // Get bookings for this month
            const monthBookings = await TimeSlot.countDocuments({
                parkingLot: { $in: parkingLotIds },
                createdAt: {
                    $gte: monthStart,
                    $lte: monthEnd
                }
            });

            chartData.push({
                month: monthNames[date.getMonth()],
                revenue: monthRevenue[0]?.total || 0,
                bookings: monthBookings
            });
        }

        res.status(200).json({
            success: true,
            data: chartData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get live occupancy status
// @route   GET /api/analytics/company/occupancy/live
// @access  Private (Company only)
exports.getLiveOccupancy = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only companies can view analytics.'
            });
        }

        const now = new Date();

        // Get company's parking lots
        const companyParkingLots = await ParkingLot.find({ createdBy: req.user.id });
        const parkingLotIds = companyParkingLots.map(lot => lot._id);

        if (parkingLotIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    overview: {
                        totalSpots: 0,
                        occupiedSpots: 0,
                        availableSpots: 0,
                        occupancyPercentage: 0
                    },
                    byParkingLot: [],
                    activeBookings: [],
                    lastUpdated: now.toISOString()
                }
            });
        }

        // Calculate total spots
        const totalSpots = companyParkingLots.reduce((sum, lot) => sum + lot.totalSpots, 0);

        // Get active bookings
        const activeBookings = await TimeSlot.find({
            parkingLot: { $in: parkingLotIds },
            status: 'booked',
            startTime: { $lte: now },
            endTime: { $gte: now }
        })
            .populate('bookedBy', 'fullName')
            .populate('parkingLot', 'name');

        const occupiedSpots = activeBookings.length;
        const availableSpots = totalSpots - occupiedSpots;

        // Get occupancy by parking lot
        const byParkingLot = await Promise.all(
            companyParkingLots.map(async (lot) => {
                const lotActiveBookings = await TimeSlot.countDocuments({
                    parkingLot: lot._id,
                    status: 'booked',
                    startTime: { $lte: now },
                    endTime: { $gte: now }
                });

                return {
                    parkingLotId: lot._id,
                    name: lot.name,
                    totalSpots: lot.totalSpots,
                    occupiedSpots: lotActiveBookings,
                    availableSpots: lot.totalSpots - lotActiveBookings,
                    occupancyPercentage: lot.totalSpots > 0 ? 
                        Math.round((lotActiveBookings / lot.totalSpots) * 100) : 0
                };
            })
        );

        // Format active bookings
        const formattedActiveBookings = activeBookings.map(booking => {
            const timeRemaining = Math.max(0, booking.endTime.getTime() - now.getTime());
            const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
            const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

            return {
                spotNumber: booking.spotNumber,
                customerName: booking.bookedBy?.fullName || 'Unknown',
                parkingLotName: booking.parkingLot?.name || 'Unknown',
                startTime: booking.startTime,
                endTime: booking.endTime,
                timeRemaining: `${hoursRemaining}h ${minutesRemaining}m`
            };
        });

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalSpots,
                    occupiedSpots,
                    availableSpots,
                    occupancyPercentage: totalSpots > 0 ? 
                        Math.round((occupiedSpots / totalSpots) * 100) : 0
                },
                byParkingLot,
                activeBookings: formattedActiveBookings,
                lastUpdated: now.toISOString()
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get detailed analytics
// @route   GET /api/analytics/company/detailed
// @access  Private (Company only)
exports.getDetailedAnalytics = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only companies can view analytics.'
            });
        }

        const { startDate, endDate, parkingLotId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide startDate and endDate'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get company's parking lots
        let parkingLotIds;
        if (parkingLotId) {
            parkingLotIds = [parkingLotId];
        } else {
            const companyParkingLots = await ParkingLot.find({ createdBy: req.user.id });
            parkingLotIds = companyParkingLots.map(lot => lot._id);
        }

        if (parkingLotIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    revenue: { total: 0, dailyAverage: 0, byPaymentStatus: {} },
                    bookings: { total: 0, dailyAverage: 0, byStatus: {}, averageDuration: 0 },
                    peakTimes: { hours: [], days: [] },
                    topCustomers: []
                }
            });
        }

        // Calculate number of days for averages
        const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

        // Get revenue data
        const revenueData = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$payment.status',
                    total: { $sum: '$payment.amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get booking status data
        const bookingStatusData = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get average duration
        const durationData = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $project: {
                    duration: {
                        $divide: [
                            { $subtract: ['$endTime', '$startTime'] },
                            1000 * 60 * 60 // Convert to hours
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    averageDuration: { $avg: '$duration' }
                }
            }
        ]);

        // Get peak hours
        const peakHours = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $project: {
                    hour: { $hour: '$startTime' }
                }
            },
            {
                $group: {
                    _id: '$hour',
                    bookings: { $sum: 1 }
                }
            },
            {
                $sort: { bookings: -1 }
            },
            {
                $limit: 5
            }
        ]);

        // Get top customers
        const topCustomers = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$bookedBy',
                    totalBookings: { $sum: 1 },
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $eq: ['$payment.status', 'success'] },
                                '$payment.amount',
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            {
                $unwind: '$customer'
            },
            {
                $project: {
                    name: '$customer.fullName',
                    email: '$customer.email',
                    totalBookings: 1,
                    totalRevenue: 1
                }
            },
            {
                $sort: { totalRevenue: -1 }
            },
            {
                $limit: 10
            }
        ]);

        // Process revenue data
        const revenueByStatus = {};
        let totalRevenue = 0;
        let totalBookings = 0;

        revenueData.forEach(item => {
            revenueByStatus[item._id] = item.total;
            totalRevenue += item.total;
            totalBookings += item.count;
        });

        // Process booking status data
        const bookingsByStatus = {};
        bookingStatusData.forEach(item => {
            bookingsByStatus[item._id] = item.count;
        });

        res.status(200).json({
            success: true,
            data: {
                revenue: {
                    total: totalRevenue,
                    dailyAverage: Math.round(totalRevenue / daysDiff),
                    byPaymentStatus: revenueByStatus
                },
                bookings: {
                    total: totalBookings,
                    dailyAverage: Math.round(totalBookings / daysDiff),
                    byStatus: bookingsByStatus,
                    averageDuration: Math.round((durationData[0]?.averageDuration || 0) * 10) / 10
                },
                peakTimes: {
                    hours: peakHours.map(item => ({
                        hour: item._id,
                        bookings: item.bookings
                    }))
                },
                topCustomers
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
}; 