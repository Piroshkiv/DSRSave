import React, { useState } from 'react';
import { DS3Character } from '../lib/Character';
import { GeneralTab } from './GeneralTab';
import { InventoryTab } from './InventoryTab';
import { BonfiresTab } from './BonfiresTab';

interface TabPanelProps {
  character: DS3Character | null;
  onCharacterUpdate: () => void;
  safeMode: boolean;
  onSafeModeChange: (v: boolean) => void;
}

type TabType = 'general' | 'inventory' | 'bonfires';

export const TabPanel: React.FC<TabPanelProps> = ({ character, onCharacterUpdate, safeMode, onSafeModeChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');

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
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'general' && (
          <GeneralTab
            character={character}
            onCharacterUpdate={onCharacterUpdate}
            safeMode={safeMode}
            onSafeModeChange={onSafeModeChange}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab character={character} onCharacterUpdate={onCharacterUpdate} safeMode={safeMode} />
        )}
        {activeTab === 'bonfires' && (
          <BonfiresTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
      </div>
    </div>
  );
};
