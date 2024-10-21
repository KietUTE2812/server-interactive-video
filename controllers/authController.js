import Course from "../models/Course.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from '../models/User.js';

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
    console.log('Found user:', req.user);
});