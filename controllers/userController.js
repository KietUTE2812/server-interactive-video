import User from '../models/User.js';
import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import bcrypt from "bcryptjs"
import { rateLimiter } from '../middlewares/Ratelimiter.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// @desc    Register a new user
// @route   POST /api/v1/users/register
// @access  Public
const registerUserCtrl = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    const userExists = await User.findOne({ email });
    //Kiểm tra xem user đã tồn tại chưa
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }
    //Băm password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    //Tạo user
    const userId = uuidv4();
    const user = await User.create({
        userId: userId,
        username: username,
        email: email,
        password: hashedPassword
    });
    //Kiểm tra user đã tạo chưa
    if (user) {
        res.status(201).json({
            status: "success",
            message: "User created successfully",
            data: user
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
}
);

// @desc    Login user
// @route   POST /api/v1/users/login
// @access  Public
const loginUserCtrl = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    //Kiểm tra xem email và password có tồn tại không
    if (!email || !password) {
        const error = new Error("Please add email and password");
        error.statusCode = 400;
        throw error;
    }
    //Kiểm tra xem user có tồn tại không
    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            status: "success",
            message: "Login successfully",
            data: {
                user,
                token: generateToken(user._id)
            }
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Get user profile
// @route   GET /api/v1/users/profile
// @access  Private
const getUserProfileCtrl = asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (user) {
        res.json({
            status: "success",
            message: "Get user profile successfully",
            data: user
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Update user profile
// @route   PUT /api/v1/users/update-profile
// @access  Private
const updateUserCtrl = asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        if (req.body.password) {
            user.password = req.body.password;
        }
        const updatedUser = await user.save();
        res.json({
            status: "success",
            message: "Update user profile successfully",
            data: updatedUser
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}
);

// @desc    Forgot password
// @route   POST /api/v1/users/forgot-password
// @access  Public
const forgotPasswordCtrl = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    //Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save();
    //Create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/users/reset-password/${resetToken}`;
    const message = `You are receiving this email because you 
    (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;
    try {
        await sendEmail({
            email: user.email,
            subject: '[Code Chef] Password reset token',
            message
        });
        res.json({
            status: "success",
            message: "Email sent"
        });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent');
    }
});

// @desc    Reset password
// @route   GET /api/v1/users/reset-password/:token
// @access  Public
const resetPasswordCtrl = asyncHandler(async (req, res) => {
    const resetPasswordToken = req.params.token;
    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });
    if (!user) {
        res.status(400);
        throw new Error('Invalid token');
    }
    //Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.json({
        status: "success",
        message: "Reset password successfully"
    });
});

// @desc Delete user
// @route DELETE /api/v1/users/:userid
// @access Private/Admin
const deleteUserCtrl = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userid);
    if (user) {
        await User.updateOne({ _id: req.params.userid }, { status: 'removed' });
        res.json({
            status: "success",
            message: "User removed successfully"
        });
    }
    else {
        res.status(404);
        throw new Error('User not found');
    }
});

export { registerUserCtrl, loginUserCtrl, getUserProfileCtrl, updateUserCtrl, forgotPasswordCtrl, resetPasswordCtrl, deleteUserCtrl };