import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pointsValue: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxUses: {
    type: Number,
    default: 1
  },
  timesUsed: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, expiresAt: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
