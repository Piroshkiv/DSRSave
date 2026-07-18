import { useState, useCallback, useEffect, useRef } from 'react';
import { SaveFileEditor } from '../lib/SaveFileEditor';
import { SaveFileEditorNintendo, detectPlatform } from '../lib/SaveFileEditorNintendo';
import { SaveFileEditorPS4 } from '../lib/SaveFileEditorPS4';
import { Character } from '../lib/Character';
import { FileHandle, getFileSystemAdapter, detectEnvironment } from '../lib/adapters';
import { getFilePathFromHandle, extractFilename } from '../lib/filePathUtils';

type SaveEditor = SaveFileEditor | SaveFileEditorNintendo | SaveFileEditorPS4;

// Auto-detect works reliably only in Tauri (web FileSystemObserver/permissions are flaky)
const AUTO_DETECT_AVAILABLE = detectEnvironment() === 'tauri';

export interface UseDS1SaveEditorResult {
  saveEditor: SaveEditor | null;
  characters: Character[];
  selectedCharacterIndex: number | null;
  originalFilename: string;
  platform: 'pc' | 'nintendo' | 'ps4' | 'unknown';
  autoDetect: boolean;
  autoDetectAvailable: boolean;

  handleFileLoaded: (file: File, fileHandle: FileHandle | null, opts?: { preserveSelection?: boolean }) => Promise<void>;
  handleCharacterSelect: (index: number) => void;
  handleCharacterUpdate: () => void;
  handleSave: () => Promise<void>;
  handleSaveAs: () => Promise<void>;
  handleReload: () => Promise<void>;
  setAutoDetect: (value: boolean) => void;
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
      // On reload keep the current selection as long as that slot still has a character
      setSelectedCharacterIndex(prev =>
        opts?.preserveSelection && prev !== null && displayedCharacters[prev] && !displayedCharacters[prev].isEmpty
          ? prev
          : (firstNonEmptyIndex !== -1 ? firstNonEmptyIndex : null)
      );
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
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Error saving file. Please try again.');
    }
  }, [saveEditor, originalFilename]);

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

  const setAutoDetectValue = useCallback((value: boolean) => {
    setAutoDetect(value);
  }, []);

  return {
    saveEditor,
    characters,
    selectedCharacterIndex,
    originalFilename,
    platform,
    autoDetect,
    autoDetectAvailable: AUTO_DETECT_AVAILABLE,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
    setAutoDetect: setAutoDetectValue,
  };
};
