const ParkingLot = require('../models/parkingLot');
const { cloudinary } = require('../config/cloudinary');

// @desc    Get all parking lots
// @route   GET /api/parking-lots
// @access  Public
exports.getParkingLots = async (req, res) => {
    try {
        const parkingLots = await ParkingLot.find()
            .populate('createdBy', 'fullName email')
            .select('name location totalSpots availableSpots hourlyRate images createdBy createdAt');

        res.status(200).json({
            success: true,
            count: parkingLots.length,
            data: parkingLots
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get parking lots created by the authenticated company
// @route   GET /api/parking-lots/my-lots
// @access  Private (Company only)
exports.getMyParkingLots = async (req, res) => {
    try {
        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Only companies can access this endpoint'
            });
        }

        const parkingLots = await ParkingLot.find({ createdBy: req.user.id })
            .populate('createdBy', 'fullName email')
            .select('name location totalSpots availableSpots hourlyRate images createdBy createdAt')
            .sort('-createdAt'); // Sort by newest first

        res.status(200).json({
            success: true,
            count: parkingLots.length,
            data: parkingLots
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get single parking lot
// @route   GET /api/parking-lots/:id
// @access  Public
exports.getParkingLot = async (req, res) => {
    try {
        const parkingLot = await ParkingLot.findById(req.params.id)
            .populate('createdBy', 'fullName email')
            .select('name location totalSpots availableSpots hourlyRate images createdBy createdAt');

        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: 'Parking lot not found'
            });
        }

        res.status(200).json({
            success: true,
            data: parkingLot
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create new parking lot
// @route   POST /api/parking-lots
// @access  Private (Company only)
exports.createParkingLot = async (req, res) => {
    try {
        const { name, location, totalSpots, hourlyRate } = req.body;

        // Check if user is a company
        if (req.user.role !== 'company') {
            return res.status(403).json({
                success: false,
                message: 'Only companies can create parking lots'
            });
        }

        // Validate required fields
        if (!name || !location || !totalSpots || !hourlyRate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Check if images were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please upload at least one image'
            });
        }

        // Get image URLs from uploaded files
        const images = req.files.map(file => file.path);

        // Create parking lot
        const parkingLot = await ParkingLot.create({
            name,
            location,
            totalSpots,
            hourlyRate,
            images,
            createdBy: req.user.id
        });

        res.status(201).json({
            success: true,
            data: parkingLot
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update parking lot
// @route   PUT /api/parking-lots/:id
// @access  Private (Company only)
exports.updateParkingLot = async (req, res) => {
    try {
        const { name, location, totalSpots, hourlyRate } = req.body;
        let parkingLot = await ParkingLot.findById(req.params.id);

        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: 'Parking lot not found'
            });
        }

        // Check if user is the owner
        if (parkingLot.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this parking lot'
            });
        }

        // Update fields
        const fieldsToUpdate = {};
        if (name) fieldsToUpdate.name = name;
        if (location) fieldsToUpdate.location = location;
        if (totalSpots) {
            fieldsToUpdate.totalSpots = totalSpots;
            // Adjust available spots if total spots is reduced
            if (totalSpots < parkingLot.availableSpots) {
                fieldsToUpdate.availableSpots = totalSpots;
            }
        }
        if (hourlyRate) fieldsToUpdate.hourlyRate = hourlyRate;

        // Handle new images if uploaded
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary
            if (parkingLot.images && parkingLot.images.length > 0) {
                for (const imageUrl of parkingLot.images) {
                    const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
                    await cloudinary.uploader.destroy(publicId);
                }
            }
            // Add new image URLs
            fieldsToUpdate.images = req.files.map(file => file.path);
        }

        // If no fields to update
        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide fields to update'
            });
        }

        parkingLot = await ParkingLot.findByIdAndUpdate(
            req.params.id,
            fieldsToUpdate,
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            data: parkingLot
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete parking lot
// @route   DELETE /api/parking-lots/:id
// @access  Private (Company only)
exports.deleteParkingLot = async (req, res) => {
    try {
        const parkingLot = await ParkingLot.findById(req.params.id);

        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: 'Parking lot not found'
            });
        }

        // Check if user is the owner
        if (parkingLot.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this parking lot'
            });
        }

        // Delete images from Cloudinary
        if (parkingLot.images && parkingLot.images.length > 0) {
            for (const imageUrl of parkingLot.images) {
                const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            }
        }

        await parkingLot.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Search parking lots by name, location and price
// @route   GET /api/parking-lots/search
// @access  Public
exports.searchParkingLots = async (req, res) => {
    try {
        const { query, location, minPrice, maxPrice } = req.query;

        if (!query && !location && !minPrice && !maxPrice) {
            return res.status(400).json({
                success: false,
                message: 'Please provide at least one search criteria (query, location, minPrice, or maxPrice)'
            });
        }

        // Build search query
        const searchQuery = {};

        // Add text search if provided (searches both name and location)
        if (query) {
            searchQuery.$or = [
                { name: new RegExp(query, 'i') },
                { location: new RegExp(query, 'i') }
            ];
        }

        // Add location search if provided (for backward compatibility)
        if (location && !query) {
            searchQuery.location = new RegExp(location, 'i');
        }

        // Add price range if provided
        if (minPrice || maxPrice) {
            searchQuery.hourlyRate = {};
            if (minPrice) searchQuery.hourlyRate.$gte = parseFloat(minPrice);
            if (maxPrice) searchQuery.hourlyRate.$lte = parseFloat(maxPrice);
        }

        const parkingLots = await ParkingLot.find(searchQuery)
            .populate('createdBy', 'fullName email')
            .sort('hourlyRate'); // Sort by price from lowest to highest

        res.status(200).json({
            success: true,
            count: parkingLots.length,
            data: parkingLots
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
}; 