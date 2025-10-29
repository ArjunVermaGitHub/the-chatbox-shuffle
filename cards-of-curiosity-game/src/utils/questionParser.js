// Function to fetch questions from the API route
export async function parseQuestionsFromExcel(purchasedCategories = []) {
  try {
    let url = '/api/questions';
    if (purchasedCategories.length > 0) {
      url += `?purchased=${encodeURIComponent(JSON.stringify(purchasedCategories))}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
    
  } catch (error) {
    console.error('Error fetching questions:', error);
    throw new Error('Failed to load questions from Excel file');
  }
}

// Function to get a random question from a specific category
export function getRandomQuestion(questionsByCategory, category) {
  const questions = questionsByCategory[category];
  if (!questions || questions.length === 0) {
    return null;
  }
  
  // Get a random question from the shuffled array
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

// Function to get all questions for a category (already shuffled)
export function getQuestionsForCategory(questionsByCategory, category) {
  return questionsByCategory[category] || [];
}
