'use client';

import { useState } from 'react';
import styles from './PurchaseButton.module.scss';

export default function PurchaseButton({ category, isPurchased, onPurchase }) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      await onPurchase(category);
      alert(`🎉 Successfully unlocked ${category}! You now have access to all questions in this category.`);
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Purchase failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isPurchased) {
    return (
      <div className={styles.purchased}>
        <span className={styles.checkmark}>✓</span>
        <span>Purchased</span>
      </div>
    );
  }

  return (
    <button 
      className={styles.purchaseButton}
      onClick={handlePurchase}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <span className={styles.spinner}></span>
          Processing...
        </>
      ) : (
        <>
          <span className={styles.price}>$4.99</span>
          <span>Unlock All Questions</span>
        </>
      )}
    </button>
  );
}
