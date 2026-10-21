import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Purchase from '@/models/Purchase';

// Function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function GET(request) {
  try {
    let purchasedCategories = [];
    
    try {
      const { userId } = await auth();
      if (userId) {
        await connectDB();
        console.log('userId 27', userId)
        
        // Find user first to get their ObjectId
        if (userId) {
          // Query purchases table to get all purchased categories for this user
          const purchases = await Purchase.find({ 
            clerkId: userId,
            status: 'completed'
          });
          purchasedCategories = purchases.map(purchase => purchase.category);
          console.log('User found:', userId);
          console.log('Purchases found:', purchases.length);
          console.log('Loaded purchased categories from purchases table:', purchasedCategories);
        } else {
          purchasedCategories = [];
          console.log('User not found in database');
        }
      } else {
        // Check if purchased categories are passed as query parameter (for demo when not authenticated)
        const { searchParams } = new URL(request.url);
        const purchasedParam = searchParams.get('purchased');
        if (purchasedParam) {
          purchasedCategories = JSON.parse(decodeURIComponent(purchasedParam));
          console.log('Using purchased categories from query (demo):', purchasedCategories);
        }
      }
    } catch (dbError) {
      console.log('Auth/DB not available, using empty purchased categories:', dbError.message);
      purchasedCategories = [];
    }

    // Read the Excel file from the public folder
    const filePath = path.join(process.cwd(), 'public', 'CoC Card Questions for Arjun.xlsx');
    const fileBuffer = await fs.readFile(filePath);
    
    // Parse the Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Get the first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Based on the Excel structure:
    // Row 0: [empty, category1, category2, ...]
    // Row 1+: [category, question]
    
    const questionsByCategory = {};
    const categorySet = new Set();
    
    // Process each row starting from row 1 (skip the header row)
    jsonData.slice(1).forEach((row, index) => {
      const category = row[0]; // First column is category
      const question = row[1]; // Second column is question
      
      if (category && question) {
        const cleanCategory = category.toString().trim();
        const cleanQuestion = question.toString().trim();
        
        // Skip empty or invalid entries
        if (cleanCategory && cleanQuestion && 
            !cleanCategory.toLowerCase().includes('category') &&
            !cleanQuestion.toLowerCase().includes('question')) {
          
          if (!questionsByCategory[cleanCategory]) {
            questionsByCategory[cleanCategory] = [];
          }
          
        // Remove serial numbers from questions (e.g., "1. Question text" becomes "Question text")
        const cleanQuestionText = cleanQuestion.replace(/^\d+\.\s*/, '');
        
        questionsByCategory[cleanCategory].push({
          id: `${cleanCategory}-${index}`,
          question: cleanQuestionText,
          category: cleanCategory
        });
          
          categorySet.add(cleanCategory);
        }
      }
    });
    
    // Apply subscription limits - only show first 5 questions for non-purchased categories
    const limitedQuestionsByCategory = {};
    const freeQuestionsByCategory = {};
    
    Object.keys(questionsByCategory).forEach(category => {
      const allQuestions = shuffleArray(questionsByCategory[category]);
      
      if (purchasedCategories.includes(category)) {
        // User has purchased this category - show all questions
        limitedQuestionsByCategory[category] = allQuestions;
        freeQuestionsByCategory[category] = allQuestions;
      } else {
        // User hasn't purchased - show only first 5 questions
        limitedQuestionsByCategory[category] = allQuestions.slice(0, 5);
        freeQuestionsByCategory[category] = allQuestions.slice(0, 5);
      }
    });
    
    console.log('Final categories:', Object.keys(limitedQuestionsByCategory));
    console.log('Purchased categories:', purchasedCategories);
    
    // Calculate total questions for each category (including all questions, not just limited)
    const totalQuestionsByCategory = {};
    Object.keys(questionsByCategory).forEach(category => {
      totalQuestionsByCategory[category] = questionsByCategory[category].length;
    });

    return Response.json({
      categories: Array.from(categorySet),
      questionsByCategory: limitedQuestionsByCategory,
      freeQuestionsByCategory,
      totalQuestionsByCategory,
      purchasedCategories,
      totalQuestions: Object.values(questionsByCategory).reduce((sum, questions) => sum + questions.length, 0)
    });
    
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return Response.json(
      { error: 'Failed to load questions from Excel file' },
      { status: 500 }
    );
  }
}
