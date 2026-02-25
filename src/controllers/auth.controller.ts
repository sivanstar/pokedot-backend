import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Coupon from '../models/Coupon';
import { CONSTANTS } from '../config/constants';

const generateToken = (id: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  
  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, couponCode, referralCode } = req.body;

    console.log('Registration attempt:', { username, email, couponCode });

    // Validate coupon code
    const coupon = await Coupon.findOne({ 
      code: couponCode?.toUpperCase(),
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });

    if (!coupon) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired coupon code' 
      });
    }

    if (coupon.timesUsed >= coupon.maxUses) {
      return res.status(400).json({ 
        success: false,
        message: 'Coupon code has reached maximum usage limit' 
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists with this email or username' 
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      couponCodeUsed: coupon.code,
      points: CONSTANTS.SIGNUP_BONUS
    });

    // Mark coupon as used
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

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data
    const userData = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      token,
      user: userData
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password') as IUser;
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Account is deactivated' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Update online status
    user.isOnline = true;
    await user.save();

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data
    const userData = await User.findById(user._id).select('-password');

    res.status(200).json({
      success: true,
      token,
      user: userData
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

export const checkCoupon = async (req: Request, res: Response) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({ 
        success: false,
        message: 'Coupon code is required' 
      });
    }

    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });

    if (!coupon) {
      return res.status(400).json({ 
        success: false,
        valid: false,
        message: 'Invalid or expired coupon code' 
      });
    }

    if (coupon.timesUsed >= coupon.maxUses) {
      return res.status(400).json({ 
        success: false,
        valid: false,
        message: 'Coupon code has reached maximum usage limit' 
      });
    }

    res.status(200).json({
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

  } catch (error: any) {
    console.error('Coupon check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error checking coupon',
      error: error.message
    });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching profile',
      error: error.message
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    
    await User.findByIdAndUpdate(userId, { 
      isOnline: false
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during logout',
      error: error.message
    });
  }
};
