import React, { useState } from 'react';
import { DS3Character } from '../lib/Character';
import { GeneralTab } from './GeneralTab';

interface TabPanelProps {
  character: DS3Character | null;
  onCharacterUpdate: () => void;
  onReload: () => void;
}

type TabType = 'general';

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
            className="tab"
            disabled
            title="Coming soon"
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            Inventory
          </button>
          <button
            className="tab"
            disabled
            title="Coming soon"
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            Bonfires
          </button>
        </div>

        <div className="safe-mode-container">
          <div className="button-with-help">
            <label className="safe-mode-label">
              <input
                type="checkbox"
                checked={safeMode}
                onChange={(e) => setSafeMode(e.target.checked)}
                disabled
              />
              <span>Safe Mode</span>
            </label>
            <span className="help-icon" title="Safe Mode is not yet implemented for DS3">
              ?
            </span>
          </div>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'general' && (
          <GeneralTab character={character} onCharacterUpdate={onCharacterUpdate} safeMode={safeMode} />
        )}
      </div>
    </div>
  );
};
