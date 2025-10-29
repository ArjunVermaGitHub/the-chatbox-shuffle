'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { parseQuestionsFromExcel } from '@/utils/questionParser';
import CategoryTabs from '@/components/CategoryTabs';
import QuestionCard from '@/components/QuestionCard';
import PurchaseButton from '@/components/PurchaseButton';
import Loader from '@/components/Loader';
import styles from './game.module.scss';

// Category color mapping
const categoryColors = {
  'Career & Ambition': '#FF6B6B',
  'Character & Quirks': '#4ECDC4',
  'Conflict & Communication': '#45B7D1',
  'Finances & Money Mindset': '#96CEB4',
  'Lifestyle & Habits': '#FFEAA7',
  'Love & intimacy': '#DDA0DD',
  'Parenting & Family': '#98D8C8',
  'Values & Beliefs': '#F7DC6F',
  'Vision & Goals': '#BB8FCE'
};

export default function GamePage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [questionsByCategory, setQuestionsByCategory] = useState({});
  const [totalQuestionsByCategory, setTotalQuestionsByCategory] = useState({});
  const [purchasedCategories, setPurchasedCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameMode, setGameMode] = useState('normal'); // 'normal', 'mix-all', 'categories'
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Map URL ids to display names used in the questions data
  const idToName = {
    career: 'Career & Ambition',
    character: 'Character & Quirks',
    conflict: 'Conflict & Communication',
    finances: 'Finances & Money Mindset',
    lifestyle: 'Lifestyle & Habits',
    love: 'Love & intimacy',
    parenting: 'Parenting & Family',
    values: 'Values & Beliefs',
    chemistry: 'Chemistry',
    vision: 'Vision & Goals'
  };

  const normalizeCategory = (value) => idToName[value] || value;

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Check URL parameters for game mode
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const categories = urlParams.get('categories');
      const set = urlParams.get('set');
      
      if (mode === 'mix-all') {
        setGameMode('mix-all');
        loadQuestions();
      } else if (categories) {
        setGameMode('categories');
        const categoryList = categories.split(',').map(normalizeCategory);
        setSelectedCategories(categoryList);
        loadQuestions(categoryList);
      } else if (set) {
        // Single category selection from new categories page
        setGameMode('single-category');
        const displayName = normalizeCategory(set);
        setSelectedCategories([displayName]);
        // Clear active category first to prevent showing old question
        setActiveCategory(null);
        // Reset question index first to prevent showing wrong question
        setCurrentQuestionIndex(0);
        // Set loading to true to show loader while questions load
        setLoading(true);
        // Load questions first, then set active category after questions are loaded
        loadQuestions([displayName]).then(() => {
          setActiveCategory(displayName);
        });
      } else {
        setGameMode('normal');
        loadQuestions();
      }
    }
  }, [isLoaded, isSignedIn]);

  const loadQuestions = async (filterCategories = null) => {
    try {
      setLoading(true);
      const data = await parseQuestionsFromExcel();
      setCategories(data.categories);
      setQuestionsByCategory(data.questionsByCategory);
      setTotalQuestionsByCategory(data.totalQuestionsByCategory || {});
      setPurchasedCategories(data.purchasedCategories || []);
      setError(null);
      console.log('Loaded purchased categories on initial load:', data.purchasedCategories);
      
      return data;
    } catch (err) {
      setError('Failed to load questions. Please make sure the Excel file is in the public folder.');
      console.error('Error loading questions:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (category) => {
    try {
      // Call the purchase API
      const response = await fetch('/api/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Add to local state immediately for UI feedback
        const newPurchasedCategories = [...purchasedCategories, category];
        setPurchasedCategories(newPurchasedCategories);
        
        // Reload questions to show all cards for the purchased category
        const data = isSignedIn 
          ? await parseQuestionsFromExcel() 
          : await parseQuestionsFromExcel(newPurchasedCategories);
          
        setQuestionsByCategory(data.questionsByCategory);
        setTotalQuestionsByCategory(data.totalQuestionsByCategory || {});
        
        // Always keep the updated purchased categories to maintain UI state
        if (isSignedIn) {
          // For authenticated users, use data from DB but ensure our purchase is included
          const dbPurchased = data.purchasedCategories || [];
          const combinedPurchased = [...new Set([...dbPurchased, ...newPurchasedCategories])];
          setPurchasedCategories(combinedPurchased);
        } else {
          // For demo users, use our local state
          setPurchasedCategories(newPurchasedCategories);
        }
        
        console.log('Purchase successful:', result.message);
      } else {
        console.error('Purchase failed:', result.error);
      }
    } catch (err) {
      console.error('Error processing purchase:', err);
    }
  };

  const handleCategoryChange = (category) => {
    setCurrentQuestionIndex(0);
    setActiveCategory(category);
  };

  const handleNext = () => {
    const questions = questionsByCategory[activeCategory] || [];
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const getCurrentQuestion = () => {
    if (!activeCategory) {
      return null;
    }
    
    if (activeCategory === 'mix-all') {
      // Get all questions from all categories and shuffle them
      const allQuestions = [];
      categories.forEach(category => {
        if (questionsByCategory[category]) {
          allQuestions.push(...questionsByCategory[category]);
        }
      });
      return allQuestions[currentQuestionIndex] || null;
    }
    
    // Ensure questions exist for this category
    const categoryQuestions = questionsByCategory[activeCategory];
    if (!categoryQuestions || categoryQuestions.length === 0) {
      return null;
    }
    
    // Ensure index is valid
    if (currentQuestionIndex < 0 || currentQuestionIndex >= categoryQuestions.length) {
      return null;
    }
    
    const question = categoryQuestions[currentQuestionIndex];
    
    // Verify the question belongs to the active category
    if (question && question.category === activeCategory) {
      return question;
    }
    
    return null;
  };

  const getQuestionCounts = () => {
    const counts = {};
    categories.forEach(category => {
      // Always show the total number of questions, regardless of purchase status
      counts[category] = totalQuestionsByCategory[category] || 0;
    });
    return counts;
  };

  const getTotalQuestions = () => {
    return categories.reduce((total, category) => {
      return total + (questionsByCategory[category]?.length || 0);
    }, 0);
  };

  // All hooks must be called before any conditional returns
  const currentQuestion = useMemo(() => getCurrentQuestion(), [activeCategory, currentQuestionIndex, questionsByCategory, categories]);
  
  // Don't render question card if loading, or if question doesn't match active category
  // Also ensure questions array exists and has length for the active category
  const questionsForCategory = useMemo(() => {
    return activeCategory === 'mix-all' 
      ? [] // Will be calculated below
      : (questionsByCategory[activeCategory] || []);
  }, [activeCategory, questionsByCategory]);
  
  const shouldShowQuestion = useMemo(() => {
    if (loading) return false;
    if (!currentQuestion) return false;
    if (!activeCategory) return false;
    if (questionsForCategory.length === 0 && activeCategory !== 'mix-all') return false;
    if (currentQuestionIndex >= questionsForCategory.length && activeCategory !== 'mix-all') return false;
    if (activeCategory !== 'mix-all' && currentQuestion.category !== activeCategory) return false;
    return true;
  }, [loading, currentQuestion, activeCategory, questionsForCategory, currentQuestionIndex]);

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return <Loader message="Loading..." />;
  }

  // Show sign-in prompt if not authenticated
  if (!isSignedIn) {
    return (
      <div className={styles.gameContainer}>
        <div className={styles.gameContent}>
          <div className={styles.authPrompt}>
            <div className={styles.authIcon}>🔒</div>
            <h2 className={styles.authTitle}>Sign In Required</h2>
            <p className={styles.authMessage}>
              You need to be signed in to access the Cards of Curiosity game.
            </p>
            <p className={styles.authSubMessage}>
              Please sign in using the button in the navigation bar above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <Loader message="Loading questions..." />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2 className={styles.errorTitle}>Error Loading Questions</h2>
        <p className={styles.errorMessage}>{error}</p>
        <button className={styles.retryButton} onClick={loadQuestions}>
          Try Again
        </button>
      </div>
    );
  }
  
  const getQuestions = () => {
    if (activeCategory === 'mix-all') {
      const allQuestions = [];
      categories.forEach(category => {
        if (questionsByCategory[category]) {
          allQuestions.push(...questionsByCategory[category]);
        }
      });
      return allQuestions;
    }
    return questionsByCategory[activeCategory] || [];
  };
  
  const questions = getQuestions();

  return (
    <div className={styles.gameContainer}>
      <div className={styles.gameContent}>
        {!activeCategory && gameMode !== 'single-category' ? (
                 <CategoryTabs
                   categories={categories}
                   activeCategory={activeCategory}
                   onCategoryChange={handleCategoryChange}
                   questionCounts={getQuestionCounts()}
                   categoryColors={categoryColors}
                   totalQuestions={getTotalQuestions()}
                   purchasedCategories={purchasedCategories}
                   onPurchase={handlePurchase}
                 />
        ) : (
          <div className={styles.gameArea}>
            {shouldShowQuestion ? (
              <QuestionCard
                key={`${activeCategory}-${currentQuestionIndex}`}
                question={currentQuestion}
                onNext={handleNext}
                onPrevious={handlePrevious}
                isFirst={currentQuestionIndex === 0}
                isLast={currentQuestionIndex === questions.length - 1}
                currentIndex={currentQuestionIndex}
                totalQuestions={questions.length}
                categoryColor={activeCategory === 'mix-all' ? '#FF6B6B' : categoryColors[activeCategory] || '#667eea'}
              />
            ) : (
              <div className={styles.noQuestions}>
                <p>No questions available for this category.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
