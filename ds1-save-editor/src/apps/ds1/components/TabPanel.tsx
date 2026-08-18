import React, { useEffect, useState } from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { CreateBackupResult } from '../lib/backups';
import { GeneralTab } from './GeneralTab';
import { InventoryTab } from './InventoryTab';
import { BonfiresTab } from './BonfiresTab';
import { NPCsTab } from './NPCsTab';
import { BossesTab } from './BossesTab';
import { WorldEventsTab } from './WorldEventsTab';
import { TableTab } from './TableTab';
import { AppearanceTab } from './AppearanceTab';
import { HelpTab } from './HelpTab';
import { BackupsTab } from './BackupsTab';

export interface BackupControls {
  maxPerSlot: number;
  setMaxPerSlot: (value: number) => void;
  version: number;
  backupSlotNow: (slot: number) => Promise<CreateBackupResult>;
  restoreBackup: (id: number, targetSlot: number) => Promise<void>;
  notifyChanged: () => void;
}

interface TabPanelProps {
  character: Character | null;
  onCharacterUpdate: () => void;
  safeMode: boolean;
  backups?: BackupControls | null;
}

type TabType = 'help' | 'general' | 'appearance' | 'inventory' | 'bonfires' | 'npcs' | 'bosses' | 'world_events' | 'backups' | 'table';

const TAB_KEYS: Record<TabType, string> = {
  help: 'tab_help',
  general: 'tab_general',
  appearance: 'tab_appearance',
  inventory: 'tab_inventory',
  bonfires: 'tab_bonfires',
  npcs: 'tab_npcs',
  bosses: 'tab_bosses',
  world_events: 'tab_world_events',
  backups: 'tab_backups',
  table: 'tab_table',
};

const FULL_TABS: TabType[] = ['general', 'appearance', 'inventory', 'bonfires', 'npcs', 'bosses', 'backups', 'table'];


export const TabPanel: React.FC<TabPanelProps> = ({ character, onCharacterUpdate, safeMode, backups }) => {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // An empty slot is reachable only for its backup history, so that is all it offers
  const isEmptySlot = character?.isEmpty ?? false;

  useEffect(() => {
    if (isEmptySlot) setActiveTab('backups');
    else if (activeTab === 'backups' && !backups) setActiveTab('general');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmptySlot, character?.slotNumber]);

  if (!character) {
    return (
      <div className="tab-panel">
        <div className="no-character">
          {t('selectChar', lang)}
        </div>
      </div>
    );
  }

  const visibleTabs: TabType[] = isEmptySlot
    ? ['backups']
    : backups ? FULL_TABS : FULL_TABS.filter(tab => tab !== 'backups');

  return (
    <div className="tab-panel">
      <div className="tabs-header">
        <div className="tabs">
          {visibleTabs.map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(TAB_KEYS[tab], lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {isEmptySlot && (
          <div className="empty-slot-hint">
            {t('backupEmptySlotNotice', lang).replace('{slot}', String(character.slotNumber + 1))}
          </div>
        )}
        {activeTab === 'help' && !isEmptySlot && (
          <HelpTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'general' && !isEmptySlot && (
          <GeneralTab character={character} onCharacterUpdate={onCharacterUpdate} safeMode={safeMode} />
        )}
        {activeTab === 'appearance' && !isEmptySlot && (
          <AppearanceTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'inventory' && !isEmptySlot && (
          <InventoryTab character={character} onCharacterUpdate={onCharacterUpdate} safeMode={safeMode} />
        )}
        {activeTab === 'bonfires' && !isEmptySlot && (
          <BonfiresTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'npcs' && !isEmptySlot && (
          <NPCsTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'bosses' && !isEmptySlot && (
          <BossesTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'world_events' && !isEmptySlot && (
          <WorldEventsTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'backups' && backups && (
          <BackupsTab
            slot={character.slotNumber}
            currentName={isEmptySlot ? '' : (character.name || '')}
            maxPerSlot={backups.maxPerSlot}
            onMaxPerSlotChange={backups.setMaxPerSlot}
            version={backups.version}
            onBackupNow={() => backups.backupSlotNow(character.slotNumber)}
            onRestore={id => backups.restoreBackup(id, character.slotNumber)}
            onChanged={backups.notifyChanged}
            canBackupNow={!isEmptySlot}
          />
        )}
        {activeTab === 'table' && !isEmptySlot && (
          <TableTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
      </div>

      <style>{`
        .empty-slot-hint {
          margin-bottom: 0.75rem;
          padding: 0.5rem 0.7rem;
          background: rgba(255, 255, 255, 0.03);
          border-left: 2px solid rgba(255, 107, 53, 0.5);
          border-radius: 3px;
          font-size: 0.78rem;
          color: #888;
        }
      `}</style>
    </div>
  );
};
