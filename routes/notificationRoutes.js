import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// User notification routes
router.route('/')
    .get(notificationController.getNotifications);

router.route('/read-all')
    .put(notificationController.markAllNotificationsAsRead);

router.route('/:id')
    .get(notificationController.getNotification)
    .delete(notificationController.deleteNotification);

router.route('/:id/read')
    .put(notificationController.markNotificationAsRead);

// Admin only routes for sending notifications
router.route('/user/:userId')
    .post(authorize('admin'), notificationController.sendUserNotification);

router.route('/group/:groupName')
    .post(authorize('admin'), notificationController.sendGroupNotification);

router.route('/broadcast')
    .post(authorize('admin'), notificationController.sendBroadcastNotification);

export default router; 