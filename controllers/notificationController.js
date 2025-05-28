import Notification from "../models/Notification.js";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";
import ErrorResponse from "../utils/ErrorResponse.js";
import { getNotificationService } from "../services/notificationService.js";
import Group from "../models/Group.js";

// desc   Get all notifications for a specific user
// route  GET /api/v1/notifications
// access Private
const getNotifications = asyncHandler(async (req, res, next) => {
    const { limit = 10, page = 1, read } = req.query;
    
    // Build filter
    let filter = { user: req.user._id };

    // Search for group
    const group = await Group.findOne({ users: { $in: [req.user._id] } });
    if (group) {
        filter = { $or: [{userGroup: group._id}, {user: req.user._id}] }
    }
    const notifications = await Notification.find(filter)
        .limit(parseInt(limit))
        .skip(parseInt(limit) * (parseInt(page) - 1))
        .sort({ createdAt: -1 });
    
    const count = await Notification.countDocuments(filter);

    res.status(200).json({ 
        success: true, 
        count, 
        data: notifications,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit))
        }
    });
});

// desc   Get single notification
// route  GET /api/v1/notifications/:id
// access Private
const getNotification = asyncHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorResponse(`Notification not found with id of ${req.params.id}`, 404));
    }

    // Check if user owns this notification
    if (notification.user && notification.user.toString() !== req.user._id.toString()) {
        return next(new ErrorResponse(`Not authorized to access this notification`, 401));
    }

    res.status(200).json({ success: true, data: notification });
});

// desc   Mark notification as read
// route  PUT /api/v1/notifications/:id/read
// access Private
const markNotificationAsRead = asyncHandler(async (req, res, next) => {
    let notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorResponse(`Notification not found with id of ${req.params.id}`, 404));
    }

    // Check if user owns this notification
    if (notification.user && notification.user.toString() !== req.user._id.toString()) {
        return next(new ErrorResponse(`Not authorized to access this notification`, 401));
    }

    notification = await Notification.findByIdAndUpdate(
        req.params.id, 
        { read: true }, 
        { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: notification });
});

// desc   Mark all notifications as read
// route  PUT /api/v1/notifications/read-all
// access Private
const markAllNotificationsAsRead = asyncHandler(async (req, res, next) => {
    await Notification.updateMany(
        { user: req.user._id, read: false },
        { read: true }
    );

    res.status(200).json({ success: true, data: {} });
});

// desc   Send notification to a specific user
// route  POST /api/v1/notifications/user/:userId
// access Private/Admin
const sendUserNotification = asyncHandler(async (req, res, next) => {
    const { title, message, link, metadata, htmlContent, isEmail = false } = req.body;
    const { userId } = req.params;

    const notificationService = getNotificationService();
    
    // Determine delivery method based on isEmail flag
    const deliveryMethod = isEmail ? ['in-app', 'email'] : ['in-app'];
    
    // Send notification through Kafka
    await notificationService.sendUserNotification(userId, {
        title,
        message,
        htmlContent,
        link: link || '#',
        metadata: metadata || {},
        deliveryMethod
    });

    res.status(201).json({ 
        success: true, 
        message: `Notification sent successfully${isEmail ? ' with email' : ''}`
    });
});

// desc   Send notification to a group of users
// route  POST /api/v1/notifications/group/:groupName
// access Private/Admin
const sendGroupNotification = asyncHandler(async (req, res, next) => {
    const { title, message, link, metadata, htmlContent, isEmail = false } = req.body;
    const { groupName } = req.params;

    const notificationService = getNotificationService();
    
    // Determine delivery method based on isEmail flag
    const deliveryMethod = isEmail ? ['in-app', 'email'] : ['in-app'];
    
    // Send notification through Kafka
    await notificationService.sendGroupNotification(groupName, {
        title,
        message,
        htmlContent,
        link: link || '#',
        metadata: metadata || {},
        deliveryMethod
    });

    res.status(201).json({ 
        success: true, 
        message: `Group notification sent successfully${isEmail ? ' with email' : ''}`
    });
});

// desc   Send notification to all users
// route  POST /api/v1/notifications/broadcast
// access Private/Admin
const sendBroadcastNotification = asyncHandler(async (req, res, next) => {
    const { title, message, link, metadata, htmlContent, isEmail = false } = req.body;
    
    const notificationService = getNotificationService();
    
    // Determine delivery method based on isEmail flag
    const deliveryMethod = isEmail ? ['in-app', 'email'] : ['in-app'];
    
    // Send notification through Kafka
    await notificationService.sendBroadcastNotification({
        title,
        message,
        htmlContent,
        link: link || '#',
        metadata: metadata || {},
        deliveryMethod
    });

    res.status(201).json({ 
        success: true, 
        message: `Broadcast notification sent successfully${isEmail ? ' with email' : ''}`
    });
});

// desc   Send HTML notification to a specific user
// route  POST /api/v1/notifications/html-user/:userId
// access Private/Admin
const sendHtmlNotification = asyncHandler(async (req, res, next) => {
    const { title, message, htmlContent, link, metadata, deliveryMethod = ['in-app'] } = req.body;
    const { userId } = req.params;

    if (!htmlContent) {
        return next(new ErrorResponse('HTML content is required', 400));
    }

    const notificationService = getNotificationService();
    
    // Send HTML notification
    await notificationService.sendHtmlNotification(userId, {
        title,
        message,
        htmlContent,
        link: link || '#',
        metadata: metadata || {},
        deliveryMethod
    });

    res.status(201).json({ 
        success: true, 
        message: 'HTML notification sent successfully'
    });
});

// desc   Send email notification
// route  POST /api/v1/notifications/email
// access Private/Admin
const sendEmailNotification = asyncHandler(async (req, res, next) => {
    const { title, message, htmlContent, link, metadata, email } = req.body;

    if (!email) {
        return next(new ErrorResponse('Email address is required', 400));
    }

    const notificationService = getNotificationService();
    
    // Send email notification
    await notificationService.sendEmailNotification(email, {
        title,
        message,
        htmlContent,
        link: link || '#',
        metadata: metadata || {}
    });

    res.status(201).json({ 
        success: true, 
        message: 'Email notification queued successfully'
    });
});

// desc   Send email notification to user by ID
// route  POST /api/v1/notifications/email-user/:userId
// access Private/Admin
const sendEmailNotificationToUser = asyncHandler(async (req, res, next) => {
    const { title, message, htmlContent, link, metadata } = req.body;
    const { userId } = req.params;

    // Get user email
    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${userId}`, 404));
    }

    if (!user.email) {
        return next(new ErrorResponse(`User does not have an email address`, 400));
    }

    const notificationService = getNotificationService();
    
    // Send email notification
    await notificationService.sendEmailNotification(user.email, {
        title,
        message,
        htmlContent,
        link: link || '#',
        metadata: { ...metadata, userId },
        user: userId
    });

    res.status(201).json({ 
        success: true, 
        message: 'Email notification queued successfully'
    });
});

// desc   Delete notification
// route  DELETE /api/v1/notifications/:id
// access Private
const deleteNotification = asyncHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorResponse(`Notification not found with id of ${req.params.id}`, 404));
    }

    // Check if user owns this notification
    if (notification.user && notification.user.toString() !== req.user._id.toString()) {
        return next(new ErrorResponse(`Not authorized to delete this notification`, 401));
    }

    await notification.deleteOne();

    res.status(200).json({ success: true, data: {} });
});

// desc   Get all notifications for admin
// route  GET /api/v1/notifications/admin-all
// access Private/Admin
const getAdminNotifications = asyncHandler(async (req, res, next) => {
    const notifications = await Notification.find({});
    res.status(200).json({ success: true, data: notifications });
});

export default { 
    getNotifications, 
    getNotification, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    getAdminNotifications,
    sendUserNotification,
    sendGroupNotification,
    sendBroadcastNotification,
    sendHtmlNotification,
    sendEmailNotification,
    sendEmailNotificationToUser,
    deleteNotification
};