import User from '../models/User.js';
import asyncHandler from 'express-async-handler';
import token from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import ErrorResponse from "../utils/ErrorResponse.js";
import Group from '../models/Group.js';
import Payment from '../models/Payment.js';
import notificationService from '../services/notificationService.js';

/**
 * Helper function to create a standardized API response
 * @param {boolean} success Whether the operation was successful
 * @param {string} message Success or error message
 * @param {*} data Response data (optional)
 * @returns {object} Standardized response object
 */
const createResponse = (success, message, data = null) => {
    const response = {
        status: success ? "success" : "error",
        message
    };
    
    if (data) {
        response.data = data;
    }
    
    return response;
};

/**
 * Helper function to safely extract cookie values
 * @param {string} cookieString The cookie string from headers
 * @param {string} name Cookie name to extract
 * @returns {string|null} Cookie value or null if not found
 */
function getCookieValue(cookieString, name) {
    if (!cookieString) return null;
    
    // Split cookies into array
    const cookieArray = cookieString.split('; ');
    
    // Find cookie with matching name
    const cookie = cookieArray.find(cookie => cookie.startsWith(name + '='));
    
    // Return value or null
    return cookie ? cookie.split('=')[1] : null;
}

/**
 * Set secure refresh token cookie
 * @param {object} res Express response object
 * @param {string} refreshToken JWT refresh token
 */
const setRefreshTokenCookie = (res, refreshToken) => {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'None',
        secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
        maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
    });
};

/**
 * Handle social login (Google, Facebook)
 * @param {object} socialData Social login data
 * @param {string} socialIdField Name of social ID field
 * @returns {Promise<object>} User and refresh token
 */
const handleSocialLogin = async (socialData, socialIdField) => {
    const { email, picture, fullname } = socialData;
    const socialId = socialData[socialIdField];
    
    let user = await User.findOne({ email });
    let refreshToken;
    
    if (!user) {
        // Create new user
        user = await User.create({
            [socialIdField]: socialId,
            userId: uuidv4(),
            email: email,
            username: email,
            profile: { 
                picture: picture, 
                fullname: fullname 
            },
            role: 'student',
            status: 'active'
        });
        
        refreshToken = token.generateRefreshToken(user._id);
        user.refreshToken = refreshToken;
        await user.save();
        
    } else if (user && user[socialIdField] === socialId) {
        // Existing user with matching socialId
        refreshToken = token.generateRefreshToken(user._id);
        await User.findByIdAndUpdate(user._id, { refreshToken }, { new: true });
        
    } else if (user && user[socialIdField] !== socialId) {
        // Existing user without this socialId
        refreshToken = token.generateRefreshToken(user._id);
        user[socialIdField] = socialId;
        
        // Update profile if provided
        if (picture) user.profile.picture = picture;
        if (fullname) user.profile.fullname = fullname;
        
        user.refreshToken = refreshToken;
        await user.save();
    }
    
    return { user, refreshToken };
};

/**
 * Validate email format
 * @param {string} email Email to validate
 * @returns {boolean} True if valid
 */
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validate password strength
 * @param {string} password Password to validate
 * @returns {boolean} True if valid
 */
const isValidPassword = (password) => {
    return password.length >= 8 && 
           /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[a-zA-Z\d!@#$%^&*(),.?":{}|<>]{8,}$/.test(password);
};

/**
 * Generate verification code
 * @returns {object} Code and expiry
 */
const generateVerificationCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000);
    const expire = Date.now() + 10 * 60 * 1000; // 10 minutes
    return { code, expire };
};

// @desc    Verify user account with code
// @route   POST /api/v1/users/verify-account
// @access  Public
const verifyAccountCtrl = asyncHandler(async (req, res, next) => {
    const { email, code } = req.body;
    
    if (!email || !code) {
        return next(new ErrorResponse('Please provide email and verification code', 400));
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
        return next(new ErrorResponse(`User not found with email of ${email}`, 404));
    }
    
    if (user.verifyCode == code) {
        user.status = 'active';
        user.verifyCode = '';
        await user.save();
        
        res.status(200).json(createResponse(true, "Verify account successfully"));
    } else {
        return next(new ErrorResponse(`Invalid verification code`, 400));
    }
});

// @desc    Register a new user
// @route   POST /api/v1/users/register
// @access  Public
const registerUserCtrl = asyncHandler(async (req, res, next) => {
    const { username, email, password, fullname } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
        return next(new ErrorResponse('Please provide username, email and password', 400));
    }
    
    if (!isValidEmail(email)) {
        return next(new ErrorResponse('Please provide a valid email address', 400));
    }
    
    if (!isValidPassword(password)) {
        return next(new ErrorResponse('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number and one special character', 400));
    }
    
    // Check if user already exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
        return next(new ErrorResponse('Email already registered', 400));
    }
    
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
        return next(new ErrorResponse('Username already taken', 400));
    }
    
    // Create new user
    const userId = uuidv4();
    const user = await User.create({
        userId: userId,
        profile: {
            fullname: fullname || username,
        },
        username,
        email,
        password // Password will be hashed in the User model pre-save hook
    });
    
    // Generate verification code
    const { code, expire } = generateVerificationCode();
    user.verifyCode = code;
    user.verifyCodeExpired = expire;
    await user.save();
    
    // Send verification email
    const message = `Please enter the following code to verify your account: ${code}`;
    
    try {
        await sendEmail({
            title: 'Verify account',
            email: user.email,
            subject: '[Code Chef] Verify your account. Valid for 10 minutes',
            message
        });
        
        res.status(201).json(createResponse(
            true, 
            "User created successfully. Please check your email for verification code.",
            user
        ));
    } catch (error) {
        // Clear verification code if email fails
        user.verifyCode = '';
        await user.save();
        console.error('Error sending email:', error);
        return next(new ErrorResponse('Account created but verification email could not be sent. Please contact support.', 500));
    }
});

// @desc    Login user
// @route   POST /api/v1/users/login
// @access  Public
const loginUserCtrl = asyncHandler(async (req, res, next) => {
    const { isGoogle, isFacebook, isGitHub } = req.body;
    
    try {
        // Handle Google login
        if (isGoogle) {
            const socialData = {
                email: req.body.email,
                googleId: req.body.googleId,
                picture: req.body.picture,
                fullname: req.body.fullname
            };
            
            const { user, refreshToken } = await handleSocialLogin(socialData, 'googleId');
            
            // Set refresh token cookie
            setRefreshTokenCookie(res, refreshToken);
            
            // Send response
            res.status(200).json(createResponse(
                true,
                "Login successfully",
                {
                    user,
                    token: token.generateToken(user._id)
                }
            ));
        }
        // Handle Facebook login
        else if (isFacebook) {
            const socialData = {
                email: req.body.email,
                facebookId: req.body.facebookId,
                picture: req.body.picture,
                fullname: req.body.fullname
            };
            
            const { user, refreshToken } = await handleSocialLogin(socialData, 'facebookId');
            
            // Set refresh token cookie
            setRefreshTokenCookie(res, refreshToken);
            
            // Send response
            res.status(200).json(createResponse(
                true,
                "Login successfully",
                {
                    user,
                    token: token.generateToken(user._id)
                }
            ));
        }
        // Handle regular login
        else {
            const { email, password } = req.body;
            
            // Validate input
            if (!email || !password) {
                return next(new ErrorResponse('Please provide email and password', 400));
            }
            
            // Find active user
            const user = await User.findOne({ email, status: 'active' });
            
            // Verify password
            if (user && (await bcrypt.compare(password, user.password))) {
                // Generate refresh token
                const refreshToken = token.generateRefreshToken(user._id);
                
                // Save refresh token
                await User.findByIdAndUpdate(user._id, { refreshToken }, { new: true });
                
                // Set refresh token cookie
                setRefreshTokenCookie(res, refreshToken);
                
                // Send response with access token
                res.status(200).json(createResponse(
                    true,
                    "Login successfully",
                    {
                        user,
                        token: token.generateToken(user._id)
                    }
                ));
            } else {
                return next(new ErrorResponse('Invalid credentials', 401));
            }
        }
    } catch (error) {
        return next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Get user profile
// @route   GET /api/v1/users/:id
// @access  Private
const getUserProfileCtrl = asyncHandler(async (req, res, next) => {
    const _id = req.params.userid;
    let user;
    try {
        user = await User.findById(_id)
        .select('-password -refreshToken')
        .populate('enrolled_courses');
    }   
    catch (error) {
        return next(new ErrorResponse('User not found', 404));
    }
    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }
    
    res.status(200).json(createResponse(
        true,
        "Get user profile successfully",
        user
    ));
});

// @desc    Update user profile
// @route   PUT /api/v1/users/:userid
// @access  Private
const updateUserCtrl = asyncHandler(async (req, res, next) => {
    const userId = req.params.userid;
    const filePath = req.file?.path;
    const { fullname, bio, phone } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }
    
    // Check if the authenticated user is updating their own profile
    if (req.user._id.toString() !== userId) {
        return next(new ErrorResponse('Not authorized to update this profile', 403));
    }
    
    // Update user profile fields
    if (fullname) user.profile.fullname = fullname;
    if (bio) user.profile.bio = bio;
    if (phone) user.profile.phone = phone;
    if (filePath) user.profile.picture = filePath;
    
    await user.save();
    
    res.status(200).json(createResponse(
        true,
        "Profile updated successfully",
        user
    ));
});

// @desc    Admin updates user profile
// @route   PUT /api/v1/users/update-by-admin/:userid
// @access  Private/Admin
const updateUserByAdminCtrl = asyncHandler(async (req, res, next) => {
    const adminId = req.params.userid;
    const filePath = req.file?.path;
    const { fullname, bio, phone, userId, status, role } = req.body;
    
    // Validate input
    if (!userId) {
        return next(new ErrorResponse('User ID to update is required', 400));
    }
    
    // Check admin exists
    const admin = await User.findById(adminId);
    if (!admin) {
        return next(new ErrorResponse('Admin user not found', 404));
    }
    
    // Check user to update exists
    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorResponse('User to update not found', 404));
    }
    
    // Update user fields
    if (fullname) user.profile.fullname = fullname;
    if (bio) user.profile.bio = bio;
    if (phone) user.profile.phone = phone;
    if (status) user.status = status;
    if (role) user.role = role;
    if (filePath) user.profile.picture = filePath;
    
    await user.save();
    
    res.status(200).json(createResponse(
        true,
        "User updated successfully by admin",
        user
    ));
});

// @desc    Forgot password
// @route   POST /api/v1/users/forgot-password
// @access  Public
const forgotPasswordCtrl = asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    
    if (!email) {
        return next(new ErrorResponse('Please provide an email address', 400));
    }
    
    if (!isValidEmail(email)) {
        return next(new ErrorResponse('Please provide a valid email address', 400));
    }
    
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
        return next(new ErrorResponse('There is no user with that email', 404));
    }
    
    // Generate reset token
    const resetToken = Math.floor(100000 + Math.random() * 900000);
    const resetExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    // Save to user
    user.verifyForgotPassword = resetToken;
    user.verifyForgotPasswordExpired = resetExpire;
    await user.save();
    
    // Prepare email
    const message = `Please enter the following code to reset your password: ${resetToken}`;
    
    try {
        // Send the email
        await sendEmail({
            email: user.email,
            subject: 'Your Password Reset Token (valid for 10 minutes)',
            message
        });
        
        res.status(200).json(createResponse(
            true,
            'Password reset code sent to email!'
        ));
    } catch (err) {
        // Clear reset data on email failure
        user.verifyForgotPassword = '';
        user.verifyForgotPasswordExpired = '';
        await user.save();
        
        return next(new ErrorResponse('Email could not be sent', 500));
    }
});

// @desc    Reset password
// @route   POST /api/v1/users/reset-password
// @access  Public
const resetPasswordCtrl = asyncHandler(async (req, res, next) => {
    const { code, password } = req.body;
    
    if (!code || !password) {
        return next(new ErrorResponse('Please provide reset code and new password', 400));
    }
    
    if (!isValidPassword(password)) {
        return next(new ErrorResponse('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number and one special character', 400));
    }
    
    try {
        // Find user with valid code
        const user = await User.findOne({ 
            verifyForgotPassword: code, 
            verifyForgotPasswordExpired: { $gt: Date.now() } 
        });
        
        // Check user
        if (!user) {
            return next(new ErrorResponse('Reset code is invalid or has expired', 400));
        }
        
        // Update password
        user.password = password;
        user.verifyForgotPassword = '';
        user.verifyForgotPasswordExpired = '';
        await user.save();
        
        // Send response
        res.status(200).json(createResponse(
            true,
            'Password reset successful!',
            { token: token.generateToken(user._id) }
        ));
    } catch (err) {
        return next(new ErrorResponse('Failed to reset password', 500));
    }
});

// @desc    Delete user (soft delete)
// @route   DELETE /api/v1/users/:userid
// @access  Private/Admin
const deleteUserCtrl = asyncHandler(async (req, res, next) => {
    const userId = req.params.userid;
    
    const user = await User.findById(userId);
    
    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }
    
    // Soft delete - update status to 'removed'
    await User.updateOne({ _id: userId }, { status: 'removed' });
    
    res.status(200).json(createResponse(
        true,
        "User removed successfully"
    ));
});

// @desc    Refresh access token
// @route   POST /api/v1/users/refresh-token
// @access  Public
const refreshAccessTokenCtrl = asyncHandler(async (req, res, next) => {
    const cookie = req.headers.cookie;
    const refreshToken = getCookieValue(cookie, 'refreshToken');
    
    if (!refreshToken) {
        return next(new ErrorResponse('Authentication required. Please login.', 401));
    }
    
    try {
        // Verify token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        
        // Find user with matching refresh token
        const user = await User.findById(decoded._id);
        
        if (!user || user.refreshToken !== refreshToken) {
            return next(new ErrorResponse('Invalid refresh token', 403));
        }
        
        // Set refresh token cookie again
        setRefreshTokenCookie(res, refreshToken);
        
        // Generate new access token
        const newAccessToken = token.generateToken(user._id);
        
        res.status(200).json(createResponse(
            true,
            "Access token refreshed successfully",
            {
                newToken: newAccessToken
            }
        ));
    } catch (error) {
        return next(new ErrorResponse('Invalid refresh token', 403));
    }
});

// @desc    Logout
// @route   POST /api/v1/users/logout
// @access  Private
const logoutCtrl = asyncHandler(async (req, res, next) => {
    const cookie = req.headers.cookie;
    const refreshToken = getCookieValue(cookie, 'refreshToken');
    
    try {
        // Clear refresh token in DB
        await User.findOneAndUpdate(
            { refreshToken }, 
            { refreshToken: '' }
        );
        
        // Clear cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            sameSite: 'None',
            secure: process.env.NODE_ENV === 'production'
        });
        
        res.status(200).json(createResponse(
            true,
            "Logged out successfully"
        ));
    } catch (error) {
        return next(new ErrorResponse('Logout failed', 500));
    }
});

// @desc    Get all users (with filtering and pagination)
// @route   GET api/v1/users?limit=10&page=1&...filters
// @access  Private/Admin/Instructor
const getAllUserCtrl = asyncHandler(async (req, res, next) => {
    const { limit = 10, page = 1, ...filters } = req.query;
    const query = {};
    
    // Check permissions for non-admin users
    if (req.user.role !== 'admin') {
        // Limit access for non-admin users
        const requestedLimit = parseInt(limit);
        const requestedPage = parseInt(page);
        
        if (requestedLimit > 10 || requestedPage > 10) {
            return next(new ErrorResponse('Access limited for non-admin users', 403));
        }
    }
    
    // Apply filters
    if (filters.email) {
        query.email = { $regex: filters.email, $options: 'i' };
    }
    
    if (filters.fullname) {
        query['profile.fullname'] = { $regex: filters.fullname, $options: 'i' };
    }
    
    if (filters.username) {
        query.username = { $regex: filters.username, $options: 'i' };
    }
    
    if (filters.role) {
        query.role = filters.role;
    }
    
    if (filters.courseId) {
        query.enrolled_courses = { $in: [filters.courseId] };
    }
    
    if (filters.status) {
        query.status = filters.status;
    }


    
    // Handle pagination
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    
    // Fetch users
    let users = await User.find(query)
        .select('profile email username role status')
        .limit(parsedLimit)
        .skip(parsedLimit * (parsedPage - 1))
        .sort({ createdAt: -1 });

    if (filters.isPaid === 'true') {
        const paidUsers = await Payment.find({userId: {$in: users.map(user => user._id)}});
        users = users.filter(user => paidUsers.some(paidUser => paidUser.userId.toString() === user._id.toString()));
    }
    else if (filters.isPaid === 'false') {
        const unpaidUsers = await Payment.find({userId: {$in: users.map(user => user._id)}});
        users = users.filter(user => !unpaidUsers.some(unpaidUser => unpaidUser.userId.toString() === user._id.toString()));
    }
        
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    res.status(200).json({
        status: "success",
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        data: {
            users
        }
    });
});

// @desc    GroupUser 
// @route   POST /api/v1/users/groups
// @access  Private/Admin/Instructor
const groupUserCtrl = asyncHandler(async (req, res, next) => {
    const {userIds, groupName, description} = req.body;
    
    const existingGroup = await Group.findOne({ name: groupName });
    if (existingGroup) {
        return next(new ErrorResponse('Group already exists', 400));
    }

    const group = await Group.create({
        name: groupName,
        description: description,
        users: userIds
    });

    await group.save();



    res.status(200).json(createResponse(
        true,
        "Group created successfully",
        group
    ));

});

// @desc    Get all groups
// @route   GET /api/v1/users/groups
// @access  Private/Admin/Instructor
const getAllGroupsCtrl = asyncHandler(async (req, res, next) => {
    const groups = await Group.find().populate('users', 'profile email username role status');



    res.status(200).json(createResponse(
        true,
        "Groups fetched successfully",
        groups
    ));
});

// @desc    Get all users in a group
// @route   GET /api/v1/groups/:groupId
// @access  Private/Admin/Instructor
const getAllUsersInGroupCtrl = asyncHandler(async (req, res, next) => {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId);

    res.status(200).json(createResponse(
        true,
        "Users in group fetched successfully",
        group
    ));
});

// @desc    Add user to group
// @route   POST /api/v1/groups/:groupId
// @access  Private/Admin/Instructor
const addUserToGroupCtrl = asyncHandler(async (req, res, next) => {
    const groupId = req.params.groupId;
    const { userId } = req.body;

    const group = await Group.findById(groupId);
    group.users.push(userId);
    await group.save();

    res.status(200).json(createResponse(
        true,
        "User added to group successfully",
        group
    ));
    
});

// @desc    Remove user from group
// @route   DELETE /api/v1/groups/:groupId
// @access  Private/Admin/Instructor
const removeUserFromGroupCtrl = asyncHandler(async (req, res, next) => {
    const groupId = req.params.groupId;
    const { userId } = req.body;

    const group = await Group.findById(groupId);
    group.users = group.users.filter(id => id.toString() !== userId);
    await group.save(); 

    res.status(200).json(createResponse(
        true,
        "User removed from group successfully",
        group
    ));
    
});

// @desc    Delete group
// @route   DELETE /api/v1/groups/:groupId
// @access  Private/Admin/Instructor
const deleteGroupCtrl = asyncHandler(async (req, res, next) => {
    const groupId = req.params.groupId;
    await Group.findByIdAndDelete(groupId);

    res.status(200).json(createResponse(
        true,
        "Group deleted successfully"
    ));
});

// @desc    Get stats of users  
// @route   GET /api/v1/users/stats
// @access  Private/Admin/Instructor
const getStatsUserCtrl = asyncHandler(async (req, res, next) => {
    const totalUsers = await User.find().countDocuments();
    const activeUsers = await User.find({status: 'active'}).countDocuments();
    const inactiveUsers = await User.find({status: 'inactive'}).countDocuments();
    const removedUsers = await User.find({status: 'removed'}).countDocuments();
    const newUsers = await User.find({createdAt: {$gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}}).countDocuments();
    const students = await User.find({role: 'student'}).countDocuments();
    const instructors = await User.find({role: 'instructor'}).countDocuments();
    const admins = await User.find({role: 'admin'}).countDocuments();

    res.status(200).json(createResponse(
        true,
        "Stats fetched successfully",
        {totalUsers, activeUsers, inactiveUsers, removedUsers, newUsers, students, instructors, admins}   
    ));
});

export default {
    registerUserCtrl,
    loginUserCtrl,
    getUserProfileCtrl,
    updateUserCtrl,
    forgotPasswordCtrl,
    resetPasswordCtrl,
    deleteUserCtrl,
    refreshAccessTokenCtrl,
    logoutCtrl,
    verifyAccountCtrl,
    getAllUserCtrl,
    updateUserByAdminCtrl,
    groupUserCtrl,
    getAllGroupsCtrl,
    getAllUsersInGroupCtrl,
    addUserToGroupCtrl,
    removeUserFromGroupCtrl,
    deleteGroupCtrl,
    getStatsUserCtrl
};