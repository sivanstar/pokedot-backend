import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Define interface for User document
export interface IUser extends mongoose.Document {
  username: string;
  email: string;
  password: string;
  avatar: string;
  bio: string;
  points: number;
  pokesSent: number;
  pokesReceived: number;
  streak: number;
  lastPokeDate?: Date;
  rank: number;
  role: string;
  isOnline: boolean;
  isActive: boolean;
  couponCodeUsed: string;
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  referrals: mongoose.Types.ObjectId[];
  referralBonusEarned: number;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    verified: boolean;
  };
  dailyPokes?: {
    date: string;
    pokesSent: number;
    pokesReceived: number;
    pokedUsers: mongoose.Types.ObjectId[];
    receivedFrom: mongoose.Types.ObjectId[];
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: [200, 'Bio cannot exceed 200 characters']
  },
  points: {
    type: Number,
    default: 500
  },
  pokesSent: {
    type: Number,
    default: 0
  },
  pokesReceived: {
    type: Number,
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  lastPokeDate: {
    type: Date
  },
  rank: {
    type: Number,
    default: 999
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'vendor'],
    default: 'user'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  couponCodeUsed: {
    type: String,
    required: [true, 'Coupon code is required for registration']
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referrals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  referralBonusEarned: {
    type: Number,
    default: 0
  },
  bankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String,
    verified: {
      type: Boolean,
      default: false
    }
  },
  dailyPokes: {
    date: String,
    pokesSent: {
      type: Number,
      default: 0
    },
    pokesReceived: {
      type: Number,
      default: 0
    },
    pokedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    receivedFrom: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
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

const User = mongoose.model<IUser>('User', userSchema);
export default User;
