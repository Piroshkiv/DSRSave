import React, { useState, useEffect, useCallback } from 'react';
import { DS3Character } from '../lib/Character';

interface BonfiresTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
}

export const BonfiresTab: React.FC<BonfiresTabProps> = ({ character, onCharacterUpdate }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [found, setFound] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      const rec0 = character.findBonfireBlock();
      setFound(rec0 !== -1);
      setUnlocked(rec0 !== -1 && character.allBonfiresUnlocked);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Error reading bonfire status');
    }
  }, [character]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleUnlockAll = () => {
    try {
      character.unlockAllBonfires();
      setUnlocked(true);
      onCharacterUpdate();
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock bonfires');
    }
  };

  return (
    <div className="ds3-bonfires-tab">
      <h2>Bonfires</h2>

      {error && <div className="ds3-bonfire-error">{error}</div>}

      {!found && !error && (
        <div className="ds3-bonfire-error">
          Could not locate the bonfire block in this save slot.
        </div>
      )}

      <p className="ds3-bonfire-desc">
        Unlocks fast-travel to every bonfire in the world. Existing bonfire flags are kept —
        nothing is ever re-locked.
      </p>

      <div className="ds3-bonfire-actions">
        <button
          className="ds3-bonfire-unlock-btn"
          onClick={handleUnlockAll}
          disabled={!found || unlocked}
        >
          {unlocked ? '✓ All bonfires unlocked' : 'Unlock All Bonfires'}
        </button>
      </div>

      <style>{`
        .ds3-bonfires-tab { padding: 0; }
        .ds3-bonfires-tab h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 0.75rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 107, 53, 0.25);
        }
        .ds3-bonfire-desc {
          font-size: 0.82rem;
          color: #8a8a8a;
          margin: 0 0 1rem;
          max-width: 42rem;
        }
        .ds3-bonfire-actions { display: flex; align-items: center; gap: 1rem; }
        .ds3-bonfire-unlock-btn {
          background: rgba(76, 175, 80, 0.12);
          color: #5a9a5a;
          border: 1px solid rgba(76, 175, 80, 0.3);
          padding: 0.5rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .ds3-bonfire-unlock-btn:hover:not(:disabled) {
          background: rgba(76, 175, 80, 0.18);
          border-color: rgba(76, 175, 80, 0.5);
        }
        .ds3-bonfire-unlock-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ds3-bonfire-error {
          background: rgba(244, 67, 54, 0.07);
          padding: 0.6rem 0.75rem;
          border-radius: 4px;
          border-left: 2px solid rgba(244, 67, 54, 0.4);
          color: #c05050;
          font-size: 0.82rem;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
};
