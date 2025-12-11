import React, { useEffect, useState } from 'react';
import { DS3Character } from '../lib/Character';
import { NumberInput } from '../../ds1/components/NumberInput';
import { MAX_VALUES, PlayerClass, CLASS_NAMES, CLASS_STARTING_STATS } from '../lib/constants';

interface GeneralTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
  safeMode: boolean;
  onSafeModeChange?: (enabled: boolean) => void;
}

const STAT_ORDER = ['VIG', 'ATN', 'END', 'VIT', 'STR', 'DEX', 'INT', 'FTH', 'LCK'];

// Mapping from STAT_ORDER names to ClassStats property names
const STAT_MAP: Record<string, keyof Omit<typeof CLASS_STARTING_STATS[PlayerClass.Knight], 'level' | 'totalStatsAtZero'>> = {
  VIG: 'vigor',
  ATN: 'attunement',
  END: 'endurance',
  VIT: 'vitality',
  STR: 'strength',
  DEX: 'dexterity',
  INT: 'intelligence',
  FTH: 'faith',
  LCK: 'luck',
};

export const GeneralTab: React.FC<GeneralTabProps> = ({ character, onCharacterUpdate, safeMode }) => {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const calculateLevel = (): number => {
    const classData = CLASS_STARTING_STATS[character.playerClass];
    if (!classData) return Math.max(1, character.level);

    let currentTotalStats = 0;
    for (const statName of STAT_ORDER) {
      currentTotalStats += character.getStat(statName);
    }

    return currentTotalStats - classData.totalStatsAtZero;
  };

  // Robust safeMode effect: collect changes, apply them, then recompute level and update once.
  useEffect(() => {
    if (!safeMode) return;

    const classData = CLASS_STARTING_STATS[character.playerClass];
    if (!classData) return;

    const changes: { stat: string; from: number; to: number }[] = [];

    for (const statName of STAT_ORDER) {
      const current = character.getStat(statName);
      const propertyName = STAT_MAP[statName];
      const min = classData[propertyName] ?? 0;

      if (typeof current === 'number' && current < min) {
        changes.push({ stat: statName, from: current, to: min });
      }
    }

    // Apply all stat changes in batch (sequentially), but avoid re-rendering until finished.
    if (changes.length > 0) {
      for (const ch of changes) {
        // setStat may update derived stats synchronously in your implementation
        character.setStat(ch.stat, ch.to, true);
      }
    }

    // Recalculate level after applying stat corrections
    const correctLevel = calculateLevel();

    const levelChanged = character.level !== correctLevel;
    const hadChanges = changes.length > 0;

    // Check and correct Estus Flask values in safe mode
    let estusChanged = false;
    const estusSum = character.estusMax + character.ashenEstusMax;
    if (estusSum < 4 || estusSum > 15) {
      // If sum is out of bounds, adjust to safe values
      if (estusSum < 4) {
        // Set to minimum: 3 HP, 1 Mana (or distribute 4 total)
        character.estusMax = Math.max(1, character.estusMax);
        character.ashenEstusMax = 4 - character.estusMax;
      } else if (estusSum > 15) {
        // Proportionally reduce to 15 total
        const ratio = 15 / estusSum;
        character.estusMax = Math.floor(character.estusMax * ratio);
        character.ashenEstusMax = 15 - character.estusMax;
      }
      estusChanged = true;
    }

    if (levelChanged) {
      character.level = correctLevel;
    }

    // Only re-render / notify if we actually changed something
    if (hadChanges || levelChanged || estusChanged) {
      bump();
      onCharacterUpdate();
    }
    // Depend on playerClass and safeMode to re-run when class or safeMode toggles,
    // and on character reference in case parent swaps the object.
  }, [character, character.playerClass, safeMode]);

  // Handlers (unchanged semantics)
  const handleStatChange = (statName: string, numValue: number) => {
    const classData = CLASS_STARTING_STATS[character.playerClass];
    if (safeMode && classData) {
      const propertyName = STAT_MAP[statName];
      const minStat = classData[propertyName] || 0;
      numValue = Math.max(minStat, numValue);
    }

    character.setStat(statName, numValue, safeMode);

    if (safeMode) {
      // recalc synchronously after setStat
      character.level = calculateLevel();
    }

    bump();
    onCharacterUpdate();
  };

  const handleClassChange = (value: string) => {
    const newClass = parseInt(value, 10) as PlayerClass;
    if (isNaN(newClass) || !CLASS_STARTING_STATS[newClass]) return;

    character.playerClass = newClass;

    if (safeMode) {
      const classData = CLASS_STARTING_STATS[newClass];
      // enforce minimums for the new class
      const corrections: { stat: string; from: number; to: number }[] = [];
      for (const statName of STAT_ORDER) {
        const current = character.getStat(statName);
        const propertyName = STAT_MAP[statName];
        const min = classData[propertyName] ?? 0;
        if (typeof current === 'number' && current < min) {
          corrections.push({ stat: statName, from: current, to: min });
        }
      }
      for (const c of corrections) character.setStat(c.stat, c.to, true);
      character.level = calculateLevel();
    }

    bump();
    onCharacterUpdate();
  };

  const handleLevelChange = (numValue: number) => {
    character.level = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleSoulsChange = (numValue: number) => {
    character.souls = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleHPChange = (numValue: number) => {
    character.hp = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleFPChange = (numValue: number) => {
    character.fp = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleStaminaChange = (numValue: number) => {
    character.stamina = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleNGCycleChange = (numValue: number) => {
    character.ngCycle = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleEstusMaxChange = (numValue: number) => {
    if (safeMode) {
      // Clamp input to 0-15
      numValue = Math.max(0, Math.min(15, numValue));

      let estusValue = numValue;
      let ashenValue = character.ashenEstusMax;

      // Special case: if estus >= 15, set to 15/0
      if (estusValue >= 15) {
        estusValue = 15;
        ashenValue = 0;
      }
      // Special case: if estus <= 0, set to 0/4
      else if (estusValue <= 0) {
        estusValue = 0;
        ashenValue = 4;
      }
      // Normal case: adjust ashen to maintain sum between 4-15
      else {
        const sum = estusValue + ashenValue;

        if (sum > 15) {
          // Reduce ashen to make sum = 15
          ashenValue = 15 - estusValue;
        } else if (sum < 4) {
          // Increase ashen to make sum = 4
          ashenValue = 4 - estusValue;
        }
      }

      character.estusMax = estusValue;
      character.ashenEstusMax = ashenValue;
    } else {
      numValue = Math.max(0, Math.min(20, numValue));
      character.estusMax = numValue;
    }

    bump();
    onCharacterUpdate();
  };

  const handleAshenEstusMaxChange = (numValue: number) => {
    if (safeMode) {
      // Clamp input to 0-15
      numValue = Math.max(0, Math.min(15, numValue));

      let estusValue = character.estusMax;
      let ashenValue = numValue;

      // Special case: if ashen >= 15, set to 0/15
      if (ashenValue >= 15) {
        estusValue = 0;
        ashenValue = 15;
      }
      // Special case: if ashen <= 0, set to 4/0
      else if (ashenValue <= 0) {
        estusValue = 4;
        ashenValue = 0;
      }
      // Normal case: adjust estus to maintain sum between 4-15
      else {
        const sum = estusValue + ashenValue;

        if (sum > 15) {
          // Reduce estus to make sum = 15
          estusValue = 15 - ashenValue;
        } else if (sum < 4) {
          // Increase estus to make sum = 4
          estusValue = 4 - ashenValue;
        }
      }

      character.estusMax = estusValue;
      character.ashenEstusMax = ashenValue;
    } else {
      numValue = Math.max(0, Math.min(20, numValue));
      character.ashenEstusMax = numValue;
    }

    bump();
    onCharacterUpdate();
  };

  const handleExportToBinary = () => {
    try {
      const rawData = character.getRawData();
      const dataToExport = new Uint8Array(rawData);
      const blob = new Blob([dataToExport], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `character_slot${character.slotIndex}_raw.bin`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export character data:', error);
      alert('Failed to export character data');
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
              <NumberInput
                value={character.level}
                onChange={handleLevelChange}
                min={1}
                max={MAX_VALUES.LEVEL}
                disabled={safeMode}
              />
            </div>
            {STAT_ORDER.map((statName) => (
              <div key={statName} className="stat-row">
                <label>{statName}</label>
                <NumberInput
                  value={character.getStat(statName)}
                  onChange={(value) => handleStatChange(statName, value)}
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
            <label>Class</label>
            <select value={character.playerClass} onChange={(e) => handleClassChange(e.target.value)}>
              {Object.entries(CLASS_NAMES).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>HP</label>
            <NumberInput value={character.hp} onChange={handleHPChange} min={0} max={9999} disabled={safeMode} />
          </div>

          <div className="form-group">
            <label>FP</label>
            <NumberInput value={character.fp} onChange={handleFPChange} min={0} max={999} disabled={safeMode} />
          </div>

          <div className="form-group">
            <label>Stamina</label>
            <NumberInput value={character.stamina} onChange={handleStaminaChange} min={0} max={999} disabled={safeMode} />
          </div>

          <div className="form-group">
            <label>Souls</label>
            <NumberInput value={character.souls} onChange={handleSoulsChange} min={0} max={MAX_VALUES.SOULS} />
          </div>

          <div className="form-group">
            <label>NG+ Cycle</label>
            <NumberInput value={character.ngCycle} onChange={handleNGCycleChange} min={0} max={MAX_VALUES.NG_CYCLE} />
          </div>

          <div className="form-group">
            <label>Estus Flask (hp/mana)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <NumberInput
                value={character.estusMax}
                onChange={handleEstusMaxChange}
                min={0}
                max={safeMode ? 15 : 20}
                style={{ flex: 1 }}
              />
              <span style={{ color: '#666' }}>/</span>
              <NumberInput
                value={character.ashenEstusMax}
                onChange={handleAshenEstusMaxChange}
                min={0}
                max={safeMode ? 15 : 20}
                style={{ flex: 1 }}
              />
              {safeMode && (
                <span style={{ fontSize: '0.85em', color: '#666', whiteSpace: 'nowrap' }}>
                  (Σ: {character.estusMax + character.ashenEstusMax})
                </span>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '20px', padding: '10px', backgroundColor: '#d1ecf1', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '0.9em' }}>
              <strong>ℹ️ Note:</strong> Character name editing is not yet available.
            </p>
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <button
              onClick={handleExportToBinary}
              style={{
                width: '100%',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1em',
                fontWeight: 'bold'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
            >
              📥 Export Character Data (.bin)
            </button>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.85em', color: '#666' }}>
              Download raw decrypted character data for pattern analysis
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};