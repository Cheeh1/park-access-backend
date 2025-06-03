const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema({
    parkingLot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingLot',
        required: true
    },
    spotNumber: {
        type: Number,
        required: [true, 'Please provide spot number'],
        min: [1, 'Spot number must be at least 1']
    },
    startTime: {
        type: Date,
        required: [true, 'Please provide start time']
    },
    endTime: {
        type: Date,
        required: [true, 'Please provide end time']
    },
    bookedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    carDetails: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CarDetails',
        required: true
    },
    payment: {
        reference: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'failed'],
            default: 'pending'
        },
        paidAt: Date
    },
    status: {
        type: String,
        enum: ['booked', 'cancelled', 'completed'],
        default: 'booked'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for efficient querying
TimeSlotSchema.index({ parkingLot: 1, spotNumber: 1, startTime: 1, endTime: 1 });
TimeSlotSchema.index({ 'payment.reference': 1 });

module.exports = mongoose.model('TimeSlot', TimeSlotSchema); 