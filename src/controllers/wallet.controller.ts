import { Request, Response } from 'express';
import User from '../models/User';
import Transaction from '../models/Transaction';
import Withdrawal from '../models/Withdrawal';
import Notification from '../models/Notification';
import { CONSTANTS } from '../config/constants';
import { validationResult } from 'express-validator';

export const getWalletBalance = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    
    const user = await User.findById(userId)
      .select('points bankDetails totalEarned totalWithdrawn');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Get total earned (sum of all completed transactions)
    const totalEarnedAgg = await Transaction.aggregate([
      { 
        $match: { 
          user: user._id,
          status: 'completed',
          type: { $in: ['poke', 'signup_bonus', 'referral_bonus', 'milestone_reward'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalEarned = totalEarnedAgg[0]?.total || 0;

    // Get total withdrawn
    const totalWithdrawnAgg = await Transaction.aggregate([
      { 
        $match: { 
          user: user._id,
          type: 'withdrawal',
          status: { $in: ['completed', 'paid'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalWithdrawn = totalWithdrawnAgg[0]?.total || 0;

    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.countDocuments({
      user: user._id,
      status: 'pending'
    });

    // Check withdrawal schedule
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    const isWithdrawalTime = CONSTANTS.WITHDRAWAL_SCHEDULE.DAYS.includes(day) &&
      hour >= CONSTANTS.WITHDRAWAL_SCHEDULE.START_HOUR &&
      hour < CONSTANTS.WITHDRAWAL_SCHEDULE.END_HOUR;

    res.status(200).json({
      success: true,
      balance: user.points,
      totalEarned: user.totalEarned || totalEarned,
      totalWithdrawn: user.totalWithdrawn || totalWithdrawn,
      pendingWithdrawals,
      bankDetails: user.bankDetails || null,
      withdrawalInfo: {
        minAmount: CONSTANTS.MIN_WITHDRAWAL,
        schedule: CONSTANTS.WITHDRAWAL_SCHEDULE,
        isWithdrawalTime,
        nextWithdrawalWindow: getNextWithdrawalWindow()
      }
    });

  } catch (error: any) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching wallet balance',
      error: error.message 
    });
  }
};

// UPDATE BANK DETAILS - FIXED VERSION
export const updateBankDetails = async (req: Request, res: Response) => {
  try {
    console.log('Update bank details called with body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const userId = (req as any).user._id;
    const { bankName, accountName, accountNumber } = req.body;

    console.log('Updating bank details for user:', userId);
    console.log('Bank details:', { bankName, accountName, accountNumber });

    // Validate input
    if (!bankName || !accountName || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'All bank details fields are required'
      });
    }

    // Validate account number (basic validation)
    if (!/^\d+$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Account number must contain only digits'
      });
    }

    if (accountNumber.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Account number must be at least 10 digits'
      });
    }

    // Find and update user
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Found user:', user.username);

    // Update bank details
    user.bankDetails = {
      bankName,
      accountName,
      accountNumber,
      verified: false // Reset verification status on update
    };

    await user.save();
    console.log('Bank details saved successfully');

    // Create notification (optional - might not have Notification model)
    try {
      await Notification.create({
        user: userId,
        type: 'system',
        title: 'Bank Details Updated',
        message: 'Your bank account details have been successfully updated',
        priority: 'low'
      });
    } catch (notifError) {
      console.log('Notification not created (optional)');
    }

    res.status(200).json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: user.bankDetails
    });

  } catch (error: any) {
    console.error('Update bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating bank details: ' + error.message,
      error: error.message
    });
  }
};

export const getTransactionHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { page = 1, limit = 20, type } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { user: userId };
    
    if (type && type !== 'all') {
      query.type = type;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get transaction history error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching transaction history',
      error: error.message 
    });
  }
};

export const requestWithdrawal = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const userId = (req as any).user._id;
    const { amount } = req.body;

    // Check withdrawal amount
    if (amount < CONSTANTS.MIN_WITHDRAWAL) {
      return res.status(400).json({ 
        success: false,
        message: `Minimum withdrawal amount is ${CONSTANTS.MIN_WITHDRAWAL} points` 
      });
    }

    // Check withdrawal schedule
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    const isWithdrawalTime = CONSTANTS.WITHDRAWAL_SCHEDULE.DAYS.includes(day) &&
      hour >= CONSTANTS.WITHDRAWAL_SCHEDULE.START_HOUR &&
      hour < CONSTANTS.WITHDRAWAL_SCHEDULE.END_HOUR;

    if (!isWithdrawalTime) {
      return res.status(400).json({ 
        success: false,
        message: `Withdrawals only allowed on ${getWithdrawalDaysText()} from 4pm to 5pm`,
        nextWindow: getNextWithdrawalWindow()
      });
    }

    // Get user with bank details
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if user has bank details
    if (!user.bankDetails?.bankName || !user.bankDetails?.accountNumber || !user.bankDetails?.accountName) {
      return res.status(400).json({ 
        success: false,
        message: 'Please update your bank account details before withdrawing' 
      });
    }

    // Check balance
    if (user.points < amount) {
      return res.status(400).json({ 
        success: false,
        message: 'Insufficient balance' 
      });
    }

    // Check for pending withdrawals
    const pendingWithdrawals = await Withdrawal.countDocuments({
      user: userId,
      status: 'pending'
    });

    if (pendingWithdrawals > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'You already have a pending withdrawal request' 
      });
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      user: userId,
      amount,
      pointsDeducted: amount,
      bankDetails: {
        bankName: user.bankDetails.bankName,
        accountName: user.bankDetails.accountName,
        accountNumber: user.bankDetails.accountNumber
      },
      status: 'pending',
      reference: `WD${Date.now()}${Math.floor(Math.random() * 1000)}`
    });

    // Deduct points from user
    const balanceBefore = user.points;
    user.points -= amount;
    user.totalWithdrawn = (user.totalWithdrawn || 0) + amount;
    await user.save();

    // Create transaction record
    await Transaction.create({
      user: userId,
      type: 'withdrawal',
      amount: -amount,
      balanceBefore,
      balanceAfter: user.points,
      description: `Withdrawal request #${withdrawal.reference}`,
      status: 'pending',
      reference: withdrawal.reference,
      metadata: { withdrawalId: withdrawal._id }
    });

    // Create notification for user
    await Notification.create({
      user: userId,
      type: 'withdrawal',
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal request of ${amount} points has been submitted and is pending approval`,
      data: { withdrawalId: withdrawal._id, amount, reference: withdrawal.reference },
      priority: 'high'
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      reference: withdrawal.reference,
      newBalance: user.points
    });

  } catch (error: any) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error processing withdrawal request',
      error: error.message 
    });
  }
};

export const getWithdrawalHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { page = 1, limit = 20, status } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { user: userId };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
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
    console.error('Get withdrawal history error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching withdrawal history',
      error: error.message 
    });
  }
};

// Helper functions
function getWithdrawalDaysText(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const withdrawalDays = CONSTANTS.WITHDRAWAL_SCHEDULE.DAYS.map(day => days[day]).join(', ');
  return withdrawalDays;
}

function getNextWithdrawalWindow() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  
  const withdrawalDays = CONSTANTS.WITHDRAWAL_SCHEDULE.DAYS.sort((a, b) => a - b);
  
  let nextDay = withdrawalDays.find(day => day > currentDay);
  if (!nextDay) {
    nextDay = withdrawalDays[0];
  }
  
  let daysUntilNext = nextDay - currentDay;
  if (daysUntilNext < 0) {
    daysUntilNext += 7;
  }
  
  if (withdrawalDays.includes(currentDay) && currentHour >= CONSTANTS.WITHDRAWAL_SCHEDULE.END_HOUR) {
    const nextIndex = withdrawalDays.indexOf(currentDay) + 1;
    nextDay = withdrawalDays[nextIndex] || withdrawalDays[0];
    daysUntilNext = nextDay - currentDay;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7;
    }
  }
  
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntilNext);
  nextDate.setHours(CONSTANTS.WITHDRAWAL_SCHEDULE.START_HOUR, 0, 0, 0);
  
  return {
    nextDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextDay],
    nextDate: nextDate.toISOString(),
    daysUntilNext
  };
}
