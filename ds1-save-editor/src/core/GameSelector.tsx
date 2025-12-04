import React from 'react';
import { getAllGames, GameInfo } from './config';
import { MetaTags } from './MetaTags';
import './GameSelector.css';

interface GameSelectorProps {
  onGameSelect: (game: GameInfo) => void;
}

export const GameSelector: React.FC<GameSelectorProps> = ({ onGameSelect }) => {
  const games = getAllGames();

  return (
    <>
      <MetaTags
        title="Dark Souls Save Editor - DS Remastered, DS3, Elden Ring"
        description="Free online save editors for Dark Souls series. Edit Dark Souls Remastered (DS1), Dark Souls 3, and Elden Ring saves. Edit stats, inventory, and character data in your browser."
        keywords="dark souls save editor, ds1 save editor, dsr save editor, dark souls remastered save editor, dark souls 3 save editor, ds3 save editor, elden ring save editor, souls save editor, fromsoft save editor, dark souls character editor, online save editor, browser save editor"
        ogTitle="Dark Souls Save Editor - DS Remastered, DS3, Elden Ring"
        ogDescription="Free online save editors for Dark Souls Remastered, Dark Souls 3, and Elden Ring. Edit character stats, inventory, and more directly in your browser."
        canonical="https://dsrsaveeditor.pages.dev/"
      />
      <div className="game-selector">
        <div className="game-selector-header">
          <h1 className="game-selector-title">Souls Save Editor</h1>
          <p className="game-selector-subtitle">Select a game to edit your save files</p>
        </div>

      <div className="game-grid">
        {games.map((game) => (
          <button
            key={game.id}
            className={`game-card ${!game.enabled ? 'game-card-disabled' : ''}`}
            onClick={() => game.enabled && onGameSelect(game)}
            disabled={!game.enabled}
          >
            <div className="game-card-icon">
              <img src={game.icon} alt={game.name} onError={(e) => {
                e.currentTarget.style.display = 'none';
              }} />
            </div>
            <div className="game-card-content">
              <h2 className="game-card-title">{game.name}</h2>
              <p className="game-card-description">{game.description}</p>
              {!game.enabled && <span className="game-card-badge">Coming Soon</span>}
            </div>
          </button>
        ))}
      </div>

        <div className="game-selector-footer">
          <p className="footer-note">
            More games will be added in future updates
          </p>
        </div>
      </div>
    </>
  );
};
