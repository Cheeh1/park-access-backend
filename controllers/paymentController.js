const crypto = require('crypto');
const TimeSlot = require('../models/timeSlot');
const CarDetails = require('../models/carDetails');
const ParkingLot = require('../models/parkingLot');

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

// @desc    Initialize payment and save booking details
// @route   POST /api/payments/initialize
// @access  Private
exports.initializePayment = async (req, res) => {
    try {
        const { 
            parkingLotId, 
            startTime, 
            endTime,
            carDetails,
            amount
        } = req.body;

        // Validate required fields
        if (!parkingLotId || !startTime || !endTime || !carDetails || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
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

        // Convert dates
        const start = new Date(startTime);
        const end = new Date(endTime);

        // Find an available spot
        const availableSpot = await findAvailableSpot(parkingLotId, start, end, parkingLot.totalSpots);
        
        if (!availableSpot) {
            return res.status(400).json({
                success: false,
                message: 'No spots available for the selected time period'
            });
        }

        // Save car details
        const car = await CarDetails.create({
            ...carDetails,
            owner: req.user.id
        });

        // Create time slot with pending payment
        const timeSlot = await TimeSlot.create({
            parkingLot: parkingLotId,
            spotNumber: availableSpot,
            startTime: start,
            endTime: end,
            bookedBy: req.user.id,
            carDetails: car._id,
            payment: {
                reference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                amount,
                status: 'pending'
            }
        });

        res.status(201).json({
            success: true,
            data: {
                timeSlot,
                paymentReference: timeSlot.payment.reference,
                assignedSpot: availableSpot
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

// @desc    Handle Paystack webhook
// @route   POST /api/payments/webhook
// @access  Public
exports.handleWebhook = async (req, res) => {
    try {
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(400).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        const event = req.body;

        // Handle the event
        switch (event.event) {
            case 'charge.success':
                const { reference } = event.data;

                // Find the time slot with this payment reference
                const timeSlot = await TimeSlot.findOne({ 'payment.reference': reference });

                if (!timeSlot) {
                    return res.status(404).json({
                        success: false,
                        message: 'Time slot not found'
                    });
                }

                // Update payment status
                timeSlot.payment.status = 'success';
                timeSlot.payment.paidAt = new Date();
                await timeSlot.save();

                break;

            case 'charge.failed':
                const failedReference = event.data.reference;

                // Find and update the time slot
                const failedTimeSlot = await TimeSlot.findOne({ 'payment.reference': failedReference });

                if (failedTimeSlot) {
                    failedTimeSlot.payment.status = 'failed';
                    await failedTimeSlot.save();
                }

                break;
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Verify payment status
// @route   GET /api/payments/verify/:reference
// @access  Private
exports.verifyPayment = async (req, res) => {
    try {
        const { reference } = req.params;

        const timeSlot = await TimeSlot.findOne({ 'payment.reference': reference })
            .populate('carDetails')
            .populate('parkingLot', 'name location');

        if (!timeSlot) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

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