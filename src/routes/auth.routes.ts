import express from 'express';
import {
  register,
  login,
  checkCoupon,
  logout,
  getProfile
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/check-coupon', checkCoupon);

// Protected routes
router.post('/logout', protect, logout);
router.get('/profile', protect, getProfile);

export default router;
