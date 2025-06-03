const TimeSlot = require('../models/timeSlot');
const ParkingLot = require('../models/parkingLot');

// @desc    Book a time slot
// @route   POST /api/time-slots
// @access  Private
exports.bookTimeSlot = async (req, res) => {
    try {
        const { parkingLotId, startTime, endTime } = req.body;

        // Validate required fields
        if (!parkingLotId || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Please provide parking lot ID, start time, and end time'
            });
        }

        // Convert string dates to Date objects
        const start = new Date(startTime);
        const end = new Date(endTime);

        // Validate dates
        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: 'End time must be after start time'
            });
        }

        // Check if parking lot exists
        const parkingLot = await ParkingLot.findById(parkingLotId);
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: 'Parking lot not found'
            });
        }

        // Find an available spot for the requested time
        const availableSpot = await findAvailableSpot(parkingLotId, start, end, parkingLot.totalSpots);
        
        if (!availableSpot) {
            return res.status(400).json({
                success: false,
                message: 'No spots available for the selected time period'
            });
        }

        // Create time slot booking with the available spot
        const timeSlot = await TimeSlot.create({
            parkingLot: parkingLotId,
            spotNumber: availableSpot,
            startTime: start,
            endTime: end,
            bookedBy: req.user.id
        });

        res.status(201).json({
            success: true,
            data: timeSlot
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// Helper function to find an available spot
const findAvailableSpot = async (parkingLotId, startTime, endTime, totalSpots) => {
    for (let spotNumber = 1; spotNumber <= totalSpots; spotNumber++) {
        const overlappingBooking = await TimeSlot.findOne({
            parkingLot: parkingLotId,
            spotNumber: spotNumber,
            status: 'booked',
            $or: [
                {
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                }
            ]
        });

        if (!overlappingBooking) {
            return spotNumber;
        }
    }
    return null;
};

// @desc    Check availability for specific time range
// @route   GET /api/time-slots/check-availability/:parkingLotId
// @access  Public
exports.checkTimeSlotAvailability = async (req, res) => {
    try {
        const { parkingLotId } = req.params;
        const { startTime, endTime } = req.query;

        if (!startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Please provide start time and end time'
            });
        }

        // Convert string dates to Date objects
        const start = new Date(startTime);
        const end = new Date(endTime);

        // Validate dates
        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: 'End time must be after start time'
            });
        }

        // Check if start time is in the past
        if (start <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Start time cannot be in the past'
            });
        }

        // Get parking lot details
        const parkingLot = await ParkingLot.findById(parkingLotId);
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: 'Parking lot not found'
            });
        }

        // Find an available spot
        const availableSpot = await findAvailableSpot(parkingLotId, start, end, parkingLot.totalSpots);

        // Count total available spots for this time period
        let availableSpots = 0;
        for (let spotNumber = 1; spotNumber <= parkingLot.totalSpots; spotNumber++) {
            const overlappingBooking = await TimeSlot.findOne({
                parkingLot: parkingLotId,
                spotNumber: spotNumber,
                status: 'booked',
                $or: [
                    {
                        startTime: { $lt: end },
                        endTime: { $gt: start }
                    }
                ]
            });

            if (!overlappingBooking) {
                availableSpots++;
            }
        }

        // Calculate duration in hours
        const durationInHours = Math.ceil((end - start) / (1000 * 60 * 60));
        const totalCost = durationInHours * parkingLot.hourlyRate;

        res.status(200).json({
            success: true,
            data: {
                available: availableSpot !== null,
                availableSpots,
                totalSpots: parkingLot.totalSpots,
                durationInHours,
                hourlyRate: parkingLot.hourlyRate,
                totalCost,
                parkingLot: {
                    name: parkingLot.name,
                    location: parkingLot.location
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

// @desc    Get available time slots for a parking lot (old method - kept for backward compatibility)
// @route   GET /api/time-slots/available/:parkingLotId
// @access  Public
exports.getAvailableTimeSlots = async (req, res) => {
    try {
        const { parkingLotId } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a date'
            });
        }

        // Get parking lot details
        const parkingLot = await ParkingLot.findById(parkingLotId);
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: 'Parking lot not found'
            });
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get all booked slots for the day
        const bookedSlots = await TimeSlot.find({
            parkingLot: parkingLotId,
            status: 'booked',
            startTime: { $gte: startOfDay },
            endTime: { $lte: endOfDay }
        }).sort('startTime');

        // Generate available time slots for each spot
        const availableSlots = {};
        
        // Initialize available slots for each spot
        for (let spotNumber = 1; spotNumber <= parkingLot.totalSpots; spotNumber++) {
            availableSlots[spotNumber] = [];
            let currentTime = new Date(startOfDay);

            while (currentTime < endOfDay) {
                const slotEnd = new Date(currentTime);
                slotEnd.setHours(currentTime.getHours() + 1);

                const isSlotBooked = bookedSlots.some(slot =>
                    slot.spotNumber === spotNumber &&
                    ((slot.startTime <= currentTime && slot.endTime > currentTime) ||
                    (slot.startTime < slotEnd && slot.endTime >= slotEnd))
                );

                if (!isSlotBooked) {
                    availableSlots[spotNumber].push({
                        startTime: new Date(currentTime),
                        endTime: new Date(slotEnd)
                    });
                }

                currentTime.setHours(currentTime.getHours() + 1);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                totalSpots: parkingLot.totalSpots,
                availableSlots
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

// @desc    Cancel a time slot booking
// @route   PUT /api/time-slots/:id/cancel
// @access  Private
exports.cancelTimeSlot = async (req, res) => {
    try {
        const timeSlot = await TimeSlot.findById(req.params.id);

        if (!timeSlot) {
            return res.status(404).json({
                success: false,
                message: 'Time slot not found'
            });
        }

        // Check if user is the one who booked
        if (timeSlot.bookedBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this booking'
            });
        }

        // Check if booking can be cancelled (e.g., not in the past)
        if (new Date(timeSlot.startTime) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel past bookings'
            });
        }

        timeSlot.status = 'cancelled';
        await timeSlot.save();

        res.status(200).json({
            success: true,
            data: timeSlot
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get user's booking history
// @route   GET /api/time-slots/history
// @access  Private
exports.getUserBookingHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;

        // Build query
        const query = {
            bookedBy: req.user.id
        };

        // By default, exclude cancelled bookings unless specifically requested
        if (req.query.includeCancelled === 'true') {
            // Include all bookings (including cancelled)
            if (req.query.status) {
                query.status = req.query.status;
            }
        } else {
            // Exclude cancelled bookings by default
            if (req.query.status) {
                query.status = req.query.status;
            } else {
                query.status = { $ne: 'cancelled' }; // Not equal to cancelled
            }
        }

        // Add date filter if provided
        if (req.query.startDate && req.query.endDate) {
            query.startTime = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            };
        }

        // Add past/upcoming filter
        const now = new Date();
        if (req.query.timeFilter === 'past') {
            query.endTime = { $lt: now };
        } else if (req.query.timeFilter === 'upcoming') {
            query.startTime = { $gt: now };
        }

        // Get total count for pagination
        const total = await TimeSlot.countDocuments(query);

        // Get bookings with populated fields
        const bookings = await TimeSlot.find(query)
            .populate('parkingLot', 'name location')
            .populate('carDetails', 'licensePlate carModel carColor')
            .sort({ startTime: -1 }) // Sort by start time, newest first
            .skip(startIndex)
            .limit(limit);

        // Add time classification tag to each booking
        const bookingsWithTags = bookings.map(booking => {
            const bookingObj = booking.toObject();
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);
            
            // Determine if booking is past, ongoing, or upcoming
            if (endTime < now) {
                bookingObj.timeStatus = 'past';
            } else if (startTime <= now && endTime >= now) {
                bookingObj.timeStatus = 'ongoing';
            } else {
                bookingObj.timeStatus = 'upcoming';
            }

            return bookingObj;
        });

        // Calculate pagination info
        const pagination = {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        };

        res.status(200).json({
            success: true,
            data: bookingsWithTags,
            pagination
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get user's booking history grouped by time status
// @route   GET /api/time-slots/history-grouped
// @access  Private
exports.getUserBookingHistoryGrouped = async (req, res) => {
    try {
        const now = new Date();

        // Build base query
        const baseQuery = {
            bookedBy: req.user.id
        };

        // By default, exclude cancelled bookings unless specifically requested
        if (req.query.includeCancelled !== 'true') {
            baseQuery.status = { $ne: 'cancelled' };
        }

        // Get all user's bookings (excluding cancelled by default)
        const allBookings = await TimeSlot.find(baseQuery)
            .populate('parkingLot', 'name location')
            .populate('carDetails', 'licensePlate carModel carColor')
            .sort({ startTime: -1 });

        // Group bookings by time status
        const groupedBookings = {
            upcoming: [],
            ongoing: [],
            past: []
        };

        allBookings.forEach(booking => {
            const bookingObj = booking.toObject();
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);

            if (endTime < now) {
                bookingObj.timeStatus = 'past';
                groupedBookings.past.push(bookingObj);
            } else if (startTime <= now && endTime >= now) {
                bookingObj.timeStatus = 'ongoing';
                groupedBookings.ongoing.push(bookingObj);
            } else {
                bookingObj.timeStatus = 'upcoming';
                groupedBookings.upcoming.push(bookingObj);
            }
        });

        // Get counts for each group
        const counts = {
            upcoming: groupedBookings.upcoming.length,
            ongoing: groupedBookings.ongoing.length,
            past: groupedBookings.past.length,
            total: allBookings.length
        };

        res.status(200).json({
            success: true,
            data: groupedBookings,
            counts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get booking statistics for user
// @route   GET /api/time-slots/stats
// @access  Private
exports.getUserBookingStats = async (req, res) => {
    try {
        // Get total bookings
        const totalBookings = await TimeSlot.countDocuments({
            bookedBy: req.user.id
        });

        // Get successful bookings
        const successfulBookings = await TimeSlot.countDocuments({
            bookedBy: req.user.id,
            'payment.status': 'success'
        });

        // Get upcoming bookings
        const upcomingBookings = await TimeSlot.countDocuments({
            bookedBy: req.user.id,
            startTime: { $gt: new Date() },
            'payment.status': 'success'
        });

        // Get total amount spent
        const totalSpent = await TimeSlot.aggregate([
            {
                $match: {
                    bookedBy: req.user._id,
                    'payment.status': 'success'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$payment.amount' }
                }
            }
        ]);

        // Get bookings by status
        const bookingsByStatus = await TimeSlot.aggregate([
            {
                $match: {
                    bookedBy: req.user._id
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get recent bookings
        const recentBookings = await TimeSlot.find({
            bookedBy: req.user.id,
            'payment.status': 'success'
        })
            .populate('parkingLot', 'name location')
            .populate('carDetails', 'licensePlate carModel carColor')
            .sort({ startTime: -1 })
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                totalBookings,
                successfulBookings,
                upcomingBookings,
                totalSpent: totalSpent[0]?.total || 0,
                bookingsByStatus: bookingsByStatus.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {}),
                recentBookings
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

// @desc    Get company's booking history for their parking lots
// @route   GET /api/time-slots/company/history
// @access  Private (Company only)
exports.getCompanyBookingHistory = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only companies can view this data.'
            });
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;

        // Get all parking lots owned by this company
        const companyParkingLots = await ParkingLot.find({ createdBy: req.user.id }).select('_id');
        const parkingLotIds = companyParkingLots.map(lot => lot._id);

        if (parkingLotIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page: 1,
                    limit,
                    total: 0,
                    pages: 0
                }
            });
        }

        // Build query
        const query = {
            parkingLot: { $in: parkingLotIds }
        };

        // Add date filter if provided
        if (req.query.startDate && req.query.endDate) {
            query.startTime = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            };
        }

        // Add status filter if provided
        if (req.query.status) {
            query.status = req.query.status;
        }

        // Add payment status filter if provided
        if (req.query.paymentStatus) {
            query['payment.status'] = req.query.paymentStatus;
        }

        // Add specific parking lot filter if provided
        if (req.query.parkingLotId) {
            query.parkingLot = req.query.parkingLotId;
        }

        // Get total count for pagination
        const total = await TimeSlot.countDocuments(query);

        // Get bookings with populated fields
        const bookings = await TimeSlot.find(query)
            .populate('parkingLot', 'name location totalSpots')
            .populate('bookedBy', 'fullName email')
            .populate('carDetails', 'licensePlate carModel carColor')
            .sort({ startTime: -1 }) // Sort by start time, newest first
            .skip(startIndex)
            .limit(limit);

        // Calculate pagination info
        const pagination = {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        };

        res.status(200).json({
            success: true,
            data: bookings,
            pagination
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get company's booking statistics for their parking lots
// @route   GET /api/time-slots/company/stats
// @access  Private (Company only)
exports.getCompanyBookingStats = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only companies can view this data.'
            });
        }

        // Get all parking lots owned by this company
        const companyParkingLots = await ParkingLot.find({
            createdBy: req.user.id
        }).select('_id name');
        const parkingLotIds = companyParkingLots.map(lot => lot._id);

        if (parkingLotIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalParkingLots: 0,
                    totalBookings: 0,
                    successfulBookings: 0,
                    totalRevenue: 0,
                    bookingsByStatus: {},
                    bookingsByParkingLot: [],
                    recentBookings: []
                }
            });
        }

        // Get total bookings for company's parking lots
        const totalBookings = await TimeSlot.countDocuments({
            parkingLot: { $in: parkingLotIds }
        });

        // Get successful bookings
        const successfulBookings = await TimeSlot.countDocuments({
            parkingLot: { $in: parkingLotIds },
            'payment.status': 'success'
        });

        // Get total revenue
        const revenueData = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds },
                    'payment.status': 'success'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$payment.amount' }
                }
            }
        ]);

        // Get bookings by status
        const bookingsByStatus = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get bookings by parking lot
        const bookingsByParkingLot = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds }
                }
            },
            {
                $group: {
                    _id: '$parkingLot',
                    totalBookings: { $sum: 1 },
                    successfulBookings: {
                        $sum: {
                            $cond: [{ $eq: ['$payment.status', 'success'] }, 1, 0]
                        }
                    },
                    revenue: {
                        $sum: {
                            $cond: [{ $eq: ['$payment.status', 'success'] }, '$payment.amount', 0]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'parkinglots',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'parkingLotInfo'
                }
            },
            {
                $unwind: '$parkingLotInfo'
            },
            {
                $project: {
                    _id: 1,
                    name: '$parkingLotInfo.name',
                    location: '$parkingLotInfo.location',
                    totalBookings: 1,
                    successfulBookings: 1,
                    revenue: 1
                }
            }
        ]);

        // Get recent bookings (last 10)
        const recentBookings = await TimeSlot.find({
            parkingLot: { $in: parkingLotIds },
            'payment.status': 'success'
        })
            .populate('parkingLot', 'name location')
            .populate('bookedBy', 'fullName email')
            .populate('carDetails', 'licensePlate carModel carColor')
            .sort({ startTime: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                totalParkingLots: companyParkingLots.length,
                totalBookings,
                successfulBookings,
                totalRevenue: revenueData[0]?.total || 0,
                bookingsByStatus: bookingsByStatus.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {}),
                bookingsByParkingLot,
                recentBookings
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

// @desc    Get available filter options for user bookings
// @route   GET /api/time-slots/filters/user
// @access  Private
exports.getUserFilterOptions = async (req, res) => {
    try {
        // Get booking statuses
        const bookingStatuses = ['booked', 'cancelled', 'completed'];

        // Get payment statuses
        const paymentStatuses = ['pending', 'success', 'failed'];

        // Get date range of user's bookings
        const dateRange = await TimeSlot.aggregate([
            {
                $match: {
                    bookedBy: req.user._id
                }
            },
            {
                $group: {
                    _id: null,
                    minDate: { $min: '$startTime' },
                    maxDate: { $max: '$startTime' }
                }
            }
        ]);

        // Get parking lots the user has booked
        const userParkingLots = await TimeSlot.find({
            bookedBy: req.user.id
        })
            .populate('parkingLot', 'name location')
            .distinct('parkingLot');

        res.status(200).json({
            success: true,
            data: {
                bookingStatuses,
                paymentStatuses,
                dateRange: dateRange[0] || { minDate: null, maxDate: null },
                parkingLots: userParkingLots
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

// @desc    Get available filter options for company bookings
// @route   GET /api/time-slots/filters/company
// @access  Private (Company only)
exports.getCompanyFilterOptions = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only companies can view this data.'
            });
        }

        // Get booking statuses
        const bookingStatuses = ['booked', 'cancelled', 'completed'];

        // Get payment statuses
        const paymentStatuses = ['pending', 'success', 'failed'];

        // Get company's parking lots
        const companyParkingLots = await ParkingLot.find({
            createdBy: req.user.id
        }).select('_id name location');

        if (companyParkingLots.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    bookingStatuses,
                    paymentStatuses,
                    dateRange: { minDate: null, maxDate: null },
                    parkingLots: []
                }
            });
        }

        const parkingLotIds = companyParkingLots.map(lot => lot._id);

        // Get date range of company's bookings
        const dateRange = await TimeSlot.aggregate([
            {
                $match: {
                    parkingLot: { $in: parkingLotIds }
                }
            },
            {
                $group: {
                    _id: null,
                    minDate: { $min: '$startTime' },
                    maxDate: { $max: '$startTime' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                bookingStatuses,
                paymentStatuses,
                dateRange: dateRange[0] || { minDate: null, maxDate: null },
                parkingLots: companyParkingLots
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