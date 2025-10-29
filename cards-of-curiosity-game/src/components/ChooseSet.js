'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Loader from './Loader';
import styles from './ChooseSet.module.scss';

export default function ChooseSet() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleModeSelect = (mode) => {
    setIsNavigating(true);
    if (mode === 'by-categories') {
      // Navigate to categories selection
      router.push('/categories');
    } else if (mode === 'mix-all') {
      // Navigate to game with all sets mixed
      router.push('/game?mode=mix-all');
    }
  };

  if (isNavigating) {
    return <Loader message="Loading..." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button 
          className={styles.backButton}
          onClick={() => router.back()}
        >
          ←
        </button>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Choose how to play</h1>
        </div>
      </div>

      <div className={styles.modesContainer}>
        <div className={styles.modeCard} onClick={() => handleModeSelect('by-categories')}>
          <div className={styles.modeIcon}>
            <img src="/chemistry.png" alt="Categories" className={styles.iconImage} />
          </div>
          <h3 className={styles.modeTitle}>By Categories</h3>
        </div>

        <div className={styles.modeCard} onClick={() => handleModeSelect('mix-all')}>
          <div className={styles.modeIcon}>
            <img src="/chemistry.png" alt="Mix All" className={styles.iconImage} />
          </div>
          <h3 className={styles.modeTitle}>Mix All Sets</h3>
        </div>
      </div>
    </div>
  );
}