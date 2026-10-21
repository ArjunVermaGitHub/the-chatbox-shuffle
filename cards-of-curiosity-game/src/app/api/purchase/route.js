import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Purchase from '@/models/Purchase';

export async function POST(request) {
  try {
    const { category } = await request.json();

    if (!category) {
      return Response.json({ error: 'Category is required' }, { status: 400 });
    }

    try {
      // Try to get user ID from auth
      const { userId } = await auth();
      console.log({userId})
      if (userId) {
        // User is authenticated, save to database
        await connectDB();
        console.log('Connecting to DB for user:', userId);
        
        // Find or create user
        console.log('Searching for user with clerkId:', userId);
        
        // Try direct MongoDB query to see what's actually in the collection
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        const directUser = await db.collection('coc_users').findOne({ clerkId: userId });
        console.log('Direct MongoDB query result:', directUser);
        
        // Now try the Mongoose model
        let user = await User.findOne({ clerkId: userId });
        console.log('Mongoose User.findOne result:', user);
        
        // Also try a direct query to see what's in the collection
        const allUsers = await User.find({});
        console.log('All users in collection:', allUsers.map(u => ({ clerkId: u.clerkId, _id: u._id })));
        
        // Use the direct result if Mongoose fails
        if (!user && directUser) {
          console.log('Using direct MongoDB result instead of Mongoose');
          user = directUser;
        }
        
        if (!user) {
          console.log('Creating new user for:', userId);
          user = new User({
            clerkId: userId,
            email: '',
            purchasedCategories: []
          });
          await user.save();
          console.log('New user created:', user._id);
        } else {
          console.log('Existing user found:', user._id);
        }
        
        // Check if user already owns this category in the purchases table
        const existingPurchase = await Purchase.findOne({ 
          clerkId: userId, 
          category: category,
          status: 'completed'
        });
        
        if (existingPurchase) {
          console.log('Purchase already exists for this category');
          return Response.json({ 
            success: true, 
            message: 'Category already purchased',
            category 
          });
        }

        // Create purchase record
        console.log('Creating purchase for category:', category);
        const purchase = new Purchase({
          userId: user._id,
          clerkId: userId,
          category,
          amount: 4.99,
          currency: 'USD',
          status: 'completed'
        });

        await purchase.save();
        console.log('Purchase saved to DB:', purchase._id);

        // Add category to user's purchased categories
        await User.findOneAndUpdate(
          { clerkId: userId },
          { 
            $addToSet: { purchasedCategories: category },
            updatedAt: new Date()
          }
        );

        console.log(`Saved purchase to DB for user ${userId}, category: ${category}`);
        
        return Response.json({ 
          success: true, 
          message: 'Category purchased successfully',
          category 
        });
      } else {
        // No user authenticated, use demo mode
        console.log(`Demo purchase for category: ${category}`);
        
        return Response.json({ 
          success: true, 
          message: 'Category purchased successfully (demo mode)',
          category 
        });
      }
    } catch (dbError) {
      console.log('Database error, using demo mode:', dbError.message);
      
      return Response.json({ 
        success: true, 
        message: 'Category purchased successfully (demo mode)',
        category 
      });
    }

  } catch (error) {
    console.error('Error processing purchase:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
