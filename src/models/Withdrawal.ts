import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [2000, 'Minimum withdrawal amount is 2000 points']
  },
  pointsDeducted: {
    type: Number,
    required: true
  },
  bankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  rejectionReason: String,
  transactionId: {
    type: String,
    unique: true
  },
  reference: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Indexes
withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ createdAt: -1 });

withdrawalSchema.pre('save', function(next) {
  if (!this.reference) {
    this.reference = `WD${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;
