'use client';

import { useEffect } from 'react';
import styles from './Notification.module.scss';

export default function Notification({ message, show, onClose, type = 'success' }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className={`${styles.notification} ${styles[type]}`}>
      <span className={styles.message}>{message}</span>
      <button className={styles.closeBtn} onClick={onClose}>✕</button>
    </div>
  );
}

