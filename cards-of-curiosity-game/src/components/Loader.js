'use client';

import styles from './Loader.module.scss';

export default function Loader({ 
  size = 'medium', 
  overlay = true, 
  message = 'Loading...' 
}) {
  const sizeClass = size === 'small' ? styles.small : 
                   size === 'large' ? styles.large : 
                   styles.medium;

  return (
    <div className={`${styles.loaderContainer} ${overlay ? styles.overlay : ''}`}>
      <div className={styles.loader}>
        <img 
          src="/loader.png" 
          alt={message} 
          className={`${styles.loaderImage} ${sizeClass}`} 
        />
        {message && <p className={styles.loadingText}>{message}</p>}
      </div>
    </div>
  );
}
