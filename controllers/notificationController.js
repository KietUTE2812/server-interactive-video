import Notification from "../models/Notification.js";
import asyncHandler from "express-async-handler";
import ErrorResponse from "../utils/ErrorResponse.js";

// desc   Get all notifications
// route  GET /api/v1/notifications
// access Private
const getNotifications = asyncHandler(async (req, res, next) => {
    const {limit=10, page=1, ...filters} = req.query;
    if(!filters.user || req.user._id !== filters.user) {
        return next(new ErrorResponse(`Not authorized to access this route`, 401));
    }
    const notifications = await Notification.find(filters).limit(limit).skip(limit * (page-1)).sort({createdAt:-1});
    const count = await Notification.countDocuments(filters);

    res.status(200).json({ success: true, count, data: notifications });
});

// desc   Get single notification
// route  GET /api/v1/notifications/:id
// access Private
const getNotification = asyncHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorResponse(`Notification not found with id of ${req.params.id}`), 404);
    }

    res.status(200).json({ success: true, data: notification });
});

// desc   Create new notification
// route  POST /api/v1/notifications
// access Private
const createNotification = asyncHandler(async (req, res, next) => {
    const { title, message, link, metadata, userId } = req.body;
    const notification = await Notification.create({
        title,
        message,
        link,
        metadata,
        user: userId
    });

    res.status(201).json({ success: true, data: notification });
});

// desc   Update notification
// route  PUT /api/v1/notifications/:id
// access Private
const updateNotification = asyncHandler(async (req, res, next) => {
    let notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorResponse(`No notification with the id of ${req.params.id}`, 404));
    }

    notification = await Notification.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: notification });
});

// desc   Delete notification
// route  DELETE /api/v1/notifications/:id
// access Private
const deleteNotification = asyncHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorResponse(`Notification not found with id of ${req.params.id}`, 404));
    }

    await notification.remove();

    res.status(200).json({ success: true, data: {} });
});

export default { getNotifications, getNotification, createNotification, updateNotification, deleteNotification };