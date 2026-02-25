import { Request, Response } from 'express';
import User from '../models/User';
import { validationResult } from 'express-validator';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { search, page = 1, limit = 20 } = req.query;
    
    const query: any = { 
      _id: { $ne: userId },
      isActive: true 
    };

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('username email points pokesSent pokesReceived streak rank isOnline avatar')
        .sort({ points: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      message: 'Server error fetching users',
      error: error.message 
    });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findById(userId)
      .select('username email points pokesSent pokesReceived streak rank isOnline avatar bio createdAt');

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error: any) {
    console.error('Get user profile error:', error);
    res.status(500).json({ 
      message: 'Server error fetching user profile',
      error: error.message 
    });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).user._id;
    const { username, email, bio, avatar } = req.body;

    // Check if username/email already taken by another user
    if (username || email) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: userId } },
          { $or: [] }
        ]
      });

      if (username) {
        existingUser.$or.push({ username });
      }
      if (email) {
        existingUser.$or.push({ email });
      }

      if (existingUser) {
        return res.status(400).json({ 
          message: 'Username or email already taken' 
        });
      }
    }

    const updateData: any = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      message: 'Server error updating profile',
      error: error.message 
    });
  }
};

export const updateBankDetails = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).user._id;
    const { bankName, accountName, accountNumber } = req.body;

    // Validate account number (Nigerian account numbers are usually 10 digits)
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({ 
        message: 'Account number must be 10 digits' 
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        bankDetails: {
          bankName,
          accountName,
          accountNumber,
          verified: false // Reset verification when details change
        }
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: user.bankDetails
    });

  } catch (error: any) {
    console.error('Update bank details error:', error);
    res.status(500).json({ 
      message: 'Server error updating bank details',
      error: error.message 
    });
  }
};

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { page = 1, limit = 50 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    const [users, total, currentUser] = await Promise.all([
      User.find({ isActive: true })
        .select('username points pokesSent pokesReceived streak rank isOnline avatar')
        .sort({ points: -1, pokesSent: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments({ isActive: true }),
      User.findById(userId)
        .select('username points pokesSent pokesReceived streak rank')
    ]);

    // Calculate user's rank
    const userRank = await User.countDocuments({
      points: { $gt: currentUser?.points || 0 },
      isActive: true
    }) + 1;

    // Format leaderboard entries
    const entries = users.map((user, index) => ({
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      points: user.points,
      pokesSent: user.pokesSent,
      pokesReceived: user.pokesReceived,
      rank: skip + index + 1,
      streak: user.streak,
      isOnline: user.isOnline
    }));

    // User's entry
    const userEntry = {
      userId: currentUser?._id,
      username: currentUser?.username,
      points: currentUser?.points,
      pokesSent: currentUser?.pokesSent,
      pokesReceived: currentUser?.pokesReceived,
      rank: userRank,
      streak: currentUser?.streak
    };

    res.status(200).json({
      success: true,
      entries,
      userEntry,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ 
      message: 'Server error fetching leaderboard',
      error: error.message 
    });
  }
};

export const checkDailyLimits = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = !user.dailyPokes?.date || user.dailyPokes.date !== today;

    if (isNewDay) {
      // Reset daily limits
      user.dailyPokes = {
        date: today,
        pokesSent: 0,
        pokesReceived: 0,
        pokedUsers: [],
        receivedFrom: []
      };
      await user.save();
    }

    const limits = user.dailyPokes || {
      date: today,
      pokesSent: 0,
      pokesReceived: 0,
      pokedUsers: [],
      receivedFrom: []
    };

    res.status(200).json({
      success: true,
      limits: {
        date: limits.date,
        pokesSent: limits.pokesSent,
        pokesReceived: limits.pokesReceived,
        remainingSends: Math.max(0, 2 - (limits.pokesSent || 0)),
        remainingReceives: Math.max(0, 2 - (limits.pokesReceived || 0)),
        pokedUsers: limits.pokedUsers || [],
        receivedFrom: limits.receivedFrom || []
      }
    });

  } catch (error: any) {
    console.error('Check daily limits error:', error);
    res.status(500).json({ 
      message: 'Server error checking daily limits',
      error: error.message 
    });
  }
};

export const getReferralStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    
    const user = await User.findById(userId)
      .populate('referrals', 'username email points createdAt')
      .select('referralCode referralBonusEarned');

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      stats: {
        referralCode: user.referralCode,
        totalReferrals: user.referrals.length,
        referrals: user.referrals,
        earnedPoints: user.referralBonusEarned
      }
    });

  } catch (error: any) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ 
      message: 'Server error fetching referral stats',
      error: error.message 
    });
  }
};
