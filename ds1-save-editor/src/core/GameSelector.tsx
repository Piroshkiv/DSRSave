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
        structuredData={[{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Dark Souls Save Editor Collection",
          "alternateName": ["Souls Save Editor", "DS1 Save Editor", "Dark Souls Remastered Save Editor", "DS3 Save Editor", "Elden Ring Save Editor", "FromSoft Save Editor"],
          "applicationCategory": "GameApplication",
          "operatingSystem": "Web Browser",
          "browserRequirements": "Requires JavaScript. Works with Chrome, Firefox, Safari, Edge.",
          "image": "https://dsrsaveeditor.pages.dev/logo.png",
          "screenshot": "https://dsrsaveeditor.pages.dev/screenshot.png",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "description": "Free online save editors for Dark Souls series and Elden Ring. Edit Dark Souls Remastered (DS1), Dark Souls 3, and Elden Ring character stats, inventory, equipment, and more directly in your browser without installation.",
          "url": "https://dsrsaveeditor.pages.dev/",
          "author": {
            "@type": "Organization",
            "name": "Souls Save Editor Team"
          },
          "featureList": [
            "Dark Souls Remastered (DS1) save editor",
            "Dark Souls 3 save editor (coming soon)",
            "Elden Ring save editor (coming soon)",
            "Edit character stats: Vitality, Attunement, Endurance, Strength, Dexterity, Intelligence, Faith",
            "Modify soul level, souls, and humanity/embers",
            "Edit inventory items, weapons, armor, and equipment",
            "Browser-based editor - no installation or download required",
            "100% free and open source",
            "Works offline after initial load",
            "Safe editing with backup functionality"
          ],
          "keywords": "Dark Souls, DS1, DSR, Dark Souls Remastered, Dark Souls 3, DS3, Elden Ring, FromSoftware, save editor, game save editor, character editor, stats editor, inventory editor, online save editor",
          "softwareVersion": "2.0",
          "datePublished": "2024-01-01"
        }, {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Which games are supported?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Currently Dark Souls Remastered (DS1/DSR) is fully supported. Dark Souls 3 and Elden Ring editors are coming soon."
              }
            },
            {
              "@type": "Question",
              "name": "Does this work with Dark Souls Remastered?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, the Dark Souls Remastered (DSR/DS1) save editor is fully functional and ready to use."
              }
            },
            {
              "@type": "Question",
              "name": "Is this save editor free?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, this is a completely free online tool. No registration, payment, or download required."
              }
            },
            {
              "@type": "Question",
              "name": "Do I need to download anything?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "No, this is a browser-based save editor. Everything works directly in your web browser without any installation."
              }
            }
          ]
        }]}
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
