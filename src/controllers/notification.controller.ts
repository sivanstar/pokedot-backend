import { Request, Response } from 'express';
import Notification from '../models/Notification';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { page = 1, limit = 20, unreadOnly } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { user: userId };
    
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, read: false })
    ]);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      message: 'Server error fetching notifications',
      error: error.message 
    });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { notificationId, markAll } = req.body;

    if (markAll) {
      // Mark all as read
      await Notification.updateMany(
        { user: userId, read: false },
        { read: true }
      );

      const unreadCount = await Notification.countDocuments({ 
        user: userId, 
        read: false 
      });

      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        unreadCount
      });
    }

    if (!notificationId) {
      return res.status(400).json({ 
        message: 'Notification ID is required' 
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ 
        message: 'Notification not found' 
      });
    }

    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      read: false 
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
      unreadCount
    });

  } catch (error: any) {
    console.error('Mark as read error:', error);
    res.status(500).json({ 
      message: 'Server error marking notification as read',
      error: error.message 
    });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({ 
        message: 'Notification not found' 
      });
    }

    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      read: false 
    });

    res.status(200).json({
      success: true,
      message: 'Notification deleted',
      unreadCount
    });

  } catch (error: any) {
    console.error('Delete notification error:', error);
    res.status(500).json({ 
      message: 'Server error deleting notification',
      error: error.message 
    });
  }
};

export const clearAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;

    await Notification.deleteMany({ user: userId });

    res.status(200).json({
      success: true,
      message: 'All notifications cleared',
      unreadCount: 0
    });

  } catch (error: any) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ 
      message: 'Server error clearing notifications',
      error: error.message 
    });
  }
};
