const User = require('../models/user');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    // // Validate required fields based on role
    // if (role === 'user' && !fullName) {
    //   return res.status(400).json({ success: false, message: 'Full name is required for user accounts' });
    // }

    // if (role === 'company' && !companyName) {
    //   return res.status(400).json({ success: false, message: 'Company name is required for company accounts' });
    // }

    // // Create user
    // const user = await User.create({
    //   fullName: role === 'user' ? fullName : '',
    //   companyName: role === 'company' ? companyName : '',
    //   email,
    //   password,
    //   role
    // });


    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // Validate fullName is provided
    if (!fullName) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      role
    });

    // Get token
    const token = user.getSignedJwtToken();

    // Remove password from response
    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    res.status(201).json({
      success: true,
      token,
      data: userResponse
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Get token
    const token = user.getSignedJwtToken();

    // Create response object without password
    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    res.status(200).json({
      success: true,
      token,
      data: userResponse
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both old and new password'
      });
    }

    // Check if new password is same as old password
    if (oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from old password'
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check if old password matches
    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateUser = async (req, res) => {
  try {
    const { fullName } = req.body;
    const fieldsToUpdate = {};

    // Only update fields that are provided
    if (fullName) {
      fieldsToUpdate.fullName = fullName;
    }

    // If no fields to update
    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fields to update'
      });
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};