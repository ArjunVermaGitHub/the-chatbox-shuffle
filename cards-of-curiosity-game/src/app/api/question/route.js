import { auth, currentUser } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import Question from '@/models/Question';

export async function POST(request) {
  try {
    const { question } = await request.json();

    if (!question || !question.trim()) {
      return Response.json({ error: 'Question is required' }, { status: 400 });
    }

    await connectDB();

    // Try to get user info (optional - allow anonymous submissions)
    let userId = null;
    let email = null;

    try {
      const { userId: clerkUserId } = await auth();
      if (clerkUserId) {
        userId = clerkUserId;
        const user = await currentUser();
        if (user) {
          email = user.emailAddresses?.[0]?.emailAddress || null;
        }
      }
    } catch (error) {
      // User not authenticated, allow anonymous submission
      console.log('Anonymous question submission');
    }

    // Save question to database
    const newQuestion = new Question({
      question: question.trim(),
      userId: userId || null,
      email: email || null,
      status: 'pending'
    });

    await newQuestion.save();

    return Response.json({ 
      success: true, 
      message: 'Question submitted successfully',
      id: newQuestion._id
    }, { status: 201 });

  } catch (error) {
    console.error('Error submitting question:', error);
    return Response.json(
      { error: 'Failed to submit question', details: error.message },
      { status: 500 }
    );
  }
}

