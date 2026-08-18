import { useState, useCallback, useEffect, useMemo, useRef, RefObject } from 'react';
import { DS3SaveFileEditor } from '../lib/SaveFileEditor';
import { DS3Character } from '../lib/Character';
import { STAT_ORDER } from '../lib/constants';
import { FileHandle } from '../../ds1/lib/adapters';
import { steamIdFromPath, type SteamIdSummary } from '../lib/steamId';
import { importSlotFromBinary } from '../lib/slotTransfer';
import {
  backupAllSlots,
  createBackup,
  getBackupCounts,
  getBackupPayload,
  DS3_DEFAULT_MAX_PER_SLOT,
  MAX_PER_SLOT_LIMIT,
  type CreateBackupResult,
} from '../lib/backups';
import type { FileUploadRef } from '../components/FileUpload';

const EMPTY_STEAM_ID_SUMMARY: SteamIdSummary = { system: null, slots: [], mismatched: false, unbound: [] };

const AUTO_BACKUP_KEY = 'ds3-auto-backup';
const MAX_BACKUPS_KEY = 'ds3-backup-max';

function readMaxPerSlot(): number {
  const stored = Number(localStorage.getItem(MAX_BACKUPS_KEY));
  if (!Number.isFinite(stored) || stored < 1) return DS3_DEFAULT_MAX_PER_SLOT;
  return Math.min(MAX_PER_SLOT_LIMIT, Math.floor(stored));
}

/**
 * Best-effort account ID from wherever the save was opened.
 *
 * Adapters keep their handles opaque, but the Tauri one is a `{ path }` object —
 * that is the only place a real path exists. In the browser the fallback is
 * `webkitRelativePath`, which is filled only when the user picked a directory.
 */
function steamIdFromSource(file: File, fileHandle: FileHandle | null): bigint | null {
  const handlePath = (fileHandle as { path?: string } | null)?.path;
  return (
    steamIdFromPath(handlePath) ??
    steamIdFromPath((file as File & { webkitRelativePath?: string }).webkitRelativePath)
  );
}

/**
 * Every populated slot's level and nine stats, as one comparable string.
 *
 * Compared against a baseline taken at load (and re-taken after each save) to
 * answer "were stats edited since this file was last on disk?" — cheaper and
 * more honest than threading a dirty flag through every stat input, and it
 * self-corrects when a value is edited back to what it was.
 */
function statsFingerprint(editor: DS3SaveFileEditor | null): string {
  if (!editor) return '';
  return editor.getCharacters()
    .map(c => (c.isEmpty ? '-' : `${c.level}:${STAT_ORDER.map(s => c.getStat(s)).join(',')}`))
    .join('|');
}

/** What a completed save did, for the caller's post-save messaging. */
export interface SaveOutcome {
  /** Stats differed from the last state written to disk. */
  statsChanged: boolean;
  /** The save was flipped from online to offline because of that. */
  switchedOffline: boolean;
}

export interface UseDS3SaveEditorResult {
  saveEditor: DS3SaveFileEditor | null;
  characters: DS3Character[];
  selectedCharacterIndex: number | null;
  originalFilename: string;
  isSlotActive: (slotIndex: number) => boolean;
  canEditSlotFlags: boolean;
  setSlotActive: (slotIndex: number, active: boolean) => void;

  /** Save-wide network setting; null when the system entry could not be read. */
  online: boolean | null;
  setOnline: (online: boolean) => void;

  /** Current SteamID64s: the system entry's plus one per populated slot. */
  steamIdSummary: SteamIdSummary;
  /** ID taken from the save's folder name, when the platform exposes a path. */
  folderSteamId: bigint | null;
  /** Rebind a single slot. */
  setSlotSteamId: (slotIndex: number, steamId: bigint) => void;
  /** Rebind the system entry and every populated slot; returns slots rewritten. */
  applySteamIdToAll: (steamId: bigint) => number;

  autoBackup: boolean;
  maxBackupsPerSlot: number;
  /** Number of stored backups per slot, for the slot list badges. */
  backupCounts: Record<number, number>;
  /** Bumped whenever the store changes, so lists can refetch. */
  backupsVersion: number;
  setAutoBackup: (value: boolean) => void;
  setMaxBackupsPerSlot: (value: number) => void;
  backupSlotNow: (slot: number) => Promise<CreateBackupResult>;
  restoreBackup: (id: number, targetSlot: number) => Promise<void>;
  notifyBackupsChanged: () => void;

  handleFileLoaded: (file: File, fileHandle: FileHandle | null) => Promise<void>;
  handleCharacterSelect: (index: number) => void;
  handleCharacterUpdate: () => void;
  handleSave: () => Promise<SaveOutcome>;
  handleSaveAs: () => Promise<SaveOutcome>;
  handleReload: () => void;
}

export const useDS3SaveEditor = (fileUploadRef: RefObject<FileUploadRef>): UseDS3SaveEditorResult => {
  const [saveEditor, setSaveEditor] = useState<DS3SaveFileEditor | null>(null);
  const [characters, setCharacters] = useState<DS3Character[]>([]);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState<number | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [originalFilename, setOriginalFilename] = useState<string>('DS30000.sl2');
  const [folderSteamId, setFolderSteamId] = useState<bigint | null>(null);

  // Stats as they were last written to disk; anything else means unsaved edits
  const statsBaselineRef = useRef('');

  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem(AUTO_BACKUP_KEY) !== 'off');
  const [maxBackupsPerSlot, setMaxBackupsPerSlot] = useState(readMaxPerSlot);
  const [backupCounts, setBackupCounts] = useState<Record<number, number>>({});
  const [backupsVersion, setBackupsVersion] = useState(0);

  // Read inside callbacks that must not be re-created when a setting changes
  const autoBackupRef = useRef(autoBackup);
  const maxBackupsRef = useRef(maxBackupsPerSlot);
  useEffect(() => { autoBackupRef.current = autoBackup; }, [autoBackup]);
  useEffect(() => { maxBackupsRef.current = maxBackupsPerSlot; }, [maxBackupsPerSlot]);

  const notifyBackupsChanged = useCallback(() => {
    setBackupsVersion(v => v + 1);
  }, []);

  useEffect(() => {
    getBackupCounts()
      .then(setBackupCounts)
      .catch(error => console.error('[useDS3SaveEditor] Failed to read backup counts:', error));
  }, [backupsVersion]);

  useEffect(() => {
    localStorage.setItem(AUTO_BACKUP_KEY, autoBackup ? 'on' : 'off');
  }, [autoBackup]);

  useEffect(() => {
    localStorage.setItem(MAX_BACKUPS_KEY, String(maxBackupsPerSlot));
  }, [maxBackupsPerSlot]);

  /** Snapshot every non-empty slot; unchanged slots are skipped by content hash. */
  const runAutoBackup = useCallback(async (editor: DS3SaveFileEditor) => {
    if (!autoBackupRef.current) return;
    try {
      const result = await backupAllSlots(editor, 'auto', maxBackupsRef.current);
      if (result.created > 0) {
        console.log(`[useDS3SaveEditor] Backed up slots ${result.slots.join(', ')}`);
        notifyBackupsChanged();
      }
    } catch (error) {
      console.error('[useDS3SaveEditor] Auto-backup failed:', error);
    }
  }, [notifyBackupsChanged]);

  const handleFileLoaded = useCallback(async (file: File, fileHandle: FileHandle | null) => {
    try {
      setOriginalFilename(file.name);
      setFolderSteamId(steamIdFromSource(file, fileHandle));

      const editor = await DS3SaveFileEditor.fromFileData(file, fileHandle);

      setSaveEditor(editor);
      const allCharacters = editor.getCharacters();
      setCharacters(allCharacters);
      statsBaselineRef.current = statsFingerprint(editor);

      // Select first non-empty character
      const firstNonEmptyIndex = allCharacters.findIndex(char => !char.isEmpty);
      setSelectedCharacterIndex(firstNonEmptyIndex !== -1 ? firstNonEmptyIndex : null);

      // Snapshot what was on disk before any edit — the baseline to roll back to
      void runAutoBackup(editor);
    } catch (error) {
      console.error('Error loading save file:', error);
      alert('Error loading save file. Please make sure it is a valid Dark Souls 3 save file.');
    }
  }, [runAutoBackup]);

  const handleCharacterSelect = useCallback((index: number) => {
    setSelectedCharacterIndex(index);
  }, []);

  const handleCharacterUpdate = useCallback(() => {
    // Trigger re-render
    setUpdateTrigger(prev => prev + 1);
  }, []);

  /**
   * Edited stats plus online play is what gets accounts banned: the servers see
   * a character whose stats never came from legitimate progression. Force the
   * save offline so the game reconciles it locally before it can report in.
   *
   * Runs before the bytes are written, so the flipped flag lands in the same
   * save rather than waiting for the next one.
   */
  const applyOfflineGuard = useCallback((editor: DS3SaveFileEditor): SaveOutcome => {
    const statsChanged = statsFingerprint(editor) !== statsBaselineRef.current;
    if (!statsChanged || editor.isOnline() !== true) {
      return { statsChanged, switchedOffline: false };
    }
    editor.setOnline(false);
    return { statsChanged, switchedOffline: true };
  }, []);

  /**
   * Run a write with the offline guard applied around it. A failed or cancelled
   * write puts the online flag back, so an aborted Save As does not silently
   * leave the loaded save switched to offline.
   */
  const guardedWrite = useCallback(async (
    editor: DS3SaveFileEditor,
    write: () => Promise<void>,
  ): Promise<SaveOutcome> => {
    const outcome = applyOfflineGuard(editor);
    try {
      await write();
    } catch (error) {
      if (outcome.switchedOffline) editor.setOnline(true);
      throw error;
    }
    // The file on disk is the new baseline for "were stats edited?"
    statsBaselineRef.current = statsFingerprint(editor);
    setUpdateTrigger(prev => prev + 1);
    return outcome;
  }, [applyOfflineGuard]);

  const handleSave = useCallback(async (): Promise<SaveOutcome> => {
    if (!saveEditor) return { statsChanged: false, switchedOffline: false };
    setUpdateTrigger(prev => prev + 1);

    const outcome = await guardedWrite(saveEditor, async () => {
      if (saveEditor.hasFileHandle()) {
        await saveEditor.saveToOriginalFile();
      } else {
        await saveEditor.downloadSaveFile(originalFilename);
      }
    });

    // Record the state that just went to disk; saving twice in a row is a no-op
    // here because the slot bytes still hash to the last backup
    await runAutoBackup(saveEditor);
    return outcome;
  }, [saveEditor, originalFilename, runAutoBackup, guardedWrite]);

  /** Back up a single slot on demand, ignoring the auto-backup toggle. */
  const backupSlotNow = useCallback(async (slot: number) => {
    if (!saveEditor) throw new Error('No save file loaded');
    const character = saveEditor.getCharacter(slot);
    if (!character) throw new Error(`Slot ${slot} not found`);

    const result = await createBackup(character, 'manual', {
      summary: saveEditor.readSlotSummary(slot),
      maxPerSlot: maxBackupsRef.current,
    });
    if (result.created) notifyBackupsChanged();
    return result;
  }, [saveEditor, notifyBackupsChanged]);

  /**
   * Put a stored slot back into the loaded editor.
   *
   * Same mechanics as a merge import — slot bytes, load-menu summary and a
   * rebind to this save's Steam ID — but nothing touches the disk until the
   * user saves. The slot being replaced is snapshotted first, so a restore is
   * itself undoable.
   */
  const restoreBackup = useCallback(async (id: number, targetSlot: number) => {
    if (!saveEditor) throw new Error('No save file loaded');
    if (targetSlot < 0 || targetSlot >= 10) throw new Error('Invalid target slot');

    const payload = await getBackupPayload(id);
    if (!payload) throw new Error('Backup data is missing');

    const current = saveEditor.getCharacter(targetSlot);
    if (current && !current.isEmpty) {
      await createBackup(current, 'pre-restore', {
        summary: saveEditor.readSlotSummary(targetSlot),
        maxPerSlot: maxBackupsRef.current,
      });
    }

    importSlotFromBinary(saveEditor, payload.slotData, targetSlot, {
      summary: payload.summary,
    });

    setCharacters([...saveEditor.getCharacters()]);
    setSelectedCharacterIndex(targetSlot);
    setUpdateTrigger(prev => prev + 1);
    notifyBackupsChanged();
  }, [saveEditor, notifyBackupsChanged]);

  const setMaxBackupsPerSlotValue = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    setMaxBackupsPerSlot(Math.max(1, Math.min(MAX_PER_SLOT_LIMIT, Math.floor(value))));
  }, []);

  const handleSaveAs = useCallback(async (): Promise<SaveOutcome> => {
    if (!saveEditor) return { statsChanged: false, switchedOffline: false };
    return guardedWrite(saveEditor, () => saveEditor.saveToNewFile(originalFilename));
  }, [saveEditor, originalFilename, guardedWrite]);

  const handleReload = useCallback(() => {
    // Open file dialog for reload
    fileUploadRef.current?.openFileDialog();
  }, [fileUploadRef]);

  const isSlotActive = useCallback((slotIndex: number): boolean => {
    return saveEditor ? saveEditor.isSlotActive(slotIndex) : false;
  }, [saveEditor]);

  const setSlotActive = useCallback((slotIndex: number, active: boolean) => {
    if (!saveEditor) return;
    try {
      saveEditor.setSlotActive(slotIndex, active);
      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to change slot state:', error);
      alert(error instanceof Error ? error.message : 'Failed to change slot state');
    }
  }, [saveEditor]);

  // Save-wide, so it is re-read on any edit rather than tied to a slot.
  const online = useMemo<boolean | null>(() => {
    void updateTrigger;
    return saveEditor ? saveEditor.isOnline() : null;
  }, [saveEditor, updateTrigger]);

  const setOnline = useCallback((value: boolean) => {
    if (!saveEditor) return;
    try {
      saveEditor.setOnline(value);
      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to change the online flag:', error);
      alert(error instanceof Error ? error.message : 'Failed to change the online flag');
    }
  }, [saveEditor]);

  // Recomputed whenever a slot is edited, so the mismatch banner stays honest.
  const steamIdSummary = useMemo<SteamIdSummary>(() => {
    void updateTrigger;
    return saveEditor ? saveEditor.getSteamIdSummary() : EMPTY_STEAM_ID_SUMMARY;
  }, [saveEditor, updateTrigger]);

  const setSlotSteamId = useCallback((slotIndex: number, steamId: bigint) => {
    if (!saveEditor) return;
    const character = saveEditor.getCharacter(slotIndex);
    if (!character) return;

    if (!character.setSteamId(steamId)) {
      alert(`Slot ${slotIndex + 1} has no Steam ID field to write.`);
      return;
    }
    setUpdateTrigger(prev => prev + 1);
  }, [saveEditor]);

  const applySteamIdToAll = useCallback((steamId: bigint): number => {
    if (!saveEditor) return 0;
    const patched = saveEditor.setSteamId(steamId);
    setUpdateTrigger(prev => prev + 1);
    return patched;
  }, [saveEditor]);

  return {
    saveEditor,
    characters,
    selectedCharacterIndex,
    originalFilename,
    isSlotActive,
    canEditSlotFlags: saveEditor ? saveEditor.canEditSlotFlags() : false,
    setSlotActive,
    online,
    setOnline,
    steamIdSummary,
    folderSteamId,
    setSlotSteamId,
    applySteamIdToAll,
    autoBackup,
    maxBackupsPerSlot,
    backupCounts,
    backupsVersion,
    setAutoBackup,
    setMaxBackupsPerSlot: setMaxBackupsPerSlotValue,
    backupSlotNow,
    restoreBackup,
    notifyBackupsChanged,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
  };
};
