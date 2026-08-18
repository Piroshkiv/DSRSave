import React, { useEffect, useState } from 'react';
import { DS3Character } from '../lib/Character';
import { GeneralTab } from './GeneralTab';
import { InventoryTab } from './InventoryTab';
import { BonfiresTab } from './BonfiresTab';
import { BackupsTab } from './BackupsTab';
import type { SteamIdSummary } from '../lib/steamId';
import type { CreateBackupResult } from '../lib/backups';

export interface BackupControls {
  maxPerSlot: number;
  setMaxPerSlot: (value: number) => void;
  version: number;
  /** SteamID64 (decimal) of the loaded save, '' when it carries none. */
  currentSteamId: string;
  backupSlotNow: (slot: number) => Promise<CreateBackupResult>;
  restoreBackup: (id: number, targetSlot: number) => Promise<void>;
  notifyChanged: () => void;
}

interface TabPanelProps {
  character: DS3Character | null;
  onCharacterUpdate: () => void;
  safeMode: boolean;
  onSafeModeChange: (v: boolean) => void;
  /** false when the slot holds data but the game marked it deleted */
  slotActive?: boolean;
  /** false when entry10 could not be decrypted, so the flag must not be edited */
  canEditSlotFlags?: boolean;
  onSlotActiveChange?: (slotIndex: number, active: boolean) => void;
  /** Save-wide launch setting; null when entry10 could not be decrypted */
  online?: boolean | null;
  onOnlineChange?: (online: boolean) => void;
  /** Steam IDs found in the save: system entry + one per populated slot */
  steamIdSummary?: SteamIdSummary;
  /** ID read off the save's folder name, when the platform exposes a path */
  folderSteamId?: bigint | null;
  onSlotSteamIdChange?: (slotIndex: number, steamId: bigint) => void;
  onSteamIdApplyAll?: (steamId: bigint) => number;
  backups?: BackupControls | null;
}

type TabType = 'general' | 'inventory' | 'bonfires' | 'backups';

const TAB_LABELS: Record<TabType, string> = {
  general: 'General',
  inventory: 'Inventory',
  bonfires: 'Bonfires',
  backups: 'Backups',
};

const FULL_TABS: TabType[] = ['general', 'inventory', 'bonfires', 'backups'];

export const TabPanel: React.FC<TabPanelProps> = ({ character, onCharacterUpdate, safeMode, onSafeModeChange, slotActive = true, canEditSlotFlags = false, onSlotActiveChange, online = null, onOnlineChange, steamIdSummary, folderSteamId, onSlotSteamIdChange, onSteamIdApplyAll, backups }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // An empty slot is reachable only for its backup history, so that is all it offers
  const isEmptySlot = character?.isEmpty ?? false;

  useEffect(() => {
    if (isEmptySlot) setActiveTab('backups');
    else if (activeTab === 'backups' && !backups) setActiveTab('general');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmptySlot, character?.slotIndex]);

  if (!character) {
    return (
      <div className="tab-panel">
        <div className="no-character">
          Select a character to edit
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
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {isEmptySlot && (
          <div className="empty-slot-hint">
            Slot {character.slotIndex + 1} is empty — restore a backup into it below.
          </div>
        )}
        {activeTab === 'general' && !isEmptySlot && (
          <GeneralTab
            character={character}
            onCharacterUpdate={onCharacterUpdate}
            safeMode={safeMode}
            onSafeModeChange={onSafeModeChange}
            slotActive={slotActive}
            canEditSlotFlags={canEditSlotFlags}
            onSlotActiveChange={onSlotActiveChange}
            online={online}
            onOnlineChange={onOnlineChange}
            steamIdSummary={steamIdSummary}
            folderSteamId={folderSteamId}
            onSlotSteamIdChange={onSlotSteamIdChange}
            onSteamIdApplyAll={onSteamIdApplyAll}
          />
        )}
        {activeTab === 'inventory' && !isEmptySlot && (
          <InventoryTab character={character} onCharacterUpdate={onCharacterUpdate} safeMode={safeMode} />
        )}
        {activeTab === 'bonfires' && !isEmptySlot && (
          <BonfiresTab character={character} onCharacterUpdate={onCharacterUpdate} />
        )}
        {activeTab === 'backups' && backups && (
          <BackupsTab
            slot={character.slotIndex}
            currentSteamId={backups.currentSteamId}
            maxPerSlot={backups.maxPerSlot}
            onMaxPerSlotChange={backups.setMaxPerSlot}
            version={backups.version}
            onBackupNow={() => backups.backupSlotNow(character.slotIndex)}
            onRestore={(id) => backups.restoreBackup(id, character.slotIndex)}
            onChanged={backups.notifyChanged}
            canBackupNow={!isEmptySlot}
          />
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
