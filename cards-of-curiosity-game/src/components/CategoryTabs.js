'use client';

import styles from './CategoryTabs.module.scss';
import PurchaseButton from './PurchaseButton';

export default function CategoryTabs({ categories, activeCategory, onCategoryChange, questionCounts, categoryColors, totalQuestions, purchasedCategories, onPurchase }) {
  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsHeader}>
        <h2 className={styles.tabsTitle}>Select a Category to Play</h2>
        <p className={styles.tabsSubtitle}>Each category contains 5 free questions. Purchase a category to unlock all questions.</p>
      </div>
      
      <div className={styles.tabs}>
        {/* Mix All option */}
        <button
          className={`${styles.tab} ${styles.mixAllTab} ${activeCategory === 'mix-all' ? styles.active : ''}`}
          onClick={() => onCategoryChange('mix-all')}
          style={{ 
            '--category-color': '#FF6B6B',
            borderColor: '#FF6B6B'
          }}
        >
          <div className={styles.tabContent}>
            <span className={styles.tabName}>🎲 Mix All</span>
            <span className={styles.tabCount}>
              {totalQuestions} questions
            </span>
          </div>
        </button>
        
               {categories.map((category) => (
                 <div key={category} className={styles.tabWrapper}>
                   <button
                     className={`${styles.tab} ${activeCategory === category ? styles.active : ''}`}
                     onClick={() => onCategoryChange(category)}
                     style={{ 
                       '--category-color': categoryColors[category] || '#667eea',
                       borderColor: categoryColors[category] || '#667eea'
                     }}
                   >
                     <div className={styles.tabContent}>
                       <span className={styles.tabName}>{category}</span>
                       <span className={styles.tabCount}>
                         {purchasedCategories?.includes(category) 
                           ? `${questionCounts[category] || 0} questions`
                           : `${questionCounts[category] || 0} questions (5 free)`
                         }
                       </span>
                       <div className={styles.purchaseSection}>
                         <PurchaseButton 
                           category={category}
                           isPurchased={purchasedCategories?.includes(category)}
                           onPurchase={onPurchase}
                         />
                       </div>
                     </div>
                   </button>
                 </div>
               ))}
      </div>
    </div>
  );
}
