import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clerkId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Career & Ambition',
      'Character & Quirks', 
      'Conflict & Communication',
      'Finances & Money Mindset',
      'Lifestyle & Habits',
      'Love & intimacy',
      'Parenting & Family',
      'Values & Beliefs',
      'Vision & Goals'
    ]
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentIntentId: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema, 'coc_purchases');

