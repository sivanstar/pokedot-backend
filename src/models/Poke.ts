import mongoose from 'mongoose';

const pokeSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pointsEarned: {
    type: Number,
    required: true,
    default: 50
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  adWatched: {
    type: Boolean,
    default: false
  },
  adTaskId: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
pokeSchema.index({ fromUser: 1, timestamp: -1 });
pokeSchema.index({ toUser: 1, timestamp: -1 });
pokeSchema.index({ status: 1 });

const Poke = mongoose.model('Poke', pokeSchema);
export default Poke;
