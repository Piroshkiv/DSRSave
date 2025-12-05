import React, { useState, useEffect } from 'react';
import { Character } from '../lib/Character';
import { Npc, NpcCollection } from '../types/npc';
import { NpcEditor } from '../lib/npc';

interface BossesTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

// Import JSON data statically
const bossData: NpcCollection = {
  npcs: []
};

// Load boss data
fetch(new URL('../data/npc_data.json', import.meta.url))
  .then(res => res.json())
  .then(data => {
    bossData.npcs = data.npcs;
  })
  .catch(err => console.error('Failed to load boss data:', err));

export const BossesTab: React.FC<BossesTabProps> = ({ character, onCharacterUpdate }) => {
  const [npcEditor] = useState(() => new NpcEditor(character));
  const [bosses, setBosses] = useState<Npc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadBosses = async () => {
    try {
      // Wait for data to load if not loaded yet
      if (bossData.npcs.length === 0) {
        const response = await fetch(new URL('../data/npc_data.json', import.meta.url));
        const data = await response.json();
        bossData.npcs = data.npcs;
      }

      const bossList = bossData.npcs.filter((npc) => npc.name.includes('(boss)'));

      await npcEditor.loadNpcData();

      setBosses(bossList);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load boss data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBosses();
  }, [character]);

  const handleRevive = (boss: Npc) => {
    try {
      if (!character || typeof npcEditor.setNpcAlive !== 'function') {
        setError(`Character method not available. Type: ${typeof character}, setNpcAlive: ${typeof npcEditor?.setNpcAlive}`);
        console.error('Character object:', character);
        return;
      }
      npcEditor.setNpcAlive(boss.name, true);
      onCharacterUpdate();
    } catch (err: any) {
      console.error('Error reviving boss:', err);
      setError(err.message || 'Failed to revive boss');
    }
  };

  const handleKill = (boss: Npc) => {
    try {
      if (!character || typeof npcEditor.setNpcAlive !== 'function') {
        setError(`Character method not available. Type: ${typeof character}, setNpcAlive: ${typeof npcEditor?.setNpcAlive}`);
        console.error('Character object:', character);
        return;
      }
      npcEditor.setNpcAlive(boss.name, false);
      onCharacterUpdate();
    } catch (err: any) {
      console.error('Error killing boss:', err);
      setError(err.message || 'Failed to kill boss');
    }
  };

  const filteredBosses = bosses.filter(boss =>
    boss.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bosses-tab">
      <h2>Bosses</h2>

      <div className="disclaimer">
        ⚠️ There may be bugs. If you encounter any issues, please report them via <a href="https://discord.com/invite/FZuCXNcUWA" target="_blank" rel="noopener noreferrer">Discord</a>.
      </div>

      {loading && (
        <div className="loading-message" style={{ padding: '1rem', textAlign: 'center' }}>
          Loading boss data...
        </div>
      )}

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search bosses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="boss-list">
        {filteredBosses.map((boss, index) => (
          <div key={index} className="boss-item">
            <div className="boss-info">
              <span className="boss-name">
                {boss.name.replace(' (boss)', '')}
                {boss.warning && (
                  <span className="warning-icon" title={boss.warning}>
                    ⚠️
                  </span>
                )}
              </span>
            </div>
            <div className="boss-actions">
              <button
                className="kill-button"
                onClick={() => handleKill(boss)}
              >
                Kill
              </button>
              <button
                className="revive-button"
                onClick={() => handleRevive(boss)}
              >
                Revive
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .bosses-tab {
          padding: 1rem;
        }

        .disclaimer {
          background: rgba(255, 152, 0, 0.1);
          border-left: 4px solid #ff9800;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .disclaimer a {
          color: #2196f3;
          text-decoration: none;
          font-weight: bold;
        }

        .disclaimer a:hover {
          text-decoration: underline;
        }

        .search-container {
          margin-bottom: 1rem;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: #fff;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #ff6b35;
          background: rgba(255, 255, 255, 0.08);
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .boss-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .boss-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 107, 53, 0.1);
          padding: 0.75rem 1rem;
          border-radius: 4px;
          border-left: 4px solid #ff6b35;
          transition: all 0.2s;
        }

        .boss-item:hover {
          background: rgba(255, 107, 53, 0.15);
        }

        .boss-info {
          flex: 1;
        }

        .boss-name {
          font-weight: bold;
          color: #fff;
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .warning-icon {
          cursor: help;
          font-size: 1.1rem;
          display: inline-flex;
          align-items: center;
        }

        .boss-actions {
          display: flex;
          gap: 0.5rem;
        }

        .kill-button,
        .revive-button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }

        .kill-button {
          background: #f44336;
          color: white;
        }

        .kill-button:hover {
          background: #d32f2f;
        }

        .revive-button {
          background: #2196f3;
          color: white;
        }

        .revive-button:hover {
          background: #1976d2;
        }

        .error-message {
          background: rgba(244, 67, 54, 0.1);
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid #f44336;
        }

        @media (max-width: 768px) {
          .boss-item {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .boss-actions {
            width: 100%;
          }

          .kill-button,
          .revive-button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};
