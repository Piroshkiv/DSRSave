import React, { useState, useEffect, useCallback } from 'react';
import { DS3Character } from '../lib/Character';
import { GESTURE_COUNT } from '../lib/constants';

interface GesturesTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
}

// Game order — the index into this list is the index passed to setGestureFlag().
// 0x00-0x20 come from the "Unlock All Gestures" script in DS3_TGA_v3.4.0.CT;
// 0x21 (Unmannered Bow) is commented out there but has a finished animation, so
// it is kept. The records after it — "Lord of Cinder" (placeholder kukri-throw
// animation) and FDP_MenuText(301140)-(301145) — show up broken in-game, so the
// editor does not expose them (see constants.ts).
const GESTURE_NAMES: string[] = [
  'Point Forward', 'Point Up', 'Point Down', 'Wave', 'Beckon',
  'Call Over', 'Welcome', 'Applause', 'Quiet Resolve', 'Jump For Joy',
  'Joy', 'Rejoice', 'Hurrah!', 'Praise the Sun', 'My Thanks',
  'Bow', 'Proper Bow', 'Dignified Bow', 'Duel Bow', 'Legion Etiquette',
  'Darkmoon Loyalty', 'By My Sword', 'Prayer', 'Silent Ally', 'Rest',
  'Collapse', "Patches' Squat", 'Prostration', 'Toast', 'Sleep',
  'Curl Up', 'Stretch Out', 'Path of the Dragon', 'Unmannered Bow',
];

export const GesturesTab: React.FC<GesturesTabProps> = ({ character, onCharacterUpdate }) => {
  const [gestures, setGestures] = useState<boolean[]>([]);
  const [found, setFound] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      setFound(character.findGestureTable() !== -1);
      setGestures(character.getGestureFlags());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Error reading gesture status');
    }
  }, [character]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleToggle = (index: number) => {
    try {
      const next = !gestures[index];
      character.setGestureFlag(index, next);
      setGestures(prev => prev.map((v, i) => (i === index ? next : v)));
      onCharacterUpdate();
    } catch (err: any) {
      setError(err?.message || 'Failed to toggle gesture');
    }
  };

  const handleUnlockAll = () => {
    try {
      character.unlockAllGestures();
      setGestures(character.getGestureFlags());
      onCharacterUpdate();
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock gestures');
    }
  };

  const names = GESTURE_NAMES;
  const unlockedCount = gestures.filter(Boolean).length;
  const allUnlocked = unlockedCount === GESTURE_COUNT;

  return (
    <div className="ds3-gestures-tab">
      <h2>Gestures</h2>

      {error && <div className="ds3-gesture-error">{error}</div>}

      {!found && !error && (
        <div className="ds3-gesture-error">
          Could not locate the gesture table in this save slot.
        </div>
      )}

      <div className="ds3-gesture-actions">
        <button
          className="ds3-gesture-unlock-btn"
          onClick={handleUnlockAll}
          disabled={!found || allUnlocked}
        >
          {allUnlocked ? '✓ All gestures unlocked' : 'Unlock All Gestures'}
        </button>
        <span className="ds3-gesture-count">
          {unlockedCount} / {names.length}
        </span>
      </div>

      <div className="ds3-gesture-grid">
        {names.map((name, i) => {
          const isUnlocked = !!gestures[i];
          return (
            <div
              key={i}
              className={`ds3-gesture-item ${isUnlocked ? 'unlocked' : 'locked'}`}
              onClick={() => found && handleToggle(i)}
            >
              <span className={`ds3-gesture-dot ${isUnlocked ? 'dot-on' : 'dot-off'}`} />
              <span className="ds3-gesture-name">{name}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        .ds3-gestures-tab { padding: 0; }
        .ds3-gestures-tab h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 0.75rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 107, 53, 0.25);
        }
        .ds3-gesture-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .ds3-gesture-unlock-btn {
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
        .ds3-gesture-unlock-btn:hover:not(:disabled) {
          background: rgba(76, 175, 80, 0.18);
          border-color: rgba(76, 175, 80, 0.5);
        }
        .ds3-gesture-unlock-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ds3-gesture-count { font-size: 0.8rem; color: #666; }
        .ds3-gesture-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.5rem;
        }
        .ds3-gesture-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .ds3-gesture-item.unlocked {
          background: rgba(255, 107, 53, 0.08);
          border-color: rgba(255, 107, 53, 0.2);
        }
        .ds3-gesture-item.locked {
          background: rgba(255, 255, 255, 0.02);
          opacity: 0.5;
        }
        .ds3-gesture-item:hover { border-color: rgba(255, 107, 53, 0.4); }
        .ds3-gesture-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-on { background: #ff6b35; }
        .dot-off { background: transparent; border: 1.5px solid #555; }
        .ds3-gesture-name { font-size: 0.8rem; color: #c0c0c0; }
        .ds3-gesture-error {
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
