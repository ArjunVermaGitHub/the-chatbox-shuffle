'use client';

import { useUser, SignInButton } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import HomeMenu from '@/components/HomeMenu';
import AddPlayer from '@/components/AddPlayer';
import Loader from '@/components/Loader';
import { hasPlayers } from '@/utils/playerUtils';

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  useEffect(() => {
    // Only check for players if user is signed in
    if (isSignedIn && isLoaded) {
      const playersExist = hasPlayers();
      if (!playersExist) {
        setShowAddPlayer(true);
      }
    }
  }, [isSignedIn, isLoaded]);

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return <Loader message="Loading..." />;
  }

  // Show sign-up prompt if not authenticated
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto px-4">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
            Cards of Curiosity
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Discover the world through an exciting card game that combines knowledge, strategy, and curiosity.
          </p>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">Welcome to Cards of Curiosity!</h2>
            <p className="text-gray-300 mb-6">
              Sign in to start playing and unlock premium question sets.
            </p>
            <SignInButton mode="modal">
              <button className="bg-gradient-to-r from-yellow-400 to-pink-400 text-black px-8 py-3 rounded-lg font-semibold text-lg hover:from-yellow-300 hover:to-pink-300 transition-all duration-200 transform hover:scale-105">
                Sign In to Play
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    );
  }

  // Show add player screen if needed
  if (showAddPlayer) {
    return <AddPlayer onComplete={() => setShowAddPlayer(false)} />;
  }

  // Show the new menu layout for authenticated users
  return <HomeMenu />;
}
