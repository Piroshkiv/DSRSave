import React, { useState, useEffect } from 'react';
import { Character } from '../lib/Character';
import { Npc, NpcCollection } from '../types/npc';
import { NpcEditor } from '../lib/npc';

interface NPCsTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

// Import JSON data statically
const npcData: NpcCollection = {
  npcs: []
};

// Load NPC data
fetch(new URL('../data/npc_data.json', import.meta.url))
  .then(res => res.json())
  .then(data => {
    npcData.npcs = data.npcs;
  })
  .catch(err => console.error('Failed to load NPC data:', err));

export const NPCsTab: React.FC<NPCsTabProps> = ({ character, onCharacterUpdate }) => {
  const [npcEditor] = useState(() => new NpcEditor(character));
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadNpcs = async () => {
    try {
      // Wait for data to load if not loaded yet
      if (npcData.npcs.length === 0) {
        const response = await fetch(new URL('../data/npc_data.json', import.meta.url));
        const data = await response.json();
        npcData.npcs = data.npcs;
      }

      const npcList = npcData.npcs.filter((npc) => !npc.name.includes('(boss)'));
      await npcEditor.loadNpcData();
      setNpcs(npcList);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load NPC data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNpcs();
  }, [character]);

  const handleRevive = (npc: Npc) => {
    try {
      if (!character || typeof npcEditor.setNpcAlive !== 'function') {
        setError(`Character method not available. Type: ${typeof character}, setNpcAlive: ${typeof npcEditor?.setNpcAlive}`);
        console.error('Character object:', character);
        return;
      }
      npcEditor.setNpcAlive(npc.name, true);
      onCharacterUpdate();
    } catch (err: any) {
      console.error('Error reviving NPC:', err);
      setError(err.message || 'Failed to revive NPC');
    }
  };

  const handleKill = (npc: Npc) => {
    try {
      if (!character || typeof npcEditor.setNpcAlive !== 'function') {
        setError(`Character method not available. Type: ${typeof character}, setNpcAlive: ${typeof npcEditor?.setNpcAlive}`);
        console.error('Character object:', character);
        return;
      }
      npcEditor.setNpcAlive(npc.name, false);
      onCharacterUpdate();
    } catch (err: any) {
      console.error('Error killing NPC:', err);
      setError(err.message || 'Failed to kill NPC');
    }
  };

  const filteredNpcs = npcs.filter(npc =>
    npc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="npcs-tab">
      <h2>NPCs</h2>

      <div className="disclaimer">
        ⚠️ There may be bugs. If you encounter any issues, please report them via <a href="https://discord.com/invite/FZuCXNcUWA" target="_blank" rel="noopener noreferrer">Discord</a>.
      </div>

      {loading && (
        <div className="loading-message" style={{ padding: '1rem', textAlign: 'center' }}>
          Loading NPC data...
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
          placeholder="Search NPCs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="npc-list">
        {filteredNpcs.map((npc, index) => (
          <div key={index} className="npc-item">
            <div className="npc-info">
              <span className="npc-name">
                {npc.name}
                {npc.warning && (
                  <span className="warning-icon" title={npc.warning}>
                    ⚠️
                  </span>
                )}
              </span>
            </div>
            <div className="npc-actions">
              <button
                className="kill-button"
                onClick={() => handleKill(npc)}
              >
                Kill
              </button>
              <button
                className="revive-button"
                onClick={() => handleRevive(npc)}
              >
                Revive
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .npcs-tab {
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

        .npc-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .npc-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.75rem 1rem;
          border-radius: 4px;
          border-left: 4px solid rgba(255, 255, 255, 0.2);
          transition: all 0.2s;
        }

        .npc-item:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .npc-info {
          flex: 1;
        }

        .npc-name {
          font-weight: bold;
          color: #fff;
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

        .npc-actions {
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
          .npc-item {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .npc-actions {
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
