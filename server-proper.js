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
  .then(() => console.log('‚úÖ MongoDB Atlas Connected'))
  .catch(err => console.error('‚ùå MongoDB Error:', err));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// ===================== MODELS =====================

// User Schema
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
  rank: { type: Number, default: 999 },
  role: { type: String, enum: ['user', 'admin', 'vendor'], default: 'user' },
  isOnline: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  couponCodeUsed: { type: String, required: true },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  referralBonusEarned: { type: Number, default: 0 },
  bankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String,
    verified: { type: Boolean, default: false }
  },
  dailyPokes: {
    date: String,
    pokesSent: { type: Number, default: 0 },
    pokesReceived: { type: Number, default: 0 },
    pokedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    receivedFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }
}, { timestamps: true });

// Hash password before saving
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

// Compare password method
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

const User = mongoose.model('User', userSchema);

// Coupon Schema
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pointsValue: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  maxUses: { type: Number, default: 1 },
  timesUsed: { type: Number, default: 0 },
  expiresAt: Date
}, { timestamps: true });

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
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

// ===================== ROUTES =====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'POKEDOT Backend is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'POKEDOT API is working!',
    version: '1.0.0'
  });
});

// Check coupon
app.post('/api/auth/check-coupon', async (req, res) => {
  try {
    const { couponCode } = req.body;
    
    if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Coupon code required' });
    }

    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true,
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }]
    });

    if (!coupon) {
      return res.status(400).json({ success: false, valid: false, message: 'Invalid coupon' });
    }

    if (coupon.timesUsed >= coupon.maxUses) {
      return res.status(400).json({ success: false, valid: false, message: 'Coupon used up' });
    }

    res.json({
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        pointsValue: coupon.pointsValue,
        expiresAt: coupon.expiresAt,
        maxUses: coupon.maxUses,
        timesUsed: coupon.timesUsed
      }
    });
  } catch (error) {
    console.error('Coupon check error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, couponCode, referralCode } = req.body;
    console.log('Registration attempt:', { username, email, couponCode });

    // Validate coupon
    const coupon = await Coupon.findOne({ 
      code: couponCode?.toUpperCase(),
      isActive: true,
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }]
    });

    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Invalid coupon code' });
    }

    if (coupon.timesUsed >= coupon.maxUses) {
      return res.status(400).json({ success: false, message: 'Coupon limit reached' });
    }

    // Check existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      couponCodeUsed: coupon.code,
      points: CONSTANTS.SIGNUP_BONUS
    });

    // Update coupon
    coupon.usedBy = user._id;
    coupon.timesUsed += 1;
    await coupon.save();

    // Handle referral
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer && referrer._id.toString() !== user._id.toString()) {
        user.referredBy = referrer._id;
        await user.save();
        referrer.referrals.push(user._id);
        await referrer.save();
      }
    }

    // Generate REAL JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Get user without password
    const userData = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update status
    user.isOnline = true;
    await user.save();

    // Generate REAL JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Get user without password
    const userData = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get profile
app.get('/api/auth/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get users for poking
app.get('/api/users/available', protect, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      isActive: true
    })
    .select('username email points pokesSent pokesReceived streak rank isOnline avatar')
    .limit(20);

    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get leaderboard
app.get('/api/users/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('username points pokesSent pokesReceived streak rank avatar')
      .sort({ points: -1 })
      .limit(50);

    res.json({ success: true, users });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update bank details
app.put('/api/users/account-details', protect, async (req, res) => {
  try {
    const { bankName, accountName, accountNumber } = req.body;
    
    if (!bankName || !accountName || !accountNumber) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { bankDetails: { bankName, accountName, accountNumber, verified: false } },
      { new: true }
    ).select('-password');

    res.json({ 
      success: true, 
      message: 'Bank details updated',
      bankDetails: user.bankDetails
    });
  } catch (error) {
    console.error('Bank details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send poke
app.post('/api/poke/users/:userId/poke', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { adTaskId } = req.body;

    // Check if users are the same
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot poke yourself' });
    }

    // Get both users
    const [sender, receiver] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId)
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check daily limits
    const today = new Date().toISOString().split('T')[0];
    
    // Reset if new day
    if (!sender.dailyPokes?.date || sender.dailyPokes.date !== today) {
      sender.dailyPokes = { date: today, pokesSent: 0, pokesReceived: 0, pokedUsers: [], receivedFrom: [] };
    }
    if (!receiver.dailyPokes?.date || receiver.dailyPokes.date !== today) {
      receiver.dailyPokes = { date: today, pokesSent: 0, pokesReceived: 0, pokedUsers: [], receivedFrom: [] };
    }

    // Check sender's limit
    if (sender.dailyPokes.pokesSent >= CONSTANTS.DAILY_POKE_LIMITS.SEND) {
      return res.status(400).json({ success: false, message: 'Daily send limit reached' });
    }

    // Check receiver's limit
    if (receiver.dailyPokes.pokesReceived >= CONSTANTS.DAILY_POKE_LIMITS.RECEIVE) {
      return res.status(400).json({ success: false, message: 'User receive limit reached' });
    }

    // Check if already poked today
    if (sender.dailyPokes.pokedUsers.includes(receiver._id)) {
      return res.status(400).json({ success: false, message: 'Already poked today' });
    }

    // Ad task validation (simulated)
    if (!adTaskId) {
      return res.status(400).json({ success: false, message: 'Ad task required' });
    }

    // Update points and stats
    sender.points += CONSTANTS.POINTS_PER_POKE;
    sender.pokesSent += 1;
    sender.dailyPokes.pokesSent += 1;
    sender.dailyPokes.pokedUsers.push(receiver._id);

    receiver.points += CONSTANTS.POINTS_PER_POKE;
    receiver.pokesReceived += 1;
    receiver.dailyPokes.pokesReceived += 1;
    receiver.dailyPokes.receivedFrom.push(sender._id);

    // Update streak
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

    res.json({
      success: true,
      message: `Poke successful! Both earned ${CONSTANTS.POINTS_PER_POKE} points`,
      pointsEarned: CONSTANTS.POINTS_PER_POKE,
      senderPoints: sender.points,
      receiverPoints: receiver.points
    });

  } catch (error) {
    console.error('Poke error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get wallet balance
app.get('/api/wallet/balance', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('points bankDetails');
    
    res.json({
      success: true,
      balance: user.points,
      bankDetails: user.bankDetails,
      withdrawalInfo: {
        minAmount: CONSTANTS.MIN_WITHDRAWAL,
        schedule: CONSTANTS.WITHDRAWAL_SCHEDULE
      }
    });
  } catch (error) {
    console.error('Wallet error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Request withdrawal
app.post('/api/wallet/withdraw', protect, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount < CONSTANTS.MIN_WITHDRAWAL) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum withdrawal is ${CONSTANTS.MIN_WITHDRAWAL} points` 
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user.bankDetails?.bankName || !user.bankDetails?.accountNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please update bank details first' 
      });
    }

    if (user.points < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
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
        message: 'Withdrawals only Mon/Wed/Fri 4pm-5pm' 
      });
    }

    // Deduct points
    user.points -= amount;
    await user.save();

    res.json({
      success: true,
      message: 'Withdrawal request submitted',
      newBalance: user.points,
      reference: `WD${Date.now()}`
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get daily limits
app.get('/api/users/daily-limits', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const today = new Date().toISOString().split('T')[0];

    if (!user.dailyPokes?.date || user.dailyPokes.date !== today) {
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Seed admin and coupons (first time setup)
app.post('/api/admin/seed', async (req, res) => {
  try {
    // Create admin user
    let admin = await User.findOne({ email: 'admin@pokedot.com' });
    if (!admin) {
      admin = await User.create({
        username: 'pokedot_admin',
        email: 'admin@pokedot.com',
        password: 'Admin123!@#',
        role: 'admin',
        points: 10000,
        couponCodeUsed: 'ADMIN_SEED',
        isActive: true
      });
      console.log('‚úÖ Admin user created');
    }

    // Create coupon codes
    const coupons = [
      { code: 'WELCOME500', pointsValue: 0, maxUses: 100 },
      { code: 'POKE100', pointsValue: 100, maxUses: 50 },
      { code: 'TEST123', pointsValue: 0, maxUses: 10 },
    ];

    for (const couponData of coupons) {
      let coupon = await Coupon.findOne({ code: couponData.code });
      if (!coupon) {
        coupon = await Coupon.create({
          ...couponData,
          createdBy: admin._id,
          isActive: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        });
        console.log(`‚úÖ Coupon created: ${couponData.code}`);
      }
    }

    res.json({ 
      success: true, 
      message: 'Database seeded successfully',
      admin: { email: 'admin@pokedot.com', password: 'Admin123!@#' }
    });

  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, message: 'Seed failed', error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found', path: req.path });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  Ì∫Ä POKEDOT Backend Server Started
  Ì≥ç Port: ${PORT}
  Ìºê URL: http://localhost:${PORT}
  ÔøΩÔøΩÔ∏è  MongoDB: Connected
  ‚è∞ Time: ${new Date().toLocaleString()}
  `);
  console.log('\nÌ≥ö Available Endpoints:');
  console.log('   GET    /api/health                    - Health check');
  console.log('   GET    /api/test                     - Test endpoint');
  console.log('   POST   /api/auth/check-coupon        - Validate coupon');
  console.log('   POST   /api/auth/register            - Register user');
  console.log('   POST   /api/auth/login               - Login');
  console.log('   GET    /api/auth/profile             - Get profile (protected)');
  console.log('   GET    /api/users/available          - Users to poke (protected)');
  console.log('   GET    /api/users/leaderboard        - Leaderboard');
  console.log('   PUT    /api/users/account-details    - Update bank details (protected)');
  console.log('   POST   /api/poke/users/:userId/poke  - Send poke (protected)');
  console.log('   GET    /api/wallet/balance           - Wallet balance (protected)');
  console.log('   POST   /api/wallet/withdraw          - Request withdrawal (protected)');
  console.log('   GET    /api/users/daily-limits       - Daily limits (protected)');
  console.log('   POST   /api/admin/seed               - Seed database (first time)');
});
