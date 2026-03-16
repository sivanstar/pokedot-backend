const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const CONSTANTS = {
  POINTS_PER_POKE: 50,
  MIN_WITHDRAWAL: 2000,
  SIGNUP_BONUS: 500,
  REFERRER_BONUS: 300,
  DAILY_POKE_LIMITS: { SEND: 2, RECEIVE: 2 },
  WITHDRAWAL_SCHEDULE: { DAYS: [1, 3, 5], START_HOUR: 16, END_HOUR: 17 }
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Get allowed origins from environment or use defaults
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5175',
  'https://pokedot-frontend.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());
app.use(express.json());

// ===================== MODELS =====================

// PokeTransaction Schema
const pokeTransactionSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, default: CONSTANTS.POINTS_PER_POKE },
  timestamp: { type: Date, default: Date.now },
  senderPointsBefore: Number,
  senderPointsAfter: Number,
  receiverPointsBefore: Number,
  receiverPointsAfter: Number
}, { timestamps: true });

// Withdrawal Schema
const withdrawalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: CONSTANTS.MIN_WITHDRAWAL },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'processing'], default: 'pending' },
  reference: { type: String, required: true, unique: true },
  bankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String
  },
  adminNotes: { type: String, default: '' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date
}, { timestamps: true });

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['poke', 'withdrawal', 'signup_bonus', 'referral_bonus', 'milestone_reward', 'admin_adjustment', 'task_bonus'],
    required: true 
  },
  amount: { type: Number, required: true },
  balanceBefore: Number,
  balanceAfter: Number,
  description: String,
  status: { type: String, enum: ['pending', 'completed', 'failed', 'reversed'], default: 'completed' },
  reference: String,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Notification Schema
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['system', 'withdrawal', 'poke', 'reward'], default: 'system' },
  title: String,
  message: String,
  data: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, { timestamps: true });

// Coupon Schema
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pointsValue: { type: Number, default: 0 },
  maxUses: { type: Number, default: 1 },
  timesUsed: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  expiresAt: Date
}, { timestamps: true });

// User Schema - ADDED TASK FIELDS
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  points: { type: Number, default: CONSTANTS.SIGNUP_BONUS },
  pokesSent: { type: Number, default: 0 },
  pokesReceived: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastPokeDate: Date,
  lastLoginDate: Date,
  loginStreak: { type: Number, default: 0 },
  rank: { type: Number, default: 999 },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isOnline: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  referralBonusEarned: { type: Number, default: 0 },
  bankDetails: {
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    verified: { type: Boolean, default: false }
  },
  dailyPokes: {
    date: String,
    pokesSent: { type: Number, default: 0 },
    pokesReceived: { type: Number, default: 0 },
    pokedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    receivedFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  totalWithdrawn: { type: Number, default: 0 },
  totalEarned: { type: Number, default: CONSTANTS.SIGNUP_BONUS },
  // TASK FIELDS
  lastLoginTaskCompleted: { type: Boolean, default: false },
  dailyTask: {
    lastTaskDate: { type: String, default: '' },
    tasksCompleted: { type: Number, default: 0 },
    lastTaskCompletedAt: { type: Date, default: null },
    taskRequired: { type: Boolean, default: true }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate referral code
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.referralCode = `${this.username.slice(0, 3).toUpperCase()}${randomNum}`;
  }
  next();
});

// Update user ranks
userSchema.statics.updateUserRanks = async function() {
  try {
    const users = await this.find({ isActive: true }).sort({ points: -1 }).select('_id points rank');
    
    const bulkOps = users.map((user, index) => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { rank: index + 1 } }
      }
    }));
    
    if (bulkOps.length > 0) {
      await this.bulkWrite(bulkOps);
    }
    
    console.log(`✅ Updated ranks for ${users.length} users`);
  } catch (error) {
    console.error('Error updating ranks:', error);
  }
};

const User = mongoose.model('User', userSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const PokeTransaction = mongoose.model('PokeTransaction', pokeTransactionSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Coupon = mongoose.model('Coupon', couponSchema);

// ===================== MIDDLEWARE =====================

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const admin = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ===================== WALLET CONTROLLER FUNCTIONS =====================

// Get wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId)
      .select('points bankDetails totalEarned totalWithdrawn');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Get total earned
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

    res.status(200).json({
      success: true,
      balance: user.points,
      totalEarned: user.totalEarned || totalEarned,
      totalWithdrawn: user.totalWithdrawn || totalWithdrawn,
      pendingWithdrawals,
      bankDetails: user.bankDetails || null,
      withdrawalInfo: {
        minAmount: CONSTANTS.MIN_WITHDRAWAL,
        schedule: CONSTANTS.WITHDRAWAL_SCHEDULE
      }
    });

  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching wallet balance',
      error: error.message 
    });
  }
};

// Update bank details
const updateBankDetails = async (req, res) => {
  try {
    console.log('Update bank details called with body:', req.body);
    
    const userId = req.user._id;
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

    // Validate account number
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
      verified: false
    };

    await user.save();
    console.log('Bank details saved successfully');

    res.status(200).json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: user.bankDetails
    });

  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating bank details: ' + error.message,
      error: error.message
    });
  }
};

// Request withdrawal
const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    // Check withdrawal amount
    if (amount < CONSTANTS.MIN_WITHDRAWAL) {
      return res.status(400).json({ 
        success: false,
        message: `Minimum withdrawal amount is ${CONSTANTS.MIN_WITHDRAWAL} points` 
      });
    }

    // Get user
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

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      reference: withdrawal.reference,
      newBalance: user.points
    });

  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error processing withdrawal request',
      error: error.message 
    });
  }
};

// Get transaction history
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    const query = { user: userId };
    
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

  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching transaction history',
      error: error.message 
    });
  }
};

// Get withdrawal history
const getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    const query = { user: userId };
    
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

  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching withdrawal history',
      error: error.message 
    });
  }
};

// ===================== ADMIN CONTROLLER FUNCTIONS =====================

// Get system stats
const getSystemStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalPokes,
      totalPoints,
      pendingWithdrawals,
      totalWithdrawn,
      admins
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      PokeTransaction.countDocuments(),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$points' }, totalEarned: { $sum: '$totalEarned' } } }]),
      Withdrawal.countDocuments({ status: 'pending' }),
      Withdrawal.aggregate([
        { $match: { status: { $in: ['approved', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.countDocuments({ role: 'admin' })
    ]);

    // Calculate daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      pokesToday,
      newUsersToday,
      pointsEarnedToday
    ] = await Promise.all([
      PokeTransaction.countDocuments({ timestamp: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: today } }),
      PokeTransaction.aggregate([
        { $match: { timestamp: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$points' } } }
      ])
    ]);

    const totalPointsResult = totalPoints[0] || { total: 0, totalEarned: 0 };
    const totalWithdrawnResult = totalWithdrawn[0] || { total: 0 };
    const pointsEarnedTodayResult = pointsEarnedToday[0] || { total: 0 };

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalPokes,
        totalPoints: totalPointsResult.total,
        totalEarned: totalPointsResult.totalEarned,
        totalWithdrawn: totalWithdrawnResult.total,
        pendingWithdrawals,
        admins,
        todayUsers: newUsersToday || 0,
        todayPokes: pokesToday || 0,
        todayPoints: pointsEarnedTodayResult.total || 0,
        averagePointsPerUser: totalUsers > 0 ? Math.round(totalPointsResult.total / totalUsers) : 0
      }
    });

  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching system stats',
      error: error.message 
    });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalUsers,
        totalPages: Math.ceil(totalUsers / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Get single user
const getUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const withdrawals = await Withdrawal.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20);

    const pokeTransactions = await PokeTransaction.find({
      $or: [{ sender: userId }, { receiver: userId }]
    })
    .populate('sender', 'username')
    .populate('receiver', 'username')
    .sort({ timestamp: -1 })
    .limit(20);

    res.json({
      success: true,
      user,
      withdrawals,
      pokeTransactions
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      isActive, 
      role, 
      points, 
      totalEarned, 
      totalWithdrawn,
      username,
      email,
      bankDetails,
      bio,
      avatar
    } = req.body;

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role !== undefined) updateData.role = role;
    if (points !== undefined) updateData.points = points;
    if (totalEarned !== undefined) updateData.totalEarned = totalEarned;
    if (totalWithdrawn !== undefined) updateData.totalWithdrawn = totalWithdrawn;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bankDetails !== undefined) updateData.bankDetails = bankDetails;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    await User.updateUserRanks();

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Change user password
const changeUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long' 
      });
    }

    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permanent } = req.query;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (permanent === 'true') {
      await User.findByIdAndDelete(userId);
      await Withdrawal.deleteMany({ user: userId });
      await PokeTransaction.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] });
      await Transaction.deleteMany({ user: userId });
      res.json({ 
        success: true, 
        message: 'User permanently deleted' 
      });
    } else {
      user.isActive = false;
      await user.save();
      res.json({ 
        success: true, 
        message: 'User deactivated successfully' 
      });
    }

    await User.updateUserRanks();
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Get user wallet
const getUserWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('points totalEarned totalWithdrawn bankDetails');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const withdrawals = await Withdrawal.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      wallet: {
        balance: user.points || 0,
        totalEarned: user.totalEarned || 0,
        totalWithdrawn: user.totalWithdrawn || 0,
        bankDetails: user.bankDetails || null
      },
      recentWithdrawals: withdrawals
    });
  } catch (error) {
    console.error('Get user wallet error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Update user wallet
const updateUserWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { points, totalEarned, totalWithdrawn, action, amount, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    let message = '';
    
    if (points !== undefined) {
      user.points = points;
      message = `Points updated to ${points}`;
    }
    
    if (totalEarned !== undefined) {
      user.totalEarned = totalEarned;
      message += message ? ', ' : '';
      message += `Total earned updated to ${totalEarned}`;
    }
    
    if (totalWithdrawn !== undefined) {
      user.totalWithdrawn = totalWithdrawn;
      message += message ? ', ' : '';
      message += `Total withdrawn updated to ${totalWithdrawn}`;
    }

    // Handle manual adjustments
    if (action && amount && reason) {
      const balanceBefore = user.points;
      
      if (action === 'add_points') {
        user.points += amount;
        user.totalEarned += amount;
        message = `Added ${amount} points. Reason: ${reason}`;
      } else if (action === 'subtract_points') {
        user.points = Math.max(0, user.points - amount);
        message = `Subtracted ${amount} points. Reason: ${reason}`;
      } else if (action === 'set_points') {
        user.points = amount;
        message = `Set points to ${amount}. Reason: ${reason}`;
      }

      // Create transaction record
      await Transaction.create({
        user: userId,
        type: 'admin_adjustment',
        amount: action === 'add_points' ? amount : -amount,
        balanceBefore,
        balanceAfter: user.points,
        description: `Admin adjustment: ${reason}`,
        status: 'completed',
        metadata: { adminId: req.user._id, reason }
      });
    }

    await user.save();

    res.json({
      success: true,
      message: message || 'Wallet updated successfully',
      wallet: {
        balance: user.points,
        totalEarned: user.totalEarned,
        totalWithdrawn: user.totalWithdrawn
      }
    });
  } catch (error) {
    console.error('Update wallet error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Get all withdrawals
const getWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '' } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .populate('user', 'username email bankDetails')
        .populate('processedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Withdrawal.countDocuments(query)
    ]);

    const stats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const statsMap = stats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, totalAmount: stat.totalAmount };
      return acc;
    }, {});

    res.json({
      success: true,
      withdrawals,
      stats: statsMap,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Update withdrawal
const updateWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected', 'processing'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status. Must be: approved, rejected, or processing' 
      });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId).populate('user');

    if (!withdrawal) {
      return res.status(404).json({ 
        success: false,
        message: 'Withdrawal not found' 
      });
    }

    // Handle status changes
    if (status === 'approved' && withdrawal.status === 'pending') {
      withdrawal.user.totalWithdrawn += withdrawal.amount;
      await withdrawal.user.save();
      
      // Update transaction
      await Transaction.findOneAndUpdate(
        { reference: withdrawal.reference },
        { status: 'completed' }
      );
    } else if (status === 'rejected' && withdrawal.status === 'pending') {
      withdrawal.user.points += withdrawal.amount;
      await withdrawal.user.save();
      
      // Update transaction
      await Transaction.findOneAndUpdate(
        { reference: withdrawal.reference },
        { status: 'reversed' }
      );
    }

    withdrawal.status = status;
    if (adminNotes) withdrawal.adminNotes = adminNotes;
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    
    await withdrawal.save();

    res.json({
      success: true,
      message: `Withdrawal ${status} successfully`,
      withdrawal
    });
  } catch (error) {
    console.error('Update withdrawal error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Get all poke transactions
const getPokeTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    const query = {};
    if (search) {
      const users = await User.find({
        username: { $regex: search, $options: 'i' }
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      query.$or = [
        { sender: { $in: userIds } },
        { receiver: { $in: userIds } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [pokes, total] = await Promise.all([
      PokeTransaction.find(query)
        .populate('sender', 'username email')
        .populate('receiver', 'username email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PokeTransaction.countDocuments(query)
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPokes = await PokeTransaction.countDocuments({
      timestamp: { $gte: today }
    });

    const totalPointsExchanged = await PokeTransaction.aggregate([
      { $group: { _id: null, total: { $sum: "$points" } } }
    ]);

    res.json({
      success: true,
      pokes,
      stats: {
        total,
        today: todayPokes,
        totalPointsExchanged: totalPointsExchanged[0]?.total || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get poke transactions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Get activities
const getActivities = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const users = await User.find({})
      .select('username email points pokesSent lastPokeDate isOnline updatedAt')
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));

    const withdrawals = await Withdrawal.find({})
      .populate('user', 'username')
      .populate('processedBy', 'username')
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));

    const pokes = await PokeTransaction.find({})
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    const activities = [
      ...users.map(user => ({
        id: user._id,
        type: 'user',
        username: user.username,
        email: user.email,
        action: user.lastPokeDate ? 'Poked recently' : 'Account updated',
        details: {
          points: user.points,
          pokesSent: user.pokesSent,
          isOnline: user.isOnline
        },
        timestamp: user.lastPokeDate || user.updatedAt
      })),
      ...withdrawals.map(withdrawal => ({
        id: withdrawal._id,
        type: 'withdrawal',
        username: withdrawal.user?.username || 'Unknown',
        action: `Withdrawal ${withdrawal.status}`,
        details: {
          amount: withdrawal.amount,
          reference: withdrawal.reference,
          status: withdrawal.status
        },
        timestamp: withdrawal.updatedAt
      })),
      ...pokes.map(poke => ({
        id: poke._id,
        type: 'poke',
        username: poke.sender?.username || 'Unknown',
        action: `Poked ${poke.receiver?.username || 'Unknown'}`,
        details: {
          points: poke.points,
          sender: poke.sender?.username,
          receiver: poke.receiver?.username
        },
        timestamp: poke.timestamp
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, parseInt(limit));

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// Create admin
const createAdmin = async (req, res) => {
  try {
    let admin = await User.findOne({ email: 'admin@pokedot.com' });
    if (!admin) {
      admin = await User.create({
        username: 'pokedot_admin',
        email: 'admin@pokedot.com',
        password: 'Admin123!@#',
        role: 'admin',
        points: 10000,
        totalEarned: 10000,
        loginStreak: 1,
        lastLoginDate: new Date(),
        isActive: true
      });
      console.log('✅ Admin user created');
    }

    res.json({ 
      success: true, 
      message: 'Admin setup complete',
      admin: { email: 'admin@pokedot.com' }
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Setup failed: ' + error.message 
    });
  }
};

// ===================== WALLET ROUTES =====================
const walletRouter = express.Router();
walletRouter.use(protect);
walletRouter.get('/balance', getWalletBalance);
walletRouter.get('/transactions', getTransactionHistory);
walletRouter.put('/bank-details', updateBankDetails);
walletRouter.post('/withdraw', requestWithdrawal);
walletRouter.get('/withdrawals', getWithdrawalHistory);

// Mount wallet routes
app.use('/api/wallet', walletRouter);

// ===================== ADMIN ROUTES =====================
const adminRouter = express.Router();
adminRouter.use(protect);
adminRouter.use(admin);

// Stats
adminRouter.get('/stats', getSystemStats);

// User management
adminRouter.get('/users', getUsers);
adminRouter.get('/users/:userId', getUser);
adminRouter.put('/users/:userId', updateUser);
adminRouter.put('/users/:userId/password', changeUserPassword);
adminRouter.delete('/users/:userId', deleteUser);
adminRouter.get('/users/:userId/wallet', getUserWallet);
adminRouter.put('/users/:userId/wallet', updateUserWallet);

// Withdrawal management
adminRouter.get('/withdrawals', getWithdrawals);
adminRouter.put('/withdrawals/:withdrawalId', updateWithdrawal);

// Poke history
adminRouter.get('/pokes', getPokeTransactions);

// Activities
adminRouter.get('/activities', getActivities);

// Create admin (public route for setup)
adminRouter.post('/create-admin', createAdmin);

// Mount admin routes
app.use('/api/admin', adminRouter);

// ===================== AUTH ROUTES =====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already exists',
        field: 'username' 
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered',
        field: 'email' 
      });
    }

    const user = new User({
      username,
      email,
      password,
      points: CONSTANTS.SIGNUP_BONUS,
      totalEarned: CONSTANTS.SIGNUP_BONUS,
      lastLoginDate: new Date(),
      loginStreak: 1,
      lastLoginTaskCompleted: false
    });

    await user.save();

    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer && referrer._id.toString() !== user._id.toString()) {
        user.referredBy = referrer._id;
        await user.save();
        
        referrer.referrals.push(user._id);
        referrer.points += CONSTANTS.REFERRER_BONUS;
        referrer.referralBonusEarned += CONSTANTS.REFERRER_BONUS;
        referrer.totalEarned += CONSTANTS.REFERRER_BONUS;
        await referrer.save();
      }
    }

    await User.updateUserRanks();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRE || '1h' }
    );

    const userData = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      token,
      user: userData,
      message: 'Account created with 500 free points!'
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === 'username') {
        return res.status(400).json({ 
          success: false, 
          message: 'Username already exists',
          field: 'username'
        });
      } else if (field === 'email') {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already registered',
          field: 'email'
        });
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message 
    });
  }
});

// Login - FIXED: Reset task status on every login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Update online status
    user.isOnline = true;
    
    // CRITICAL FIX: Reset task completion for this new login session
    // This ensures the user sees the task modal on EVERY login
    user.lastLoginTaskCompleted = false;
    
    await user.save();

    await User.updateUserRanks();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRE || '1h' }
    );

    const userData = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get profile
app.get('/api/auth/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get fresh rank calculation
    const rank = await User.countDocuments({
      points: { $gt: user.points },
      isActive: true
    }) + 1;

    // Get referrals count
    const referralsCount = await User.countDocuments({ referredBy: user._id });

    const safeUser = {
      ...user.toObject(),
      rank,
      referralsCount,
      loginStreak: user.loginStreak || 0,
      streak: user.streak || 0,
      pokesSent: user.pokesSent || 0,
      pokesReceived: user.pokesReceived || 0,
      totalEarned: user.totalEarned || CONSTANTS.SIGNUP_BONUS,
      totalWithdrawn: user.totalWithdrawn || 0,
      referralBonusEarned: user.referralBonusEarned || 0,
      bio: user.bio || '',
      avatar: user.avatar || '',
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date()
    };

    res.json({ 
      success: true, 
      user: safeUser
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Update profile
app.put('/api/users/profile', protect, async (req, res) => {
  try {
    const { avatar, bio } = req.body;
    
    const updateData = {};
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ===================== POKE ROUTES =====================

// Get available users
app.get('/api/users/available', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sender = await User.findById(req.user._id);
    
    const users = await User.find({
      _id: { $ne: req.user._id },
      isActive: true
    })
    .select('username email points pokesSent pokesReceived streak loginStreak rank isOnline avatar dailyPokes createdAt')
    .sort({ loginStreak: -1, points: -1 })
    .limit(20);

    const filteredUsers = users.filter(user => {
      const userDaily = user.dailyPokes || {};
      const senderDaily = sender.dailyPokes || {};
      
      const alreadyPoked = senderDaily.pokedUsers?.includes(user._id) || false;
      const canReceive = !userDaily.date || userDaily.date !== today || 
                        (userDaily.pokesReceived || 0) < CONSTANTS.DAILY_POKE_LIMITS.RECEIVE;
      
      return !alreadyPoked && canReceive;
    });

    res.json({ success: true, users: filteredUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get leaderboard
app.get('/api/users/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('username points pokesSent pokesReceived streak loginStreak rank avatar createdAt')
      .sort({ points: -1 })
      .limit(50);

    res.json({ success: true, users });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Send poke
app.post('/api/poke/users/:userId/poke', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { adTaskId } = req.body;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot poke yourself' });
    }

    const [sender, receiver] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId)
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    if (!sender.dailyPokes || sender.dailyPokes.date !== today) {
      sender.dailyPokes = { date: today, pokesSent: 0, pokesReceived: 0, pokedUsers: [], receivedFrom: [] };
    }
    if (!receiver.dailyPokes || receiver.dailyPokes.date !== today) {
      receiver.dailyPokes = { date: today, pokesSent: 0, pokesReceived: 0, pokedUsers: [], receivedFrom: [] };
    }

    if (sender.dailyPokes.pokesSent >= CONSTANTS.DAILY_POKE_LIMITS.SEND) {
      return res.status(400).json({ success: false, message: 'Daily send limit reached (2 per day)' });
    }

    if (receiver.dailyPokes.pokesReceived >= CONSTANTS.DAILY_POKE_LIMITS.RECEIVE) {
      return res.status(400).json({ success: false, message: 'User receive limit reached (2 per day)' });
    }

    if (sender.dailyPokes.pokedUsers.includes(receiver._id)) {
      return res.status(400).json({ success: false, message: 'Already poked this user today' });
    }

    // Store points before update
    const senderPointsBefore = sender.points;
    const receiverPointsBefore = receiver.points;

    // Update both users
    sender.points += CONSTANTS.POINTS_PER_POKE;
    sender.totalEarned += CONSTANTS.POINTS_PER_POKE;
    sender.pokesSent += 1;
    sender.dailyPokes.pokesSent += 1;
    sender.dailyPokes.pokedUsers.push(receiver._id);

    receiver.points += CONSTANTS.POINTS_PER_POKE;
    receiver.totalEarned += CONSTANTS.POINTS_PER_POKE;
    receiver.pokesReceived += 1;
    receiver.dailyPokes.pokesReceived += 1;
    receiver.dailyPokes.receivedFrom.push(sender._id);

    const todayDate = new Date();
    if (!sender.lastPokeDate) {
      sender.streak = 1;
    } else {
      const lastDate = new Date(sender.lastPokeDate);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      sender.streak = diffDays === 1 ? sender.streak + 1 : 1;
    }
    sender.lastPokeDate = todayDate;

    await Promise.all([sender.save(), receiver.save()]);
    
    // Create poke transaction record
    await PokeTransaction.create({
      sender: sender._id,
      receiver: receiver._id,
      points: CONSTANTS.POINTS_PER_POKE,
      senderPointsBefore,
      senderPointsAfter: sender.points,
      receiverPointsBefore,
      receiverPointsAfter: receiver.points,
      timestamp: new Date()
    });

    // Create transaction records for both users
    await Transaction.create({
      user: sender._id,
      type: 'poke',
      amount: CONSTANTS.POINTS_PER_POKE,
      balanceBefore: senderPointsBefore,
      balanceAfter: sender.points,
      description: `Poked ${receiver.username}`,
      status: 'completed',
      metadata: { receiverId: receiver._id }
    });

    await Transaction.create({
      user: receiver._id,
      type: 'poke',
      amount: CONSTANTS.POINTS_PER_POKE,
      balanceBefore: receiverPointsBefore,
      balanceAfter: receiver.points,
      description: `Received poke from ${sender.username}`,
      status: 'completed',
      metadata: { senderId: sender._id }
    });

    await User.updateUserRanks();

    res.json({
      success: true,
      message: `Poke successful! Both earned ${CONSTANTS.POINTS_PER_POKE} points`,
      pointsEarned: CONSTANTS.POINTS_PER_POKE,
      senderPoints: sender.points,
      receiverPoints: receiver.points,
      remainingSends: CONSTANTS.DAILY_POKE_LIMITS.SEND - sender.dailyPokes.pokesSent,
      remainingReceives: CONSTANTS.DAILY_POKE_LIMITS.RECEIVE - receiver.dailyPokes.pokesReceived
    });

  } catch (error) {
    console.error('Poke error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get daily limits
app.get('/api/users/daily-limits', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const today = new Date().toISOString().split('T')[0];

    if (!user.dailyPokes || user.dailyPokes.date !== today) {
      user.dailyPokes = { date: today, pokesSent: 0, pokesReceived: 0, pokedUsers: [], receivedFrom: [] };
      await user.save();
    }

    res.json({
      success: true,
      limits: {
        date: user.dailyPokes.date,
        pokesSent: user.dailyPokes.pokesSent || 0,
        pokesReceived: user.dailyPokes.pokesReceived || 0,
        remainingSends: Math.max(0, CONSTANTS.DAILY_POKE_LIMITS.SEND - (user.dailyPokes.pokesSent || 0)),
        remainingReceives: Math.max(0, CONSTANTS.DAILY_POKE_LIMITS.RECEIVE - (user.dailyPokes.pokesReceived || 0))
      }
    });
  } catch (error) {
    console.error('Daily limits error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get user position
app.get('/api/users/position', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const position = await User.countDocuments({
      points: { $gt: user.points },
      isActive: true
    }) + 1;

    const totalUsers = await User.countDocuments({ isActive: true });

    res.json({
      success: true,
      position,
      totalUsers,
      userPoints: user.points,
      percentage: Math.round((position / totalUsers) * 100)
    });
  } catch (error) {
    console.error('Position error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ===================== TASK ROUTES =====================

// Check if user needs to complete task
app.get('/api/task/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Initialize dailyTask if not exists
    if (!user.dailyTask) {
      user.dailyTask = {
        lastTaskDate: '',
        tasksCompleted: 0,
        lastTaskCompletedAt: null,
        taskRequired: true
      };
      await user.save();
    }

    // Determine if task is needed based on lastLoginTaskCompleted
    // This is set to false on every login, so task will be required each time
    const needsTask = !user.lastLoginTaskCompleted;
    
    console.log(`Task status for ${user.username}: needsTask=${needsTask}, lastLoginTaskCompleted=${user.lastLoginTaskCompleted}`);
    
    res.json({
      success: true,
      needsTask,
      message: needsTask ? 'Please complete a task to continue' : 'Task already completed'
    });
  } catch (error) {
    console.error('Task status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark task as completed
app.post('/api/task/complete', protect, async (req, res) => {
  try {
    const { adTaskId } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Initialize dailyTask if not exists
    if (!user.dailyTask) {
      user.dailyTask = {
        lastTaskDate: '',
        tasksCompleted: 0,
        lastTaskCompletedAt: null,
        taskRequired: true
      };
    }

    // Mark task as completed
    user.lastLoginTaskCompleted = true;
    user.dailyTask.lastTaskDate = today;
    user.dailyTask.tasksCompleted += 1;
    user.dailyTask.lastTaskCompletedAt = new Date();
    
    await user.save();

    console.log(`Login task completed for ${user.username}`);

    res.json({
      success: true,
      message: 'Task completed successfully'
    });

  } catch (error) {
    console.error('Task completion error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get task statistics (for admin)
app.get('/api/admin/task-stats', admin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [totalUsers, usersCompletedToday, totalTasksCompleted] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 
        'dailyTask.lastTaskDate': today,
        'dailyTask.tasksCompleted': { $gt: 0 }
      }),
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$dailyTask.tasksCompleted' } } }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        usersCompletedToday,
        totalTasksCompleted: totalTasksCompleted[0]?.total || 0,
        completionRate: totalUsers > 0 ? Math.round((usersCompletedToday / totalUsers) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Task stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'POKEDOT Backend is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🚀 POKEDOT Backend Server Started
  📊 Port: ${PORT}
  📦 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}
  ⏰ Time: ${new Date().toLocaleString()}
  `);
  console.log('\n📡 Wallet Routes Mounted at /api/wallet:');
  console.log('   ✅ PUT    /api/wallet/bank-details    - Update bank details');
  console.log('   ✅ GET    /api/wallet/balance         - Get wallet balance');
  console.log('   ✅ POST   /api/wallet/withdraw        - Request withdrawal');
  console.log('   ✅ GET    /api/wallet/transactions    - Transaction history');
  console.log('   ✅ GET    /api/wallet/withdrawals     - Withdrawal history');
  
  console.log('\n📡 Admin Routes Mounted at /api/admin:');
  console.log('   ✅ GET    /api/admin/stats            - System statistics');
  console.log('   ✅ GET    /api/admin/users            - List users');
  console.log('   ✅ GET    /api/admin/users/:userId    - Get user details');
  console.log('   ✅ PUT    /api/admin/users/:userId    - Update user');
  console.log('   ✅ PUT    /api/admin/users/:userId/password - Change password');
  console.log('   ✅ DELETE /api/admin/users/:userId    - Delete/deactivate user');
  console.log('   ✅ GET    /api/admin/users/:userId/wallet - Get user wallet');
  console.log('   ✅ PUT    /api/admin/users/:userId/wallet - Update user wallet');
  console.log('   ✅ GET    /api/admin/withdrawals      - List withdrawals');
  console.log('   ✅ PUT    /api/admin/withdrawals/:withdrawalId - Update withdrawal');
  console.log('   ✅ GET    /api/admin/pokes            - Poke history');
  console.log('   ✅ GET    /api/admin/activities       - Recent activities');
  console.log('   ✅ GET    /api/admin/task-stats       - Task completion stats');
  console.log('   ✅ POST   /api/admin/create-admin     - Create admin user');
  
  console.log('\n📡 Task Routes Mounted at /api/task:');
  console.log('   ✅ GET    /api/task/status            - Check if task needed (resets on every login)');
  console.log('   ✅ POST   /api/task/complete          - Mark task completed');
});
