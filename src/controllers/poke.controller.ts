import { Request, Response } from 'express';
import User from '../models/User';
import Poke from '../models/Poke';
import Transaction from '../models/Transaction';
import Notification from '../models/Notification';
import { CONSTANTS } from '../config/constants';
import { validationResult } from 'express-validator';

export const sendPoke = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const fromUserId = (req as any).user._id;
    const toUserId = req.params.userId;
    const { adTaskId } = req.body;

    // Check if users are the same
    if (fromUserId.toString() === toUserId) {
      return res.status(400).json({ 
        message: 'You cannot poke yourself' 
      });
    }

    // Get both users
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId),
      User.findById(toUserId)
    ]);

    if (!fromUser || !toUser) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    // Check if users are active
    if (!fromUser.isActive || !toUser.isActive) {
      return res.status(400).json({ 
        message: 'Cannot poke deactivated user' 
      });
    }

    // Check daily poke limits for sender
    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily limits if new day
    if (!fromUser.dailyPokes?.date || fromUser.dailyPokes.date !== today) {
      fromUser.dailyPokes = {
        date: today,
        pokesSent: 0,
        pokesReceived: 0,
        pokedUsers: [],
        receivedFrom: []
      };
    }

    if (!toUser.dailyPokes?.date || toUser.dailyPokes.date !== today) {
      toUser.dailyPokes = {
        date: today,
        pokesSent: 0,
        pokesReceived: 0,
        pokedUsers: [],
        receivedFrom: []
      };
    }

    // Check sender's daily limit
    if (fromUser.dailyPokes.pokesSent >= CONSTANTS.DAILY_POKE_LIMITS.SEND) {
      return res.status(400).json({ 
        message: 'Daily poke send limit reached (2 pokes per day)' 
      });
    }

    // Check if already poked this user today
    if (fromUser.dailyPokes.pokedUsers.includes(toUser._id)) {
      return res.status(400).json({ 
        message: 'You have already poked this user today' 
      });
    }

    // Check receiver's daily limit
    if (toUser.dailyPokes.pokesReceived >= CONSTANTS.DAILY_POKE_LIMITS.RECEIVE) {
      return res.status(400).json({ 
        message: 'This user has reached their daily poke receive limit' 
      });
    }

    // Check if already received from this user today
    if (toUser.dailyPokes.receivedFrom.includes(fromUser._id)) {
      return res.status(400).json({ 
        message: 'You have already received a poke from this user today' 
      });
    }

    // AD TASK VALIDATION (Critical Business Rule)
    if (CONSTANTS.AD_REQUIRED && !adTaskId) {
      return res.status(400).json({ 
        message: 'Ad task completion is required before poking' 
      });
    }

    // In real implementation, validate adTaskId with ad service
    // For now, we'll simulate ad validation
    const adValid = true; // In production, validate with ad service

    if (CONSTANTS.AD_REQUIRED && !adValid) {
      return res.status(400).json({ 
        message: 'Ad task not completed or invalid' 
      });
    }

    // Create poke transaction
    const poke = await Poke.create({
      fromUser: fromUser._id,
      toUser: toUser._id,
      pointsEarned: CONSTANTS.POINTS_PER_POKE,
      adWatched: CONSTANTS.AD_REQUIRED,
      adTaskId: adTaskId,
      status: 'completed'
    });

    // Update user stats and daily limits
    // For sender
    fromUser.pokesSent += 1;
    fromUser.points += CONSTANTS.POINTS_PER_POKE;
    fromUser.dailyPokes.pokesSent += 1;
    fromUser.dailyPokes.pokedUsers.push(toUser._id);

    // Update streak
    const todayDate = new Date();
    if (!fromUser.lastPokeDate) {
      fromUser.streak = 1;
    } else {
      const lastPokeDate = new Date(fromUser.lastPokeDate);
      const diffDays = Math.floor((todayDate.getTime() - lastPokeDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Consecutive day
        fromUser.streak += 1;
      } else if (diffDays > 1) {
        // Streak broken
        fromUser.streak = 1;
      }
    }
    fromUser.lastPokeDate = todayDate;

    // For receiver
    toUser.pokesReceived += 1;
    toUser.points += CONSTANTS.POINTS_PER_POKE;
    toUser.dailyPokes.pokesReceived += 1;
    toUser.dailyPokes.receivedFrom.push(fromUser._id);

    // Save both users
    await Promise.all([
      fromUser.save(),
      toUser.save()
    ]);

    // Create transactions for both users
    const transactionPromises = [
      Transaction.create({
        user: fromUser._id,
        type: 'poke',
        amount: CONSTANTS.POINTS_PER_POKE,
        balanceBefore: fromUser.points - CONSTANTS.POINTS_PER_POKE,
        balanceAfter: fromUser.points,
        description: `Poke sent to @${toUser.username}`,
        status: 'completed',
        metadata: { pokeId: poke._id, toUserId: toUser._id }
      }),
      Transaction.create({
        user: toUser._id,
        type: 'poke',
        amount: CONSTANTS.POINTS_PER_POKE,
        balanceBefore: toUser.points - CONSTANTS.POINTS_PER_POKE,
        balanceAfter: toUser.points,
        description: `Poke received from @${fromUser.username}`,
        status: 'completed',
        metadata: { pokeId: poke._id, fromUserId: fromUser._id }
      })
    ];

    // Create notifications
    const notificationPromises = [
      Notification.create({
        user: toUser._id,
        type: 'poke',
        title: 'New Poke!',
        message: `${fromUser.username} poked you and earned ${CONSTANTS.POINTS_PER_POKE} points`,
        data: { fromUser: fromUser.username, points: CONSTANTS.POINTS_PER_POKE, pokeId: poke._id },
        priority: 'high'
      })
    ];

    await Promise.all([...transactionPromises, ...notificationPromises]);

    // Get updated poke with user data
    const populatedPoke = await Poke.findById(poke._id)
      .populate('fromUser', 'username avatar')
      .populate('toUser', 'username avatar');

    res.status(200).json({
      success: true,
      message: `Successfully poked ${toUser.username}! Both earned ${CONSTANTS.POINTS_PER_POKE} points`,
      poke: populatedPoke,
      sender: {
        remainingSends: Math.max(0, CONSTANTS.DAILY_POKE_LIMITS.SEND - fromUser.dailyPokes.pokesSent)
      }
    });

  } catch (error: any) {
    console.error('Send poke error:', error);
    res.status(500).json({ 
      message: 'Server error sending poke',
      error: error.message 
    });
  }
};

export const getPokeHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { page = 1, limit = 20, type = 'all' } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    let query: any = {};
    
    if (type === 'sent') {
      query.fromUser = userId;
    } else if (type === 'received') {
      query.toUser = userId;
    } else {
      query.$or = [
        { fromUser: userId },
        { toUser: userId }
      ];
    }

    const [pokes, total] = await Promise.all([
      Poke.find(query)
        .populate('fromUser', 'username avatar')
        .populate('toUser', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Poke.countDocuments(query)
    ]);

    // Format response
    const formattedPokes = pokes.map(poke => ({
      id: poke._id,
      fromUser: poke.fromUser,
      toUser: poke.toUser,
      pointsEarned: poke.pointsEarned,
      adWatched: poke.adWatched,
      timestamp: poke.createdAt,
      type: poke.fromUser._id.toString() === userId ? 'sent' : 'received'
    }));

    res.status(200).json({
      success: true,
      pokes: formattedPokes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get poke history error:', error);
    res.status(500).json({ 
      message: 'Server error fetching poke history',
      error: error.message 
    });
  }
};

export const getAvailableUsers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { search, page = 1, limit = 20 } = req.query;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily limits if new day
    if (!user.dailyPokes?.date || user.dailyPokes.date !== today) {
      user.dailyPokes = {
        date: today,
        pokesSent: 0,
        pokesReceived: 0,
        pokedUsers: [],
        receivedFrom: []
      };
      await user.save();
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Users you haven't poked today, excluding yourself
    const query: any = { 
      _id: { 
        $ne: userId,
        $nin: user.dailyPokes?.pokedUsers || [] 
      },
      isActive: true 
    };

    if (search) {
      query.username = { $regex: search, $options: 'i' };
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('username email points pokesSent pokesReceived streak rank isOnline avatar')
        .sort({ points: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query)
    ]);

    // Check if user can poke each user (receiver's daily limit)
    const usersWithStatus = await Promise.all(
      users.map(async (targetUser) => {
        const canReceive = targetUser.dailyPokes?.pokesReceived < CONSTANTS.DAILY_POKE_LIMITS.RECEIVE &&
          !targetUser.dailyPokes?.receivedFrom?.includes(userId);
        
        return {
          ...targetUser.toObject(),
          canPoke: canReceive && user.dailyPokes.pokesSent < CONSTANTS.DAILY_POKE_LIMITS.SEND,
          reason: !canReceive ? 'User has reached daily receive limit' : 
                  user.dailyPokes.pokesSent >= CONSTANTS.DAILY_POKE_LIMITS.SEND ? 'You have reached daily send limit' : null
        };
      })
    );

    res.status(200).json({
      success: true,
      users: usersWithStatus,
      dailyLimits: {
        remainingSends: Math.max(0, CONSTANTS.DAILY_POKE_LIMITS.SEND - (user.dailyPokes?.pokesSent || 0)),
        remainingReceives: Math.max(0, CONSTANTS.DAILY_POKE_LIMITS.RECEIVE - (user.dailyPokes?.pokesReceived || 0))
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get available users error:', error);
    res.status(500).json({ 
      message: 'Server error fetching available users',
      error: error.message 
    });
  }
};
