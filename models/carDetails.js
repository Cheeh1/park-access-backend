const mongoose = require('mongoose');

const CarDetailsSchema = new mongoose.Schema({
    licensePlate: {
        type: String,
        required: [true, 'Please provide license plate number'],
        trim: true,
        uppercase: true
    },
    carModel: {
        type: String,
        required: [true, 'Please provide car model'],
        trim: true
    },
    carColor: {
        type: String,
        required: [true, 'Please provide car color'],
        trim: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CarDetails', CarDetailsSchema); 