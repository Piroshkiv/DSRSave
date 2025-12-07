import React, { useState } from 'react';
import { DS3Character } from '../lib/Character';
import { NumberInput } from '../../ds1/components/NumberInput';
import { MAX_VALUES } from '../lib/constants';

interface GeneralTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
  safeMode: boolean;
}

const STAT_ORDER = ['VIG', 'ATN', 'END', 'VIT', 'STR', 'DEX', 'INT', 'FTH', 'LCK'];

// DS3 Classes (MOCK - placeholder values)
const CLASS_NAMES: Record<number, string> = {
  0: 'Knight',
  1: 'Mercenary',
  2: 'Warrior',
  3: 'Herald',
  4: 'Thief',
  5: 'Assassin',
  6: 'Sorcerer',
  7: 'Pyromancer',
  8: 'Cleric',
  9: 'Deprived'
};

export const GeneralTab: React.FC<GeneralTabProps> = ({ character, onCharacterUpdate }) => {
  const [, forceUpdate] = useState({});

  const handleStatChange = (statName: string, numValue: number) => {
    character.setStat(statName, numValue);
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleLevelChange = (numValue: number) => {
    character.level = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleNameChange = (value: string) => {
    if (value.length <= 16) {
      character.name = value;
      forceUpdate({});
      onCharacterUpdate();
    }
  };

  const handleSoulsChange = (numValue: number) => {
    character.souls = numValue;
    forceUpdate({});
    onCharacterUpdate();
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
                max={802}
                disabled={true}
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
                  disabled={true}
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
              disabled={true}
            />
          </div>

          <div className="form-group">
            <label>Class</label>
            <select
              value={0}
              disabled={true}
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
            <NumberInput
              value={1000}
              onChange={() => {}}
              min={0}
              max={9999}
              disabled={true}
            />
          </div>

          <div className="form-group">
            <label>FP</label>
            <NumberInput
              value={100}
              onChange={() => {}}
              min={0}
              max={999}
              disabled={true}
            />
          </div>

          <div className="form-group">
            <label>Stamina</label>
            <NumberInput
              value={100}
              onChange={() => {}}
              min={0}
              max={999}
              disabled={true}
            />
          </div>

          <div className="form-group">
            <label>Souls</label>
            <NumberInput
              value={character.souls}
              onChange={handleSoulsChange}
              min={0}
              max={MAX_VALUES.SOULS}
            />
          </div>

          <div className="form-group" style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '0.9em' }}>
              <strong>ℹ️ Note:</strong> Only Souls editing is currently available. Other fields are disabled (MOCK values).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
