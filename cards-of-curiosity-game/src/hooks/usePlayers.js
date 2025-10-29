'use client';

import { useState, useEffect } from 'react';
import { getPlayers, savePlayers, clearPlayers, hasPlayers } from '@/utils/playerUtils';

export function usePlayers() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load players from localStorage on mount
    const savedPlayers = getPlayers();
    setPlayers(savedPlayers);
    setLoading(false);
  }, []);

  const updatePlayers = (newPlayers) => {
    const validPlayers = savePlayers(newPlayers);
    setPlayers(validPlayers);
    return validPlayers;
  };

  const clearAllPlayers = () => {
    clearPlayers();
    setPlayers([]);
  };

  const addPlayer = (name) => {
    if (players.length < 4 && name.trim()) {
      const newPlayers = [...players, name.trim()];
      return updatePlayers(newPlayers);
    }
    return players;
  };

  const removePlayer = (index) => {
    const newPlayers = players.filter((_, i) => i !== index);
    return updatePlayers(newPlayers);
  };

  const updatePlayer = (index, newName) => {
    if (newName.trim()) {
      const newPlayers = [...players];
      newPlayers[index] = newName.trim();
      return updatePlayers(newPlayers);
    }
    return players;
  };

  return {
    players,
    loading,
    hasPlayers: hasPlayers(),
    playerCount: players.length,
    updatePlayers,
    clearAllPlayers,
    addPlayer,
    removePlayer,
    updatePlayer,
  };
}


