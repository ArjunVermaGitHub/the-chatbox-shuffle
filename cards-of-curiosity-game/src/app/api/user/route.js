import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    let user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        clerkId: userId,
        email: '', // Will be updated when user signs in
        purchasedCategories: []
      });
      await user.save();
    }

    return Response.json({
      userId: user._id,
      clerkId: user.clerkId,
      purchasedCategories: user.purchasedCategories
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    // Update or create user
    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      { 
        clerkId: userId,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return Response.json({
      userId: user._id,
      clerkId: user.clerkId,
      purchasedCategories: user.purchasedCategories
    });

  } catch (error) {
    console.error('Error creating/updating user:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}


