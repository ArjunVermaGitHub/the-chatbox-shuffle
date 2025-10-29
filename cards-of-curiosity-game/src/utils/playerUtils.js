// Player management utilities for localStorage

export const PLAYER_STORAGE_KEY = 'coc-players';

export const getPlayers = () => {
  try {
    const players = localStorage.getItem(PLAYER_STORAGE_KEY);
    return players ? JSON.parse(players) : [];
  } catch (error) {
    console.error('Error loading players from localStorage:', error);
    return [];
  }
};

export const savePlayers = (players) => {
  try {
    // Filter out empty names and limit to 4 players
    const validPlayers = players
      .filter(name => name && name.trim() !== '')
      .slice(0, 4);
    
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(validPlayers));
    return validPlayers;
  } catch (error) {
    console.error('Error saving players to localStorage:', error);
    return [];
  }
};

export const clearPlayers = () => {
  try {
    localStorage.removeItem(PLAYER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing players from localStorage:', error);
  }
};

export const getPlayerCount = () => {
  return getPlayers().length;
};

export const hasPlayers = () => {
  return getPlayerCount() > 0;
};


