import React, { useState, useEffect } from 'react';
import { Character, GESTURE_COUNT } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';

interface GesturesTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

type Lang = 'en' | 'zh';

// Game order — the same order the records sit in inside the save, so the index
// into this list is the index passed to Character.setGestureFlag().
const GESTURE_NAMES: Record<Lang, string[]> = {
  en: [
    'Point Forward', 'Point Up', 'Point Down', 'Beckon', 'Wave',
    'Bow', 'Proper Bow', 'Hurrah!', 'Joy', 'Shrug',
    'Look Skyward', 'Well! What is it!', 'Prostration', 'Prayer', 'Praise the Sun',
  ],
  zh: [
    '指向前方', '指向上方', '指向下方', '招手', '挥手',
    '鞠躬', '正式鞠躬', '欢呼', '喜悦', '耸肩',
    '仰望天空', '这是什么！', '五体投地', '祈祷', '赞美太阳',
  ],
};

export const GesturesTab: React.FC<GesturesTabProps> = ({ character, onCharacterUpdate }) => {
  const { lang } = useLang();
  const [gestures, setGestures] = useState<boolean[]>([]);
  const [tableFound, setTableFound] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    try {
      setTableFound(character.findGestureTable() !== -1);
      setGestures(character.getGestureFlags());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error reading gesture status');
    }
  };

  useEffect(() => {
    loadStatus();
  }, [character]);

  const handleToggle = (index: number) => {
    try {
      const newState = !gestures[index];
      character.setGestureFlag(index, newState);
      const next = [...gestures];
      next[index] = newState;
      setGestures(next);
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle gesture');
    }
  };

  const handleUnlockAll = () => {
    try {
      character.unlockAllGestures();
      setGestures(character.getGestureFlags());
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to unlock gestures');
    }
  };

  const names = GESTURE_NAMES[lang] || GESTURE_NAMES.en;
  const unlockedCount = gestures.filter(Boolean).length;
  const allUnlocked = gestures.length === GESTURE_COUNT && gestures.every(Boolean);

  return (
    <div className="gestures-tab">
      <h2>{t('gestures', lang)}</h2>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!tableFound && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {t('gestureTableMissing', lang)}
        </div>
      )}

      <div className="gesture-actions">
        <button
          className="unlock-button primary-button"
          onClick={handleUnlockAll}
          disabled={allUnlocked || !tableFound}
        >
          {allUnlocked ? t('allGesturesUnlocked', lang) : t('unlockAllGestures', lang)}
        </button>
        <span className="gesture-count">
          {unlockedCount} / {names.length}
        </span>
      </div>

      <div className="gesture-grid">
        {names.map((name, i) => {
          const isUnlocked = !!gestures[i];
          return (
            <div
              key={i}
              className={`gesture-item ${isUnlocked ? 'unlocked' : 'locked'}`}
              onClick={() => tableFound && handleToggle(i)}
            >
              <span className={`gesture-dot ${isUnlocked ? 'dot-on' : 'dot-off'}`} />
              <span className="gesture-name">{name}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        .gestures-tab {
          padding: 0;
        }

        .gestures-tab h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 0.75rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 107, 53, 0.25);
        }

        .gesture-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .primary-button {
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

        .primary-button:hover:not(:disabled) {
          background: rgba(76, 175, 80, 0.18);
          border-color: rgba(76, 175, 80, 0.5);
        }

        .primary-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .gesture-count {
          font-size: 0.8rem;
          color: #666;
        }

        .gesture-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.5rem;
        }

        .gesture-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .gesture-item.unlocked {
          background: rgba(255, 107, 53, 0.08);
          border-color: rgba(255, 107, 53, 0.2);
        }

        .gesture-item.locked {
          background: rgba(255, 255, 255, 0.02);
          opacity: 0.5;
        }

        .gesture-item:hover {
          border-color: rgba(255, 107, 53, 0.4);
        }

        .gesture-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dot-on {
          background: #ff6b35;
        }

        .dot-off {
          background: transparent;
          border: 1.5px solid #555;
        }

        .gesture-name {
          font-size: 0.8rem;
          color: #c0c0c0;
        }

        .error-message {
          background: rgba(244, 67, 54, 0.07);
          padding: 0.6rem 0.75rem;
          border-radius: 4px;
          border-left: 2px solid rgba(244, 67, 54, 0.4);
          color: #c05050;
          font-size: 0.82rem;
        }
      `}</style>
    </div>
  );
};
