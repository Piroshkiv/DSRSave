import React, { useState, useEffect } from 'react';
import {
  Character, BONFIRE_BIT_INDICES,
  BONFIRE_KINDLE_VALUES, BONFIRE_KINDLE_VALUE_LABELS, BONFIRE_KINDLE_VALUE_ESTUS,
} from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';

interface BonfiresTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

// 21 warpable bonfire names (indices 0-20, bit0=Catacombs, bits 1-3 reserved, bits 4-23 other bonfires)
// Bit layout: +0x6B bit0=Catacombs, bits1-3 reserved, bit4=CrystalCave, bit5=Duke'sArchives, bit6=TombOfGiants, bit7=PaintedWorld
//             +0x6C bit0=UndeadParish, bit1=Depths, bit2=OolacileTownship, bit3=Chasm, bit4=Oolacile, bit5=OolacileSanctuary, bit6=SanctuaryGarden, bit7=DarkmoonTomb
//             +0x6D bit0=ChamberOfThePrincess, bit1=AltarOfTheGravelord, bit2=SunlightAltar, bit3=TheAbyss, bit4=AnorLondo, bit5=DaughterOfChaos, bit6=StoneDragon, bit7=FirelinkShrine
const BONFIRE_NAMES: Record<Lang, string[]> = {
  en: [
    'The Catacombs', 'Crystal Cave', 'The Duke\'s Archives', 'Tomb of Giants', 'Painted World of Ariamis',
    'Undead Parish', 'Depths', 'Oolacile Township Dungeon', 'Chasm of the Abyss',
    'Oolacile', 'Oolacile Sanctuary', 'Sanctuary Garden', 'Darkmoon Tomb',
    'Chamber of the Princess', 'Altar of the Gravelord', 'Sunlight Altar', 'The Abyss',
    'Anor Londo', 'Daughter of Chaos', 'Stone Dragon', 'Firelink Shrine'
  ],
  zh: [
    '地下墓地', '结晶洞穴', '公爵书库', '巨人墓地', '绘画世界·亚米阿斯',
    '城外不死教区', '底层', '乌拉席露市镇：地牢', '深渊洞穴',
    '乌拉席露市镇', '乌拉席露灵庙', '灵庙内庭', '暗月灵庙',
    '公主的房间', '墓王祭坛', '太阳祭坛', '深渊',
    '亚诺尔隆德', '混沌的女儿', '石身古龙', '传火祭祀场'
  ]
};

// Map from display index (0-20) to bit index (3, 4-23)
const BIT_INDICES = BONFIRE_BIT_INDICES;

// Warp bits in +0x6B (bits 0-2) that are set together with the +0xAE flag
const WARP_BIT_INDICES = [0, 1, 2];


type Lang = 'en' | 'zh';

export const BonfiresTab: React.FC<BonfiresTabProps> = ({ character, onCharacterUpdate }) => {
  const { lang } = useLang();
  const [bonfires, setBonfires] = useState<boolean[]>([]);

  const [warpFlag, setWarpFlag] = useState<boolean>(false);

  const [kindleEntries, setKindleEntries] = useState<{ index: number; id: number; name: string | null; value: number }[]>([]);

  const [search, setSearch] = useState('');

  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    try {
      const flags = character.getBonfireWarpFlags();
      setBonfires(flags);

      setWarpFlag(character.getWarpFlag());

      setKindleEntries(character.getBonfireKindleEntries());

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error checking bonfire status');
    }
  };

  useEffect(() => {
    loadStatus();
  }, [character]);

  const handleToggle = (displayIndex: number) => {
    try {
      const bitIndex = BIT_INDICES[displayIndex];
      const newState = !bonfires[bitIndex];
      character.setBonfireWarpFlag(bitIndex, newState);
      const newBonfires = [...bonfires];
      newBonfires[bitIndex] = newState;
      setBonfires(newBonfires);
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle bonfire');
    }
  };


  const handleToggleWarping = () => {
    try {
      const newState = !warpFlag;
      WARP_BIT_INDICES.forEach(bitIndex => {
        character.setBonfireWarpFlag(bitIndex, newState);
      });
      character.setWarpFlag(newState);
      const newBonfires = [...bonfires];
      WARP_BIT_INDICES.forEach(i => { newBonfires[i] = newState; });
      setBonfires(newBonfires);
      setWarpFlag(newState);
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle warping');
    }
  };


  const handleKindleChange = (index: number, value: number) => {
    try {
      character.setBonfireKindleValue(index, value);
      setKindleEntries(prev => prev.map(e => e.index === index ? { ...e, value } : e));
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to set kindle level');
    }
  };

  const handleKindleAll = () => {
    try {
      character.kindleAllBonfires();
      setKindleEntries(character.getBonfireKindleEntries());
      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to kindle all bonfires');
    }
  };

  const handleUnlockAll = () => {
    try {
      character.unlockAllBonfires();
      const flags = character.getBonfireWarpFlags();
      setBonfires(flags);

      setWarpFlag(character.getWarpFlag());

      onCharacterUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to unlock bonfires');
    }
  };

  const names = BONFIRE_NAMES[lang] || BONFIRE_NAMES.en;
  const unlockedCount = BIT_INDICES.filter(i => bonfires[i]).length;
  const allUnlocked = BIT_INDICES.every(i => bonfires[i]);

  const query = search.trim().toLowerCase();

  // Named entries first, in the same order as the unlock-flag list above; unnamed
  // (non-warpable) rest points after, sorted by id for a stable order.
  const nameOrder = new Map(BONFIRE_NAMES.en.map((n, i) => [n, i]));
  const sortedKindleEntries = [...kindleEntries]
    .filter(e => !query || (e.name ?? String(e.id)).toLowerCase().includes(query))
    .sort((a, b) => {
      const ao = a.name !== null ? (nameOrder.get(a.name) ?? 999) : 1000 + a.id;
      const bo = b.name !== null ? (nameOrder.get(b.name) ?? 999) : 1000 + b.id;
      return ao - bo;
    });

  return (
    <div className="bonfires-tab">
      <h2>{t('bonfires', lang)}</h2>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="bonfire-actions">
        <button
          className="unlock-button primary-button"
          onClick={handleUnlockAll}
          disabled={allUnlocked}
        >
          {allUnlocked ? t('alreadyUnlocked', lang) : t('unlockAll', lang)}
        </button>
        <span className="bonfire-count">
          {unlockedCount} / {names.length}
        </span>
      </div>

      <div className="bonfire-grid">

        <div
          className={`bonfire-item warp-item ${warpFlag ? 'unlocked' : 'locked'}`}
          onClick={handleToggleWarping}
        >
          <span className={`bonfire-dot ${warpFlag ? 'dot-warp' : 'dot-off'}`} />
          <span className="bonfire-name">{t('warping', lang)}</span>
        </div>

        {names.map((name, i) => {
          const bitIndex = BIT_INDICES[i];
          const isUnlocked = bonfires[bitIndex];
          return (
            <div
              key={i}
              className={`bonfire-item ${isUnlocked ? 'unlocked' : 'locked'}`}
              onClick={() => handleToggle(i)}
            >

              <span className={`bonfire-dot ${isUnlocked ? 'dot-on' : 'dot-off'}`} />

              <span className="bonfire-name">{name}</span>
            </div>
          );
        })}
      </div>

      <div className="bonfire-actions kindling-actions">
        <h3 className="kindling-heading">{t('kindling', lang)}</h3>
        <button className="unlock-button primary-button" onClick={handleKindleAll}>
          {t('kindleAll', lang)}
        </button>
      </div>

      <input
        type="text"
        className="bonfire-search"
        placeholder={t('kindleSearch', lang)}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="kindle-list">
        {sortedKindleEntries.map(entry => (
          <div key={entry.index} className="kindle-row">
            <span className="kindle-name">{entry.name ?? `${t('kindleUnnamed', lang)} (${entry.id})`}</span>
            <div className="kindle-estus">
              <label>{t('maxEstus', lang)}</label>
              <select
                value={entry.value}
                onChange={(e) => handleKindleChange(entry.index, parseInt(e.target.value, 10))}
              >
                {BONFIRE_KINDLE_VALUES.map(v => (
                  <option key={v} value={v}>
                    {BONFIRE_KINDLE_VALUE_LABELS[v] ? t(BONFIRE_KINDLE_VALUE_LABELS[v], lang) : BONFIRE_KINDLE_VALUE_ESTUS[v]}
                  </option>
                ))}
                {!BONFIRE_KINDLE_VALUES.includes(entry.value as any) && (
                  <option value={entry.value}>{entry.value}</option>
                )}
              </select>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .bonfires-tab {
          padding: 0;
        }

        .bonfires-tab h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 0.75rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 107, 53, 0.25);
        }

        .bonfire-actions {
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

        .bonfire-count {
          font-size: 0.8rem;
          color: #666;
        }

        .bonfire-search {
          width: 100%;
          box-sizing: border-box;
          background: #2a2a2a;
          color: #c0c0c0;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          padding: 0.45rem 0.7rem;
          font-size: 0.82rem;
          margin-bottom: 0.75rem;
        }

        .bonfire-search::placeholder {
          color: #777;
        }

        .kindling-actions {
          justify-content: space-between;
        }

        .bonfire-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .kindling-heading {
          font-size: 0.85rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
        }

        .kindle-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .kindle-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.45rem 0.75rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
        }

        .kindle-name {
          font-size: 0.82rem;
          color: #c0c0c0;
          flex: 1;
        }

        .kindle-estus {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .kindle-estus label {
          font-size: 0.75rem;
          color: #888;
        }

        .kindle-estus select {
          color-scheme: dark;
          background: #2a2a2a;
          color: #c0c0c0;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          padding: 0.2rem 0.4rem;
          font-size: 0.78rem;
        }

        .kindle-estus select option {
          background: #2a2a2a;
          color: #c0c0c0;
        }

        .bonfire-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .bonfire-item.unlocked {
          background: rgba(255, 107, 53, 0.08);
          border-color: rgba(255, 107, 53, 0.2);
        }

        .bonfire-item.locked {
          background: rgba(255, 255, 255, 0.02);
          opacity: 0.5;
        }

        .bonfire-item:hover {
          border-color: rgba(255, 107, 53, 0.4);
        }

        .bonfire-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dot-on {
          background: #ff6b35;
        }

        .dot-warp {
          background: #f0c040;
        }

        .dot-off {
          background: transparent;
          border: 1.5px solid #555;

        }

        .bonfire-name {
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
