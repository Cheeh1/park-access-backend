const mongoose = require('mongoose');

const ParkingLotSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide parking lot name'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    location: {
        type: String,
        required: [true, 'Please provide parking lot location'],
        trim: true
    },
    totalSpots: {
        type: Number,
        required: [true, 'Please provide total number of spots'],
        min: [1, 'Total spots must be at least 1']
    },
    availableSpots: {
        type: Number,
        min: [0, 'Available spots cannot be negative']
    },
    hourlyRate: {
        type: Number,
        required: [true, 'Please provide hourly rate'],
        min: [0, 'Hourly rate cannot be negative']
    },
    images: [{
        type: String,
        required: [true, 'Please provide at least one image']
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save middleware to set availableSpots equal to totalSpots when creating new parking lot
ParkingLotSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('totalSpots')) {
        this.availableSpots = this.totalSpots;
    }
    next();
});

module.exports = mongoose.model('ParkingLot', ParkingLotSchema); 