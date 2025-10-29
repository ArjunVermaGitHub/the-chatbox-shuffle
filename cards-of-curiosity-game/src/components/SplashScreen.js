'use client';

import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.scss';

export default function SplashScreen({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Show splash screen for exactly 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Call onComplete after fade out animation
      setTimeout(() => {
        onComplete?.();
      }, 500); // Wait for fade out animation to complete
    }, 5000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.splashScreen}>
      <div className={styles.background}></div>
      
      <div className={styles.content}>
        <img src="/logo-w-text.png" alt="Cards of Curiosity" className={styles.logo} />
      </div>
    </div>
  );
}
