'use client';

import { useState, useEffect } from 'react';
import { getPlayers, savePlayers, clearPlayers } from '@/utils/playerUtils';
import styles from './AddPlayer.module.scss';

export default function AddPlayer({ onComplete }) {
  const [players, setPlayers] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Load existing players from localStorage
    const savedPlayers = getPlayers();
    setPlayers(savedPlayers);
  }, []);

  const handleAddPlayer = () => {
    if (currentInput.trim() && players.length < 4) {
      const newPlayers = [...players, currentInput.trim()];
      setPlayers(newPlayers);
      setCurrentInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddPlayer();
    }
  };

  const handleRemovePlayer = (index) => {
    const newPlayers = players.filter((_, i) => i !== index);
    setPlayers(newPlayers);
  };

  const handleStart = () => {
    // Save players using utility function
    const validPlayers = savePlayers(players);
    
    // Call onComplete to proceed
    onComplete?.(validPlayers);
  };

  const handleSkip = () => {
    // Clear any existing players and proceed
    clearPlayers();
    onComplete?.([]);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.addPlayerScreen}>
      <div className={styles.background}></div>
      
      <div className={styles.content}>
        {/* Three dots indicator */}
        <div className={styles.dots}>
          <div className={styles.dot}></div>
          <div className={styles.dot}></div>
          <div className={styles.dot}></div>
        </div>

        {/* Main content area */}
        <div className={styles.mainContent}>
          {/* Title */}
          <h1 className={styles.title}>Who is playing?</h1>
          
          {/* Input area */}
          <div className={styles.inputArea}>
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add player."
              className={styles.input}
              maxLength={20}
            />
            <button 
              onClick={handleAddPlayer}
              className={styles.addButton}
              disabled={!currentInput.trim() || players.length >= 4}
            >
              +
            </button>
          </div>
        </div>

        {/* Player list on the right */}
        <div className={styles.playerList}>
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className={styles.playerSlot}>
              <span className={styles.playerNumber}>{num}.</span>
              {players[num - 1] && (
                <span className={styles.playerName}>{players[num - 1]}</span>
              )}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          <button 
            onClick={handleSkip}
            className={styles.skipButton}
          >
            Skip
          </button>
          <button 
            onClick={handleStart}
            className={styles.startButton}
            disabled={players.length === 0}
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
