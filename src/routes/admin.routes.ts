import express from 'express';
import { body } from 'express-validator';
import {
  requireAdmin,
  getSystemStats,
  generateCouponCodes,
  getCoupons,
  getWithdrawalRequests,
  processWithdrawal,
  manageUser
} from '../controllers/admin.controller';
import { protect, requireRole } from '../middleware/auth';

const router = express.Router();

// All routes require admin authentication
router.use(protect);
router.use(requireRole(['admin']));

// System stats
router.get('/stats', getSystemStats);

// Coupon management
router.post('/coupons/generate', [
  body('count')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Count must be between 1 and 100'),
  body('pointsValue')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Points value must be a positive number'),
  body('maxUses')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max uses must be at least 1'),
  body('expiresInDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Expiry days must be a positive number')
], generateCouponCodes);

router.get('/coupons', getCoupons);

// Withdrawal management
router.get('/withdrawals', getWithdrawalRequests);
router.post('/withdrawals/process', [
  body('withdrawalId')
    .notEmpty()
    .withMessage('Withdrawal ID is required'),
  body('action')
    .isIn(['approve', 'reject', 'mark_paid'])
    .withMessage('Action must be approve, reject, or mark_paid'),
  body('rejectionReason')
    .optional()
    .trim()
], processWithdrawal);

// User management
router.post('/users/manage', [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  body('action')
    .isIn(['ban', 'unban', 'add_points', 'remove_points'])
    .withMessage('Invalid action'),
  body('points')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Points must be a positive number'),
  body('reason')
    .optional()
    .trim()
], manageUser);

// Admin-only user list (with all details)
router.get('/users', requireAdmin, (req, res) => {
  // Implementation for admin user list
  res.json({ message: 'Admin user list endpoint' });
});

export default router;
