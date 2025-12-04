import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GameInfo } from '../config';

interface GameContextType {
  currentGame: GameInfo | null;
  setCurrentGame: (game: GameInfo | null) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [currentGame, setCurrentGame] = useState<GameInfo | null>(null);

  return (
    <GameContext.Provider value={{ currentGame, setCurrentGame }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
