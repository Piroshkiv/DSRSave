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

  const handleSoulsChange = (numValue: number) => {
    character.souls = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleHPChange = (numValue: number) => {
    character.hp = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleFPChange = (numValue: number) => {
    character.fp = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleStaminaChange = (numValue: number) => {
    character.stamina = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleEstusMaxChange = (numValue: number) => {
    character.estusMax = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleAshenEstusMaxChange = (numValue: number) => {
    character.ashenEstusMax = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleNGCycleChange = (numValue: number) => {
    character.ngCycle = numValue;
    forceUpdate({});
    onCharacterUpdate();
  };

  const handleExportToBinary = () => {
    try {
      const rawData = character.getRawData();
      // Create a new Uint8Array to ensure we have a proper ArrayBuffer
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
            <label>HP</label>
            <NumberInput
              value={character.hp}
              onChange={handleHPChange}
              min={0}
              max={9999}
            />
          </div>

          <div className="form-group">
            <label>FP</label>
            <NumberInput
              value={character.fp}
              onChange={handleFPChange}
              min={0}
              max={999}
            />
          </div>

          <div className="form-group">
            <label>Stamina</label>
            <NumberInput
              value={character.stamina}
              onChange={handleStaminaChange}
              min={0}
              max={999}
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

          <div className="form-group">
            <label>Estus Flask Max</label>
            <NumberInput
              value={character.estusMax}
              onChange={handleEstusMaxChange}
              min={0}
              max={MAX_VALUES.ESTUS_MAX}
            />
          </div>

          <div className="form-group">
            <label>Ashen Estus Max</label>
            <NumberInput
              value={character.ashenEstusMax}
              onChange={handleAshenEstusMaxChange}
              min={0}
              max={MAX_VALUES.ASHEN_ESTUS_MAX}
            />
          </div>

          <div className="form-group">
            <label>NG+ Cycle</label>
            <NumberInput
              value={character.ngCycle}
              onChange={handleNGCycleChange}
              min={0}
              max={MAX_VALUES.NG_CYCLE}
            />
          </div>

          <div className="form-group" style={{ marginTop: '20px', padding: '10px', backgroundColor: '#d1ecf1', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '0.9em' }}>
              <strong>ℹ️ Note:</strong> Character name and class editing are not yet available.
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
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
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
