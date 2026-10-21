'use client';

import { useRouter } from 'next/navigation';
import styles from './QuestionCard.module.scss';

export default function QuestionCard({ question, onNext, onPrevious, isFirst, isLast, currentIndex, totalQuestions, categoryColor }) {
  const router = useRouter();

  const handleNext = () => {
    onNext();
  };

  const handlePrevious = () => {
    onPrevious();
  };

  const handleClose = () => {
    router.push('/categories');
  };

  return (
    <div className={styles.cardContainer}>
      <div className={styles.questionOverlay}>
        <div className={styles.cardHeader}>
          <div className={styles.progress}>
            Question {currentIndex + 1} of {totalQuestions}
          </div>
          <div className={styles.categoryTitle}>
            {question.category.toUpperCase()}
          </div>
          <button className={styles.closeButton} onClick={handleClose}>
            ✕
          </button>
        </div>
        
        <div className={styles.cardContent}>
          <h3 className={styles.questionText}>{question.question}</h3>
        </div>
        
        <div className={styles.cardControls}>
          <button 
            className={`${styles.controlBtn} ${styles.previousBtn} ${isFirst ? styles.disabled : ''}`}
            onClick={handlePrevious}
            disabled={isFirst}
          >
            ←
          </button>
          
          <button 
            className={`${styles.controlBtn} ${styles.nextBtn} ${isLast ? styles.disabled : ''}`}
            onClick={handleNext}
            disabled={isLast}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
