import express from 'express';
import { body } from 'express-validator';
import {
  getUsers,
  getUserProfile,
  updateProfile,
  updateBankDetails,
  getLeaderboard,
  checkDailyLimits,
  getReferralStats
} from '../controllers/user.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get users (for poking)
router.get('/', getUsers);
router.get('/available', getUsers); // Alias for getUsers

// Get specific user profile
router.get('/:userId', getUserProfile);

// Update user profile
router.put('/profile', [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Bio cannot exceed 200 characters')
], updateProfile);

// Update bank account details
router.put('/account-details', [
  body('bankName')
    .notEmpty()
    .withMessage('Bank name is required'),
  body('accountName')
    .notEmpty()
    .withMessage('Account name is required'),
  body('accountNumber')
    .matches(/^\d{10}$/)
    .withMessage('Account number must be 10 digits')
], updateBankDetails);

// Leaderboard
router.get('/leaderboard/all', getLeaderboard);

// Daily limits
router.get('/daily-limits', checkDailyLimits);

// Referral stats
router.get('/referral/stats', getReferralStats);

export default router;
