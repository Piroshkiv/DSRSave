import React, { useState } from 'react';
import { Character } from '../lib/Character';
import { GeneralTab } from './GeneralTab';

interface TabPanelProps {
  character: Character | null;
  onCharacterUpdate: () => void;
}

type TabType = 'general';

export const TabPanel: React.FC<TabPanelProps> = ({ character, onCharacterUpdate }) => {
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
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'general' && (
          <GeneralTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
      </div>
    </div>
  );
};
