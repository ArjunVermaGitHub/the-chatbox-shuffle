import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  firstName: String,
  lastName: String,
  purchasedCategories: [{
    type: String,
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
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.User || mongoose.model('User', userSchema, 'coc_users');

