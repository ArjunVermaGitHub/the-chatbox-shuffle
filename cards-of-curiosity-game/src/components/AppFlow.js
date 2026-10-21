'use client';

import { useState, useEffect } from 'react';
import SplashScreen from './SplashScreen';
import AddPlayer from './AddPlayer';
import { hasPlayers, getPlayers } from '@/utils/playerUtils';

export default function AppFlow({ children }) {
  const [currentScreen, setCurrentScreen] = useState('loading'); // 'loading', 'splash', 'addPlayer', 'app'
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    // Always show splash screen on page reload or first visit
    // Check navigation type to detect reloads
    let isReload = false;
    
    if (typeof window !== 'undefined' && window.performance) {
      try {
        const navTiming = performance.getEntriesByType('navigation')[0];
        if (navTiming) {
          isReload = navTiming.type === 'reload';
        }
      } catch (e) {
        // Fallback if navigation API not available
        console.log('Navigation API not available');
      }
    }
    
    // Always show splash on reload, or if app hasn't been loaded yet
    const appLoaded = sessionStorage.getItem('appLoaded');
    
    if (isReload) {
      // Clear the flag on reload so splash shows
      sessionStorage.removeItem('appLoaded');
      console.log('Page reload detected - showing splash screen');
      setCurrentScreen('splash');
      sessionStorage.setItem('appLoaded', 'true');
    } else if (!appLoaded) {
      // First visit
      console.log('First visit - showing splash screen');
      setCurrentScreen('splash');
      sessionStorage.setItem('appLoaded', 'true');
    } else {
      // SPA navigation - AppFlow doesn't remount, so this shouldn't happen
      console.log('Going directly to app');
      setCurrentScreen('app');
    }
  }, []);

  const handleSplashComplete = () => {
    // After splash, go directly to app (let children handle the flow)
    console.log('Splash complete - going to app');
    setCurrentScreen('app');
  };

  const handleAddPlayerComplete = (playerList) => {
    setPlayers(playerList);
    setCurrentScreen('app');
  };

  // Show loading while determining which screen to show
  if (currentScreen === 'loading') {
    return null;
  }

  if (currentScreen === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (currentScreen === 'addPlayer') {
    return <AddPlayer onComplete={handleAddPlayerComplete} />;
  }

  // Main app
  return children;
}
