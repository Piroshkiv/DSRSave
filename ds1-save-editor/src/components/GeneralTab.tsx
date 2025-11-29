import React, { useState } from 'react';
import { Character } from '../lib/Character';

interface GeneralTabProps {
  character: Character;
  onCharacterUpdate: () => void;
  safeMode: boolean;
}

const STAT_ORDER = ['VIT', 'ATN', 'END', 'STR', 'DEX', 'RES', 'INT', 'FTH'];

const CLASS_NAMES: Record<number, string> = {
  0: 'Warrior',
  1: 'Knight',
  2: 'Wanderer',
  3: 'Thief',
  4: 'Bandit',
  5: 'Hunter',
  6: 'Sorcerer',
  7: 'Pyromancer',
  8: 'Cleric',
  9: 'Deprived'
};

// Starting stats for each class
// totalStatsAtZero = Total stats at starting level - Starting level
const CLASS_BASE_STATS: Record<number, { level: number; stats: Record<string, number>; totalStatsAtZero: number }> = {
  0: { level: 4, stats: { VIT: 11, ATN: 8, END: 12, STR: 13, DEX: 13, RES: 11, INT: 9, FTH: 9 }, totalStatsAtZero: 82 }, // Warrior (86 - 4)
  1: { level: 5, stats: { VIT: 14, ATN: 10, END: 10, STR: 11, DEX: 11, RES: 10, INT: 9, FTH: 11 }, totalStatsAtZero: 81 }, // Knight (86 - 5)
  2: { level: 3, stats: { VIT: 10, ATN: 11, END: 10, STR: 10, DEX: 14, RES: 12, INT: 11, FTH: 8 }, totalStatsAtZero: 83 }, // Wanderer (86 - 3)
  3: { level: 5, stats: { VIT: 9, ATN: 11, END: 9, STR: 9, DEX: 15, RES: 10, INT: 12, FTH: 11 }, totalStatsAtZero: 81 }, // Thief (86 - 5)
  4: { level: 4, stats: { VIT: 12, ATN: 8, END: 14, STR: 14, DEX: 9, RES: 11, INT: 8, FTH: 10 }, totalStatsAtZero: 82 }, // Bandit (86 - 4)
  5: { level: 4, stats: { VIT: 11, ATN: 9, END: 11, STR: 12, DEX: 14, RES: 11, INT: 9, FTH: 9 }, totalStatsAtZero: 82 }, // Hunter (86 - 4)
  6: { level: 3, stats: { VIT: 8, ATN: 15, END: 8, STR: 9, DEX: 11, RES: 8, INT: 15, FTH: 8 }, totalStatsAtZero: 79 }, // Sorcerer (82 - 3)
  7: { level: 1, stats: { VIT: 10, ATN: 12, END: 11, STR: 12, DEX: 9, RES: 12, INT: 10, FTH: 8 }, totalStatsAtZero: 83 }, // Pyromancer (84 - 1)
  8: { level: 2, stats: { VIT: 11, ATN: 11, END: 9, STR: 12, DEX: 8, RES: 11, INT: 8, FTH: 14 }, totalStatsAtZero: 82 }, // Cleric (84 - 2)
  9: { level: 6, stats: { VIT: 11, ATN: 11, END: 11, STR: 11, DEX: 11, RES: 11, INT: 11, FTH: 11 }, totalStatsAtZero: 82 }  // Deprived (88 - 6)
};

export const GeneralTab: React.FC<GeneralTabProps> = ({ character, onCharacterUpdate, safeMode }) => {
  const [, forceUpdate] = useState({});

  const calculateLevel = (): number => {
    const classData = CLASS_BASE_STATS[character.playerClass];
    if (!classData) return character.level;

    // Calculate current total stats
    let currentTotalStats = 0;
    for (const statName of STAT_ORDER) {
      currentTotalStats += character.getStat(statName);
    }

    // Level = Current Total Stats - Total Stats at Zero Level
    return currentTotalStats - classData.totalStatsAtZero;
  };

  // Recalculate and enforce minimums on load if Safe Mode is on
  React.useEffect(() => {
    if (safeMode) {
      const classData = CLASS_BASE_STATS[character.playerClass];
      if (classData) {
        let needsUpdate = false;

        // Enforce minimum stats
        for (const statName of STAT_ORDER) {
          const currentStat = character.getStat(statName);
          const minStat = classData.stats[statName];
          if (currentStat < minStat) {
            character.setStat(statName, minStat, true);
            needsUpdate = true;
          }
        }

        // Recalculate level
        const correctLevel = calculateLevel();
        if (character.level !== correctLevel) {
          character.level = correctLevel;
          needsUpdate = true;
        }

        if (needsUpdate) {
          forceUpdate({});
          onCharacterUpdate();
        }
      }
    }
  }, [character, safeMode]);

  const handleStatChange = (statName: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 99) {
      const classData = CLASS_BASE_STATS[character.playerClass];

      // In safe mode, enforce minimum stats
      if (safeMode && classData) {
        const minStat = classData.stats[statName] || 0;
        if (numValue < minStat) {
          alert(`${statName} cannot be lower than ${minStat} for ${CLASS_NAMES[character.playerClass]} class in Safe Mode`);
          return;
        }
      }

      // Pass safeMode to setStat to auto-update HP/Stamina
      character.setStat(statName, numValue, safeMode);

      if (safeMode) {
        character.level = calculateLevel();
      }

      // Force re-render to show updated HP/Stamina
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleClassChange = (value: string) => {
    const newClass = parseInt(value, 10);
    if (!isNaN(newClass) && CLASS_BASE_STATS[newClass]) {
      character.playerClass = newClass;
      const classData = CLASS_BASE_STATS[newClass];

      if (safeMode) {
        // Update stats to minimum if they're below class minimums
        for (const statName of STAT_ORDER) {
          const currentStat = character.getStat(statName);
          const minStat = classData.stats[statName];
          if (currentStat < minStat) {
            character.setStat(statName, minStat, true);
          }
        }

        // Recalculate level
        character.level = calculateLevel();
      }

      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleLevelChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 713) {
      character.level = numValue;
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleNameChange = (value: string) => {
    if (value.length <= 16) {
      character.name = value;
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleHumanityChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 99) {
      character.humanity = numValue;
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleSoulsChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 999999999) {
      character.souls = numValue;
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleHpChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 9999) {
      character.hp = numValue;
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleStaminaChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 999) {
      character.stamina = numValue;
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  return (
    <div className="general-tab-compact">
      <div className="compact-layout">
        <div className="stats-column">
          <h3>Stats</h3>
          <div className="stats-list">
            <div className="stat-row">
              <label>Level</label>
              <input
                type="number"
                value={character.level}
                onChange={(e) => handleLevelChange(e.target.value)}
                min={1}
                max={713}
                disabled={safeMode}
              />
            </div>
            {STAT_ORDER.map((statName) => (
              <div key={statName} className="stat-row">
                <label>{statName}</label>
                <input
                  type="number"
                  value={character.getStat(statName)}
                  onChange={(e) => handleStatChange(statName, e.target.value)}
                  min={0}
                  max={99}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="info-column">
          <h3>General</h3>

          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={character.name}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={16}
            />
          </div>

          <div className="form-group">
            <label>Class</label>
            <select
              value={character.playerClass}
              onChange={(e) => handleClassChange(e.target.value)}
            >
              {Object.entries(CLASS_NAMES).map(([classId, className]) => (
                <option key={classId} value={classId}>
                  {className}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>HP</label>
            <input
              type="number"
              value={character.hp}
              onChange={(e) => handleHpChange(e.target.value)}
              min={0}
              max={9999}
              disabled={safeMode}
            />
          </div>

          <div className="form-group">
            <label>Stamina</label>
            <input
              type="number"
              value={character.stamina}
              onChange={(e) => handleStaminaChange(e.target.value)}
              min={0}
              max={999}
              disabled={safeMode}
            />
          </div>

          <div className="form-group">
            <label>Humanity</label>
            <input
              type="number"
              value={character.humanity}
              onChange={(e) => handleHumanityChange(e.target.value)}
              min={0}
              max={99}
            />
          </div>

          <div className="form-group">
            <label>Souls</label>
            <input
              type="number"
              value={character.souls}
              onChange={(e) => handleSoulsChange(e.target.value)}
              min={0}
              max={999999999}
            />
          </div>

        </div>
      </div>
    </div>
  );
};
