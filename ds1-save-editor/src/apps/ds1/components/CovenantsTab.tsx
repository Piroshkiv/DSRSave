import React, { useState, useEffect } from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { Covenant } from '../lib/constants';

// All 7 rankable covenants cap at rank 3 in vanilla DS1 (10/30/80 cumulative
// offerings for ranks 1/2/3 — the general covenant-donation mechanic).
const COVENANT_RANK_VALUES = [0, 1, 2, 3] as const;

const COVENANT_KEYS: Record<Covenant, string> = {
  [Covenant.None]: 'covenantNone',
  [Covenant.WayOfWhite]: 'covenantWayOfWhite',
  [Covenant.PrincessGuard]: 'covenantPrincessGuard',
  [Covenant.WarriorOfSunlight]: 'covenantWarriorOfSunlight',
  [Covenant.Darkwraith]: 'covenantDarkwraith',
  [Covenant.PathOfTheDragon]: 'covenantPathOfTheDragon',
  [Covenant.GravelordServant]: 'covenantGravelordServant',
  [Covenant.ForestHunter]: 'covenantForestHunter',
  [Covenant.DarkmoonBlade]: 'covenantDarkmoonBlade',
  [Covenant.ChaosServant]: 'covenantChaosServant',
};

// Covenant emblem icons — not packed in the game's own menu TPFs (checked;
// nothing there), sourced instead from each covenant's "Covenant: X" Steam
// achievement artwork, which uses the same thematic symbols.
const COVENANT_ICONS: Partial<Record<Covenant, string>> = {
  [Covenant.WayOfWhite]: '/icons/ds1/covenants/wayOfWhite.png',
  [Covenant.PrincessGuard]: '/icons/ds1/covenants/princessGuard.png',
  [Covenant.WarriorOfSunlight]: '/icons/ds1/covenants/warriorOfSunlight.png',
  [Covenant.Darkwraith]: '/icons/ds1/covenants/darkwraith.png',
  [Covenant.PathOfTheDragon]: '/icons/ds1/covenants/pathOfTheDragon.png',
  [Covenant.GravelordServant]: '/icons/ds1/covenants/gravelordServant.png',
  [Covenant.ForestHunter]: '/icons/ds1/covenants/forestHunter.png',
  [Covenant.DarkmoonBlade]: '/icons/ds1/covenants/darkmoonBlade.png',
  [Covenant.ChaosServant]: '/icons/ds1/covenants/chaosServant.png',
};

// Joinable covenants in display order (None excluded — "leave" is its own action below).
const JOINABLE_COVENANTS: Covenant[] = [
  Covenant.WayOfWhite, Covenant.PrincessGuard, Covenant.WarriorOfSunlight, Covenant.Darkwraith,
  Covenant.PathOfTheDragon, Covenant.GravelordServant, Covenant.ForestHunter, Covenant.DarkmoonBlade,
  Covenant.ChaosServant,
];

interface CovenantsTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

export const CovenantsTab: React.FC<CovenantsTabProps> = ({ character, onCharacterUpdate }) => {
  const { lang } = useLang();

  const [currentCovenant, setCurrentCovenant] = useState<Covenant>(Covenant.None);
  const [covenantRanks, setCovenantRanks] = useState<Record<number, number>>({});
  const [covenantAvailable, setCovenantAvailable] = useState<Record<number, boolean>>({});

  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    try {
      setCurrentCovenant(character.covenant);
      const ranks: Record<number, number> = {};
      const available: Record<number, boolean> = {};
      JOINABLE_COVENANTS.forEach(c => {
        if (character.hasCovenantRank(c)) ranks[c] = character.getCovenantRank(c);
        available[c] = character.isCovenantAvailable(c);
      });
      setCovenantRanks(ranks);
      setCovenantAvailable(available);

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error checking covenant status');
    }
  };

  useEffect(() => {
    loadStatus();
  }, [character]);

  const handleJoinCovenant = (covenant: Covenant) => {
    try {
      character.joinCovenant(covenant);
      setCurrentCovenant(covenant);
      if (character.hasCovenantRank(covenant)) {
        setCovenantRanks(prev => ({ ...prev, [covenant]: character.getCovenantRank(covenant) }));
      }
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to join covenant');
    }
  };

  const handleLeaveCovenant = () => {
    try {
      character.covenant = Covenant.None;
      setCurrentCovenant(Covenant.None);
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to leave covenant');
    }
  };

  const handleRankChange = (covenant: Covenant, rank: number) => {
    try {
      character.setCovenantRank(covenant, rank);
      setCovenantRanks(prev => ({ ...prev, [covenant]: rank }));
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to set covenant rank');
    }
  };

  const handleAvailableToggle = (covenant: Covenant) => {
    try {
      const next = !covenantAvailable[covenant];
      character.setCovenantAvailable(covenant, next);
      setCovenantAvailable(prev => ({ ...prev, [covenant]: next }));
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to set covenant availability');
    }
  };

  return (
    <div className="covenants-tab">
      <h2>{t('covenants', lang)}</h2>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="covenant-table">
        <div className="covenant-row covenant-header">
          <span className="covenant-name">{t('covenantName', lang)}</span>
          <span className="covenant-col-available">{t('covenantAvailable', lang)}</span>
          <span className="covenant-col-rank">{t('covenantRank', lang)}</span>
          <span className="covenant-col-join" />
        </div>
        {JOINABLE_COVENANTS.map(covenant => {
          const isCurrent = currentCovenant === covenant;
          const hasRank = character.hasCovenantRank(covenant);
          return (
            <div key={covenant} className={`covenant-row ${isCurrent ? 'current' : ''}`}>
              <span className="covenant-name">
                <img className="covenant-icon" src={COVENANT_ICONS[covenant]} alt="" />
                {t(COVENANT_KEYS[covenant], lang)}
              </span>

              <span className="covenant-col-available">
                <input
                  type="checkbox"
                  className="covenant-available-checkbox"
                  checked={covenantAvailable[covenant] ?? false}
                  onChange={() => handleAvailableToggle(covenant)}
                />
              </span>

              <span className="covenant-col-rank">
                {hasRank && (
                  <select
                    value={covenantRanks[covenant] ?? 0}
                    onChange={(e) => handleRankChange(covenant, parseInt(e.target.value, 10))}
                  >
                    {COVENANT_RANK_VALUES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {!COVENANT_RANK_VALUES.includes((covenantRanks[covenant] ?? 0) as any) && (
                      <option value={covenantRanks[covenant] ?? 0}>{covenantRanks[covenant] ?? 0}</option>
                    )}
                  </select>
                )}
              </span>

              <span className="covenant-col-join">
                {isCurrent ? (
                  <span className="covenant-status">{t('covenantJoined', lang)}</span>
                ) : (
                  <button className="covenant-join-button" onClick={() => handleJoinCovenant(covenant)}>
                    {t('covenantJoin', lang)}
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {currentCovenant !== Covenant.None && (
          <button className="covenant-leave-button" onClick={handleLeaveCovenant}>
            {t('covenantLeave', lang)}
          </button>
        )}
      </div>

      <style>{`
        .covenants-tab {
          padding: 0;
        }

        .covenants-tab h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 0.75rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 107, 53, 0.25);
        }

        .covenant-table {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .covenant-row {
          display: grid;
          grid-template-columns: 1fr 60px 60px 80px;
          align-items: center;
          gap: 0.6rem;
          padding: 0.45rem 0.75rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
        }

        .covenant-row.current {
          background: rgba(255, 107, 53, 0.08);
          border-color: rgba(255, 107, 53, 0.25);
        }

        .covenant-row.covenant-header {
          background: transparent;
          border: none;
          padding: 0 0.75rem;
          margin-bottom: 0.1rem;
        }

        .covenant-row.covenant-header span {
          font-size: 0.7rem;
          color: #777;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .covenant-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.82rem;
          color: #c0c0c0;
        }

        .covenant-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.04);
        }

        .covenant-status {
          font-size: 0.75rem;
          color: #f0c040;
          font-weight: 500;
        }

        .covenant-col-available,
        .covenant-col-rank {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .covenant-col-join {
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .covenant-available-checkbox {
          width: 16px;
          height: 16px;
          accent-color: #ff6b35;
          cursor: pointer;
        }

        .covenant-join-button {
          background: rgba(76, 175, 80, 0.12);
          color: #5a9a5a;
          border: 1px solid rgba(76, 175, 80, 0.3);
          padding: 0.25rem 0.5rem;
          font-size: 0.72rem;
          font-weight: 500;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, border-color 0.15s;
        }

        .covenant-join-button:hover {
          background: rgba(76, 175, 80, 0.18);
          border-color: rgba(76, 175, 80, 0.5);
        }

        .covenant-col-rank select {
          color-scheme: dark;
          background: #2a2a2a;
          color: #c0c0c0;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          padding: 0.2rem 0.3rem;
          font-size: 0.75rem;
          width: 44px;
        }

        .covenant-col-rank select option {
          background: #2a2a2a;
          color: #c0c0c0;
        }

        .covenant-leave-button {
          align-self: flex-start;
          margin-top: 0.75rem;
          background: rgba(244, 67, 54, 0.08);
          color: #c05050;
          border: 1px solid rgba(244, 67, 54, 0.25);
          padding: 0.35rem 0.9rem;
          font-size: 0.78rem;
          font-weight: 500;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }

        .covenant-leave-button:hover {
          background: rgba(244, 67, 54, 0.14);
          border-color: rgba(244, 67, 54, 0.45);
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
