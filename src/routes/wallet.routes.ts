import express from 'express';
import { body } from 'express-validator';
import {
  getWalletBalance,
  getTransactionHistory,
  requestWithdrawal,
  getWithdrawalHistory,
  updateBankDetails
} from '../controllers/wallet.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get wallet balance
router.get('/balance', getWalletBalance);

// Get transaction history
router.get('/transactions', getTransactionHistory);

// Update bank details
router.put('/bank-details', [
  body('bankName').notEmpty().withMessage('Bank name is required'),
  body('accountName').notEmpty().withMessage('Account name is required'),
  body('accountNumber').isLength({ min: 10 }).withMessage('Account number must be at least 10 digits')
], updateBankDetails);

// Request withdrawal
router.post('/withdraw', [
  body('amount')
    .isInt({ min: 2000 })
    .withMessage('Minimum withdrawal amount is 2000 points')
], requestWithdrawal);

// Get withdrawal history
router.get('/withdrawals', getWithdrawalHistory);

export default router;
