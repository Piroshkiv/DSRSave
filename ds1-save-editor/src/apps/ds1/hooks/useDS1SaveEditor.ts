import { useState, useCallback, useEffect, useRef } from 'react';
import { SaveFileEditor } from '../lib/SaveFileEditor';
import { SaveFileEditorNintendo, detectPlatform } from '../lib/SaveFileEditorNintendo';
import { SaveFileEditorPS4 } from '../lib/SaveFileEditorPS4';
import { Character } from '../lib/Character';
import { FileHandle, getFileSystemAdapter, detectEnvironment } from '../lib/adapters';
import { getFilePathFromHandle, extractFilename } from '../lib/filePathUtils';
import { importSlotFromBinary } from '../lib/slotDuplicator';
import {
  backupAllSlots,
  createBackup,
  getBackupCounts,
  getBackupPayload,
  DEFAULT_MAX_PER_SLOT,
  MAX_PER_SLOT_LIMIT,
  CreateBackupResult,
} from '../lib/backups';

type SaveEditor = SaveFileEditor | SaveFileEditorNintendo | SaveFileEditorPS4;

// Auto-detect works reliably only in Tauri (web FileSystemObserver/permissions are flaky)
const AUTO_DETECT_AVAILABLE = detectEnvironment() === 'tauri';

const AUTO_BACKUP_KEY = 'ds1-auto-backup';
const MAX_BACKUPS_KEY = 'ds1-backup-max';

function readMaxPerSlot(): number {
  const stored = Number(localStorage.getItem(MAX_BACKUPS_KEY));
  if (!Number.isFinite(stored) || stored < 1) return DEFAULT_MAX_PER_SLOT;
  return Math.min(MAX_PER_SLOT_LIMIT, Math.floor(stored));
}

export interface UseDS1SaveEditorResult {
  saveEditor: SaveEditor | null;
  characters: Character[];
  selectedCharacterIndex: number | null;
  originalFilename: string;
  platform: 'pc' | 'nintendo' | 'ps4' | 'unknown';
  autoDetect: boolean;
  autoDetectAvailable: boolean;

  autoBackup: boolean;
  maxBackupsPerSlot: number;
  /** Number of stored backups per slot, for the slot list badges. */
  backupCounts: Record<number, number>;
  /** Bumped whenever the store changes, so lists can refetch. */
  backupsVersion: number;

  handleFileLoaded: (file: File, fileHandle: FileHandle | null, opts?: { preserveSelection?: boolean }) => Promise<void>;
  handleCharacterSelect: (index: number) => void;
  handleCharacterUpdate: () => void;
  handleSave: () => Promise<void>;
  handleSaveAs: () => Promise<void>;
  handleReload: () => Promise<void>;
  setAutoDetect: (value: boolean) => void;
  setAutoBackup: (value: boolean) => void;
  setMaxBackupsPerSlot: (value: number) => void;
  backupSlotNow: (slot: number) => Promise<CreateBackupResult>;
  restoreBackup: (id: number, targetSlot: number) => Promise<void>;
  notifyBackupsChanged: () => void;
}

export const useDS1SaveEditor = (): UseDS1SaveEditorResult => {
  const [saveEditor, setSaveEditor] = useState<SaveEditor | null>(null);
  const [platform, setPlatform] = useState<'pc' | 'nintendo' | 'ps4' | 'unknown'>('unknown');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState<number | null>(null);
  const [, setUpdateTrigger] = useState(0);
  const [originalFilename, setOriginalFilename] = useState<string>('DRAKS0005.sl2');
  const [autoDetect, setAutoDetect] = useState(() => {
    // Tauri-only, off by default — the user opts in explicitly
    return AUTO_DETECT_AVAILABLE && localStorage.getItem('ds1-auto-detect') === 'on';
  });
  const stopWatchRef = useRef<(() => void) | null>(null);

  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem(AUTO_BACKUP_KEY) !== 'off');
  const [maxBackupsPerSlot, setMaxBackupsPerSlot] = useState(readMaxPerSlot);
  const [backupCounts, setBackupCounts] = useState<Record<number, number>>({});
  const [backupsVersion, setBackupsVersion] = useState(0);

  // Read inside callbacks that must not be re-created when a setting changes —
  // handleFileLoaded feeds handleReload, which the file watcher effect depends on
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
      .catch(error => console.error('[useDS1SaveEditor] Failed to read backup counts:', error));
  }, [backupsVersion]);

  /** Snapshot every non-empty slot; unchanged slots are skipped by content hash. */
  const runAutoBackup = useCallback(async (editor: SaveEditor) => {
    if (!autoBackupRef.current) return;
    try {
      const result = await backupAllSlots(editor.getCharacters(), 'auto', maxBackupsRef.current);
      if (result.created > 0) {
        console.log(`[useDS1SaveEditor] Backed up slots ${result.slots.join(', ')}`);
        notifyBackupsChanged();
      }
    } catch (error) {
      console.error('[useDS1SaveEditor] Auto-backup failed:', error);
    }
  }, [notifyBackupsChanged]);

  const handleFileLoaded = useCallback(async (file: File, fileHandle: FileHandle | null, opts?: { preserveSelection?: boolean }) => {
    try {
      const filePath = await getFilePathFromHandle(
        file,
        fileHandle as FileSystemFileHandle | null
      );
      setOriginalFilename(filePath);

      // Detect platform: PS4 by filename, otherwise by file size
      const isPS4 = file.name.startsWith('userdata');
      const detectedPlatform = isPS4 ? 'ps4' : detectPlatform(file.size);
      setPlatform(detectedPlatform);

      let editor: SaveEditor;
      if (detectedPlatform === 'ps4') {
        editor = await SaveFileEditorPS4.fromFileData(file, fileHandle);
        console.log('Loaded PS4 save file');
      } else if (detectedPlatform === 'nintendo') {
        editor = await SaveFileEditorNintendo.fromFileData(file, fileHandle);
        console.log('Loaded Nintendo Switch save file');
      } else {
        editor = await SaveFileEditor.fromFileData(file, fileHandle);
        console.log('Loaded PC save file');
      }

      setSaveEditor(editor);
      const allCharacters = editor.getCharacters();
      const displayedCharacters = allCharacters.slice(0, 10);
      setCharacters(displayedCharacters);

      const firstNonEmptyIndex = displayedCharacters.findIndex(char => !char.isEmpty);
      // On reload keep the current selection — an emptied slot stays reachable
      // because its backups are still browsable there
      setSelectedCharacterIndex(prev =>
        opts?.preserveSelection && prev !== null && displayedCharacters[prev]
          ? prev
          : (firstNonEmptyIndex !== -1 ? firstNonEmptyIndex : null)
      );

      // Snapshot what was on disk before any edit — the baseline to roll back to
      void runAutoBackup(editor);
    } catch (error) {
      console.error('Error loading save file:', error);
      alert('Error loading save file. Please make sure it is a valid Dark Souls save file.');
    }
  }, []);

  const handleCharacterSelect = useCallback((index: number) => {
    setSelectedCharacterIndex(index);
  }, []);

  const handleCharacterUpdate = useCallback(() => {
    setUpdateTrigger(prev => prev + 1);
  }, []);

  const handleSave = useCallback(async () => {
    if (!saveEditor) return;

    try {
      setUpdateTrigger(prev => prev + 1);

      if (saveEditor.hasFileHandle()) {
        await saveEditor.saveToOriginalFile();
        alert('Save file updated successfully!');
      } else {
        // Extract just filename for download
        const filename = extractFilename(originalFilename);
        await saveEditor.downloadSaveFile(filename);
      }

      // Record the state that just went to disk; saving twice in a row is a
      // no-op here because the slot bytes still hash to the last backup
      await runAutoBackup(saveEditor);
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Error saving file. Please try again.');
    }
  }, [saveEditor, originalFilename, runAutoBackup]);

  /** Back up a single slot on demand, ignoring the auto-backup toggle. */
  const backupSlotNow = useCallback(async (slot: number) => {
    if (!saveEditor) throw new Error('No save file loaded');
    const chars = saveEditor.getCharacters();
    const character = chars[slot];
    if (!character) throw new Error(`Slot ${slot} not found`);

    const result = await createBackup(character, 'manual', maxBackupsRef.current);
    if (result.created) notifyBackupsChanged();
    return result;
  }, [saveEditor, notifyBackupsChanged]);

  /**
   * Put a stored slot back into the loaded editor.
   *
   * Same mechanics as a merge import — slot bytes plus the load screen block —
   * but nothing touches the disk until the user saves. The slot being replaced
   * is snapshotted first so a restore is itself undoable.
   */
  const restoreBackup = useCallback(async (id: number, targetSlot: number) => {
    if (!saveEditor) throw new Error('No save file loaded');
    if (targetSlot < 0 || targetSlot >= 10) throw new Error('Invalid target slot');

    const slotData = await getBackupPayload(id);
    if (!slotData) throw new Error('Backup data is missing');

    const chars = saveEditor.getCharacters();
    const current = chars[targetSlot];
    if (current && !current.isEmpty) {
      await createBackup(current, 'pre-restore', maxBackupsRef.current);
    }

    importSlotFromBinary(saveEditor, slotData, targetSlot);

    setCharacters(saveEditor.getCharacters().slice(0, 10));
    setSelectedCharacterIndex(targetSlot);
    setUpdateTrigger(prev => prev + 1);
    notifyBackupsChanged();
  }, [saveEditor, notifyBackupsChanged]);

  const handleSaveAs = useCallback(async () => {
    if (!saveEditor) return;

    try {
      // Extract just filename and prepend "edited_"
      const filename = extractFilename(originalFilename);
      const editedFilename = `edited_${filename}`;
      await saveEditor.saveToNewFile(editedFilename);
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Error saving file. Please try again.');
    }
  }, [saveEditor, originalFilename]);

  const handleReload = useCallback(async () => {
    if (!saveEditor) return;

    try {
      if (saveEditor.hasFileHandle()) {
        const fileHandle = saveEditor.getFileHandle();
        if (fileHandle) {
          // Re-read through the adapter — a web handle exposes getFile(),
          // a Tauri handle is just { path } and must be read via plugin-fs
          const adapter = getFileSystemAdapter();
          const file = await adapter.readFile(fileHandle);
          await handleFileLoaded(file, fileHandle, { preserveSelection: true });
        }
      } else {
        alert('Cannot reload: no file handle available. Please load the file again.');
      }
    } catch (error) {
      console.error('Error reloading file:', error);
      alert('Error reloading file. Please try again.');
    }
  }, [saveEditor, handleFileLoaded]);

  // Auto-detect file changes
  useEffect(() => {
    if (!AUTO_DETECT_AVAILABLE || !saveEditor?.hasFileHandle() || !autoDetect) {
      // Stop watching if no file handle or auto-detect is off
      if (stopWatchRef.current) {
        stopWatchRef.current();
        stopWatchRef.current = null;
      }
      return;
    }

    const adapter = getFileSystemAdapter();
    const fileHandle = saveEditor.getFileHandle();

    if (!fileHandle) return;

    console.log('[useDS1SaveEditor] Starting file watcher');

    adapter.watchFile(fileHandle, () => {
      console.log('[useDS1SaveEditor] File changed, auto-reloading...');
      handleReload();
    }).then(stop => {
      stopWatchRef.current = stop;
    });

    return () => {
      if (stopWatchRef.current) {
        stopWatchRef.current();
        stopWatchRef.current = null;
      }
    };
  }, [saveEditor, autoDetect, handleReload]);

  // Persist autoDetect preference
  useEffect(() => {
    localStorage.setItem('ds1-auto-detect', autoDetect ? 'on' : 'off');
  }, [autoDetect]);

  useEffect(() => {
    localStorage.setItem(AUTO_BACKUP_KEY, autoBackup ? 'on' : 'off');
  }, [autoBackup]);

  useEffect(() => {
    localStorage.setItem(MAX_BACKUPS_KEY, String(maxBackupsPerSlot));
  }, [maxBackupsPerSlot]);

  const setAutoDetectValue = useCallback((value: boolean) => {
    setAutoDetect(value);
  }, []);

  const setMaxBackupsPerSlotValue = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    setMaxBackupsPerSlot(Math.max(1, Math.min(MAX_PER_SLOT_LIMIT, Math.floor(value))));
  }, []);

  return {
    saveEditor,
    characters,
    selectedCharacterIndex,
    originalFilename,
    platform,
    autoDetect,
    autoDetectAvailable: AUTO_DETECT_AVAILABLE,
    autoBackup,
    maxBackupsPerSlot,
    backupCounts,
    backupsVersion,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
    setAutoDetect: setAutoDetectValue,
    setAutoBackup,
    setMaxBackupsPerSlot: setMaxBackupsPerSlotValue,
    backupSlotNow,
    restoreBackup,
    notifyBackupsChanged,
  };
};
