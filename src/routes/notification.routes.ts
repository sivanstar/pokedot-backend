import express from 'express';
import { body } from 'express-validator';
import {
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications
} from '../controllers/notification.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get notifications
router.get('/', getNotifications);

// Mark as read
router.post('/mark-read', [
  body('notificationId')
    .optional()
    .isMongoId()
    .withMessage('Valid notification ID is required'),
  body('markAll')
    .optional()
    .isBoolean()
    .withMessage('markAll must be a boolean')
], markAsRead);

// Delete notification
router.delete('/:notificationId', deleteNotification);

// Clear all notifications
router.delete('/', clearAllNotifications);

export default router;
