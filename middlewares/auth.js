import jwt from 'jsonwebtoken';
import asyncHandler from './asyncHandler.js';
import ErrorResponse from '../utils/ErrorResponse.js';
import User from '../models/User.js';

export const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req?.headers?.authorization?.split(' ')[1];
    }
    else if (req.cookies.token) {

        token = req.cookies.token;
    }
    console.log("token api", token);

    if (!token) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        //console.log('Decoded token:', decoded);

        if (!decoded._id) {
            return next(new ErrorResponse('Invalid token', 401));
        }

        const userId = typeof decoded._id === 'object' ? decoded._id.toString() : decoded._id;
        //console.log('User ID from token:', userId);

        req.user = await User.findById(userId);
        console.log('Found user:', req.user);

        if (!req.user) {
            return next(new ErrorResponse('User not found', 404));
        }

        next();
    } catch (error) {
        console.error('Error in protect middleware:', error);
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }
});

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));
        }
        next();
    }
}