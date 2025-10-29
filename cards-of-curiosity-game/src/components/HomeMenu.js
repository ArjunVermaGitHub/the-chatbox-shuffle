'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ShareModal from './ShareModal';
import styles from './HomeMenu.module.scss';

export default function HomeMenu() {
  const router = useRouter();
  const [showShareModal, setShowShareModal] = useState(false);
  
  const menuOptions = [
    { id: 'choose-set', text: 'Choose a set.' },
    { id: 'feedback', text: 'Feedback' },
    { id: 'suggest', text: 'Suggest questions' },
    { id: 'refer', text: 'Refer to friends <3' },
    { id: 'share', text: 'Share' },
    { id: 'buy-paper', text: 'Buy a paper set' }
  ];

  const handleMenuClick = (optionId) => {
    switch(optionId) {
      case 'choose-set':
        router.push('/choose-set');
        break;
      case 'suggest':
        // TODO: Implement suggest questions
        alert('Suggest questions feature coming soon!');
        break;
      case 'share':
        setShowShareModal(true);
        break;
      case 'feedback':
        // TODO: Implement feedback
        alert('Feedback feature coming soon!');
        break;
      case 'refer':
        // TODO: Implement refer to friends
        alert('Refer to friends feature coming soon!');
        break;
      case 'buy-paper':
        // TODO: Implement buy paper set
        alert('Buy paper set feature coming soon!');
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.homeMenu}>
      {/* Menu Container */}
      <div className={styles.menuContainer}>
        <h1 className={styles.menuTitle}>Menu</h1>
        
        <div className={styles.menuGrid}>
          {menuOptions.map((option) => (
            <button
              key={option.id}
              className={styles.menuOption}
              onClick={() => handleMenuClick(option.id)}
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>
      
      {/* Share Modal */}
      <ShareModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
      />
    </div>
  );
}
