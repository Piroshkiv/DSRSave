import React, { useState, useEffect } from 'react';
import { Character } from '../lib/Character';

interface BonfiresTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

export const BonfiresTab: React.FC<BonfiresTabProps> = ({ character, onCharacterUpdate }) => {
  const [bonfireStatus, setBonfireStatus] = useState<{
    unlocked: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getStatus = (char: Character) => {
    try {
      const isUnlocked = char.areBonfiresUnlocked();
      setError(null);
      return { unlocked: isUnlocked };
    } catch (err: any) {
      setError(err.message || 'Error checking bonfire status');
      return null;
    }
  };

  useEffect(() => {
    const status = getStatus(character);
    if (status) {
      setBonfireStatus(status);
    } else {
      setBonfireStatus(null);
    }
  }, [character]);

  const handleUnlockAll = () => {
    try {
      character.unlockAllBonfires();

      // Update status
      const status = getStatus(character);
      if (status) {
        setBonfireStatus(status);
      }

      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to unlock bonfires');
    }
  };

  return (
    <div className="bonfires-tab">
      <h2>Bonfires</h2>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {bonfireStatus && (
        <div className="bonfire-info">
          <div className="status-section">
            <h3>Status</h3>
            <div className="status-display">
              <span className={`status-indicator ${bonfireStatus.unlocked ? 'unlocked' : 'locked'}`}>
                {bonfireStatus.unlocked ? '✓ All Warpable Bonfires Unlocked' : '✗ Not All Bonfires Unlocked'}
              </span>
            </div>
          </div>

          <div className="actions-section">
            <button
              className="unlock-button primary-button"
              onClick={handleUnlockAll}
              disabled={bonfireStatus.unlocked}
            >
              {bonfireStatus.unlocked ? 'All Bonfires Already Unlocked' : 'Unlock All Warpable Bonfires'}
            </button>
          </div>

          <div className="info-section">
            <h4>ℹ️ Information</h4>
            <ul>
              <li>Unlocks all <strong>20 warpable bonfires</strong> in Dark Souls Remastered.</li>
              <li>You still need to rest at each bonfire to register it in-game.</li>
            </ul>
          </div>
        </div>
      )}

      <style>{`
        .bonfires-tab {
          padding: 1rem;
        }

        .bonfire-info {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .status-section {
          background: rgba(255, 255, 255, 0.05);
          padding: 1rem;
          border-radius: 4px;
        }

        .status-display {
          margin: 1rem 0 0;
        }

        .status-indicator {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-weight: bold;
        }

        .status-indicator.unlocked {
          background: rgba(76, 175, 80, 0.2);
          color: #4caf50;
        }

        .status-indicator.locked {
          background: rgba(255, 152, 0, 0.2);
          color: #ff9800;
        }

        .actions-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .primary-button {
          background: #4caf50;
          color: white;
          border: none;
          padding: 1rem 2rem;
          font-size: 1rem;
          font-weight: bold;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .primary-button:hover:not(:disabled) {
          background: #45a049;
        }

        .primary-button:disabled {
          background: rgba(76, 175, 80, 0.3);
          cursor: not-allowed;
        }

        .info-section {
          background: rgba(33, 150, 243, 0.1);
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid #2196f3;
        }

        .info-section h4 {
          margin-top: 0;
          margin-bottom: 0.5rem;
        }

        .info-section ul {
          margin: 0;
          padding-left: 1.5rem;
        }

        .info-section li {
          margin: 0.25rem 0;
        }

        .error-message {
          background: rgba(244, 67, 54, 0.1);
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid #f44336;
        }
      `}</style>
    </div>
  );
};