'use client';

import { useState } from 'react';
import SplashScreen from './SplashScreen';

export default function AppWithSplash({ children }) {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {children}
    </>
  );
}
