'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './RequestQuestion.module.scss';
import Notification from './Notification';

export default function RequestQuestion() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification({ ...notification, show: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification('Question submitted! Thank you for your suggestion.', 'success');
        setQuestion('');
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        showNotification(data.error || 'Failed to submit question. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error submitting question:', error);
      showNotification('An error occurred. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.formOverlay}>
            <div className={styles.header}>
              <h1 className={styles.title}>Request a Question</h1>
              <button 
                className={styles.closeButton}
                onClick={() => router.push('/')}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <textarea
                className={styles.input}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question suggestion here..."
                rows={10}
                required
              />
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={isSubmitting || !question.trim()}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Question'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Notification
        message={notification.message}
        show={notification.show}
        onClose={hideNotification}
        type={notification.type}
      />
    </>
  );
}

