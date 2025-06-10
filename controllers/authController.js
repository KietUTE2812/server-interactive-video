import Course from "../models/Course.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

export const checkAuth = asyncHandler(async (req, res, next) => {
    //console.log('Received userId:', req.user);
    // The verifyToken middleware should have added the user's ID to the request object
    const user = req.user;

    if (!req.user) {
        return res.status(401).json({ message: 'Không tìm thấy thông tin người dùng' });
    }
    // If we've got this far, the token is valid and we've found the user
    res.status(200).json({
        status: 'success',
        data: {
            user: user,
        }
    });
    //console.log('Found user:', req.user);
});

// @desc    Verify user password
// @route   POST /api/auth/verify-password
// @access  Private
export const verifyPassword = asyncHandler(async (req, res, next) => {
    const { password } = req.body;
    console.log('password', password);

    // Get user from middleware
    const user = await User.findById(req.user._id).select('password');
    if (!user) {
        return next(new ErrorResponse('User not found in database', 404));
    }

    // 🔥 BƯỚC 3: Kiểm tra user có password không
    if (!user.password) {
        console.log('⚠️ User không có password - có thể là social login');
        return next(new ErrorResponse('User does not have a password set. This might be a social login account.', 400));
    }
    if (!password) {
        return next(new ErrorResponse('Please provide password', 400));
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return next(new ErrorResponse('Invalid password', 401));
    }

    res.status(200).json({
        success: true,
        message: 'Password verified successfully'
    });
});