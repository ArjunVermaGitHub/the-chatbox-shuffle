'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Loader from './Loader';
import styles from './Categories.module.scss';

export default function Categories() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  
  const categories = [
    { id: 'career', name: 'Career & Ambition', icon: '/chemistry.png' },
    { id: 'character', name: 'Character & Quirks', icon: '/chemistry.png' },
    { id: 'conflict', name: 'Conflict & Communication', icon: '/chemistry.png' },
    { id: 'finances', name: 'Finances & Money Mindset', icon: '/chemistry.png' },
    { id: 'lifestyle', name: 'Lifestyle & Habits', icon: '/chemistry.png' },
    { id: 'love', name: 'Love & Intimacy', icon: '/chemistry.png' },
    { id: 'parenting', name: 'Parenting & Family', icon: '/chemistry.png' },
    { id: 'values', name: 'Values & Beliefs', icon: '/chemistry.png' },
    { id: 'chemistry', name: 'Chemistry', icon: '/chemistry.png' }
  ];

  const handleCategorySelect = (categoryId) => {
    setIsNavigating(true);
    // Navigate using Next.js router for SPA behavior
    router.push(`/game?set=${categoryId}`);
  };

  if (isNavigating) {
    return <Loader message="Loading game..." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button 
          className={styles.backButton}
          onClick={() => router.push('/')}
        >
          ←
        </button>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Categories</h1>
          <p className={styles.subtitle}>Choose a category to play</p>
        </div>
      </div>

      <div className={styles.categoriesContainer}>
        <div className={styles.categoriesOverlay}>
          <div className={styles.categoriesGrid}>
            {categories.map((category) => (
              <div
                key={category.id}
                className={styles.categoryItem}
                onClick={() => handleCategorySelect(category.id)}
              >
                <div className={styles.categoryIcon}>
                  <img src={category.icon} alt={category.name} className={styles.iconImage} />
                </div>
                <h3 className={styles.categoryName}>{category.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
