import { Request, Response } from 'express';
import User from '../models/User';
import Coupon from '../models/Coupon';
import Withdrawal from '../models/Withdrawal';
import Transaction from '../models/Transaction';
import Poke from '../models/Poke';
import { CONSTANTS } from '../config/constants';
import { validationResult } from 'express-validator';

// Middleware to check if user is admin
export const requireAdmin = (req: Request, res: Response, next: Function) => {
  if ((req as any).user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

export const getSystemStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalPokes,
      totalPoints,
      pendingWithdrawals,
      totalWithdrawn,
      recentRegistrations,
      recentPokes
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true, isOnline: true }),
      Poke.countDocuments({ status: 'completed' }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$points' } } }]),
      Withdrawal.countDocuments({ status: 'pending' }),
      Withdrawal.aggregate([
        { $match: { status: { $in: ['approved', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.find().sort({ createdAt: -1 }).limit(10).select('username email createdAt points'),
      Poke.find()
        .populate('fromUser', 'username')
        .populate('toUser', 'username')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    // Calculate daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      pokesToday,
      newUsersToday,
      pointsEarnedToday
    ] = await Promise.all([
      Poke.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: today } }),
      Poke.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newToday: newUsersToday || 0
        },
        pokes: {
          total: totalPokes,
          today: pokesToday || 0,
          recent: recentPokes
        },
        points: {
          totalInSystem: totalPoints[0]?.total || 0,
          earnedToday: pointsEarnedToday[0]?.total || 0
        },
        withdrawals: {
          pending: pendingWithdrawals,
          totalProcessed: totalWithdrawn[0]?.total || 0
        },
        recentRegistrations
      }
    });

  } catch (error: any) {
    console.error('Get system stats error:', error);
    res.status(500).json({ 
      message: 'Server error fetching system stats',
      error: error.message 
    });
  }
};

export const generateCouponCodes = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { count = 1, pointsValue = 0, maxUses = 1, expiresInDays } = req.body;
    const adminId = (req as any).user._id;

    const coupons = [];
    const expiresAt = expiresInDays ? 
      new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : 
      null;

    for (let i = 0; i < count; i++) {
      const code = generateCouponCode();
      
      const coupon = await Coupon.create({
        code,
        createdBy: adminId,
        pointsValue,
        maxUses,
        expiresAt
      });

      coupons.push(coupon);
    }

    res.status(201).json({
      success: true,
      message: `${count} coupon code(s) generated successfully`,
      coupons
    });

  } catch (error: any) {
    console.error('Generate coupon codes error:', error);
    res.status(500).json({ 
      message: 'Server error generating coupon codes',
      error: error.message 
    });
  }
};

export const getCoupons = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let query: any = {};
    
    if (status === 'active') {
      query.isActive = true;
      query.$or = [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ];
    } else if (status === 'expired') {
      query.isActive = true;
      query.expiresAt = { $lt: new Date() };
    } else if (status === 'used') {
      query.timesUsed = { $gt: 0 };
    } else if (status === 'unused') {
      query.timesUsed = 0;
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .populate('createdBy', 'username')
        .populate('usedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Coupon.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      coupons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get coupons error:', error);
    res.status(500).json({ 
      message: 'Server error fetching coupons',
      error: error.message 
    });
  }
};

export const getWithdrawalRequests = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status = 'pending' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { status };
    
    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .populate('user', 'username email bankDetails')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Withdrawal.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      withdrawals,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get withdrawal requests error:', error);
    res.status(500).json({ 
      message: 'Server error fetching withdrawal requests',
      error: error.message 
    });
  }
};

export const processWithdrawal = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { withdrawalId, action, rejectionReason } = req.body;
    const adminId = (req as any).user._id;

    const withdrawal = await Withdrawal.findById(withdrawalId)
      .populate('user', 'username email');

    if (!withdrawal) {
      return res.status(404).json({ 
        message: 'Withdrawal request not found' 
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Withdrawal request has already been processed' 
      });
    }

    let newStatus: string;
    let transactionStatus: string;
    let message: string;

    if (action === 'approve') {
      newStatus = 'approved';
      transactionStatus = 'completed';
      message = 'Withdrawal approved successfully';
      
      // TODO: Integrate with payment gateway to process payment
      // For now, we'll just mark it as approved
      
    } else if (action === 'reject') {
      newStatus = 'rejected';
      transactionStatus = 'reversed';
      message = 'Withdrawal rejected';
      
      // Return points to user
      const user = await User.findById(withdrawal.user);
      if (user) {
        user.points += withdrawal.amount;
        await user.save();
      }
      
      // Update transaction
      await Transaction.findOneAndUpdate(
        { reference: withdrawal.reference },
        { 
          status: 'reversed',
          description: `Withdrawal rejected: ${rejectionReason || 'No reason provided'}`
        }
      );
      
    } else if (action === 'mark_paid') {
      if (withdrawal.status !== 'approved') {
        return res.status(400).json({ 
          message: 'Withdrawal must be approved before marking as paid' 
        });
      }
      newStatus = 'paid';
      transactionStatus = 'completed';
      message = 'Withdrawal marked as paid';
      
    } else {
      return res.status(400).json({ 
        message: 'Invalid action. Use "approve", "reject", or "mark_paid"' 
      });
    }

    // Update withdrawal
    withdrawal.status = newStatus;
    withdrawal.processedBy = adminId;
    withdrawal.processedAt = new Date();
    
    if (action === 'reject' && rejectionReason) {
      withdrawal.rejectionReason = rejectionReason;
    }
    
    await withdrawal.save();

    // Update transaction
    if (action !== 'reject') {
      await Transaction.findOneAndUpdate(
        { reference: withdrawal.reference },
        { status: transactionStatus }
      );
    }

    // Create notification for user
    // (Notification will be created by notification service)

    res.status(200).json({
      success: true,
      message,
      withdrawal
    });

  } catch (error: any) {
    console.error('Process withdrawal error:', error);
    res.status(500).json({ 
      message: 'Server error processing withdrawal',
      error: error.message 
    });
  }
};

export const manageUser = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, action, points, reason } = req.body;
    const adminId = (req as any).user._id;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    let message: string;

    switch (action) {
      case 'ban':
        user.isActive = false;
        await user.save();
        message = `User ${user.username} has been banned`;
        break;

      case 'unban':
        user.isActive = true;
        await user.save();
        message = `User ${user.username} has been unbanned`;
        break;

      case 'add_points':
        if (!points || points <= 0) {
          return res.status(400).json({ 
            message: 'Valid points amount is required' 
          });
        }
        
        const balanceBefore = user.points;
        user.points += points;
        await user.save();

        // Create transaction
        await Transaction.create({
          user: userId,
          type: 'admin_adjustment',
          amount: points,
          balanceBefore,
          balanceAfter: user.points,
          description: `Admin adjustment: ${reason || 'No reason provided'}`,
          status: 'completed',
          metadata: { adminId, reason }
        });

        message = `${points} points added to ${user.username}'s account`;
        break;

      case 'remove_points':
        if (!points || points <= 0) {
          return res.status(400).json({ 
            message: 'Valid points amount is required' 
          });
        }

        if (user.points < points) {
          return res.status(400).json({ 
            message: 'User does not have enough points' 
          });
        }

        const balanceBeforeRemove = user.points;
        user.points -= points;
        await user.save();

        // Create transaction
        await Transaction.create({
          user: userId,
          type: 'admin_adjustment',
          amount: -points,
          balanceBefore: balanceBeforeRemove,
          balanceAfter: user.points,
          description: `Admin adjustment: ${reason || 'No reason provided'}`,
          status: 'completed',
          metadata: { adminId, reason }
        });

        message = `${points} points removed from ${user.username}'s account`;
        break;

      default:
        return res.status(400).json({ 
          message: 'Invalid action. Use "ban", "unban", "add_points", or "remove_points"' 
        });
    }

    res.status(200).json({
      success: true,
      message,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        points: user.points,
        isActive: user.isActive
      }
    });

  } catch (error: any) {
    console.error('Manage user error:', error);
    res.status(500).json({ 
      message: 'Server error managing user',
      error: error.message 
    });
  }
};

// Helper function to generate coupon code
function generateCouponCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  // Generate 8-character code
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Add hyphens for readability: XXXX-XXXX
  return `${code.substring(0, 4)}-${code.substring(4)}`;
}
