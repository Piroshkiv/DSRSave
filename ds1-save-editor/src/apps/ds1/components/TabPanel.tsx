import React, { useState } from 'react';
import { Character } from '../lib/Character';
import { GeneralTab } from './GeneralTab';
import { InventoryTab } from './InventoryTab';
import { BonfiresTab } from './BonfiresTab';
import { NPCsTab } from './NPCsTab';
import { BossesTab } from './BossesTab';
import { TableTab } from './TableTab';

interface TabPanelProps {
  character: Character | null;
  onCharacterUpdate: () => void;
  onReload: () => void;
}

type TabType = 'general' | 'inventory' | 'bonfires' | 'npcs' | 'bosses' | 'table';

export const TabPanel: React.FC<TabPanelProps> = ({ character, onCharacterUpdate, onReload }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [safeMode, setSafeMode] = useState(true);

  if (!character) {
    return (
      <div className="tab-panel">
        <div className="no-character">
          Select a character to edit
        </div>
      </div>
    );
  }

  return (
    <div className="tab-panel">
      <div className="tabs-header">
        <div className="tabs">
          <button className="reload-button" onClick={onReload} title="Reload save file">
            ↻ Reload
          </button>
          <button
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
          <button
            className={`tab ${activeTab === 'bonfires' ? 'active' : ''}`}
            onClick={() => setActiveTab('bonfires')}
          >
            Bonfires
          </button>
          <button
            className={`tab ${activeTab === 'npcs' ? 'active' : ''}`}
            onClick={() => setActiveTab('npcs')}
          >
            NPCs
          </button>
          <button
            className={`tab ${activeTab === 'bosses' ? 'active' : ''}`}
            onClick={() => setActiveTab('bosses')}
          >
            Bosses
          </button>
          <button
            className={`tab ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            Table
          </button>
        </div>

        <div className="safe-mode-container">
          <div className="button-with-help">
            <label className="safe-mode-label">
              <input
                type="checkbox"
                checked={safeMode}
                onChange={(e) => setSafeMode(e.target.checked)}
              />
              <span>Safe Mode</span>
            </label>
            <span className="help-icon" title="Auto-adjust Level, HP, Stamina based on stats. Prevents Weapon Level editing.">
              ?
            </span>
          </div>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'general' && (
          <GeneralTab character={character} onCharacterUpdate={onCharacterUpdate} safeMode={safeMode} />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab character={character} onCharacterUpdate={onCharacterUpdate} safeMode={safeMode} />
        )}
        {activeTab === 'bonfires' && (
          <BonfiresTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'npcs' && (
          <NPCsTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'bosses' && (
          <BossesTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'table' && (
          <TableTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
      </div>
    </div>
  );
};
