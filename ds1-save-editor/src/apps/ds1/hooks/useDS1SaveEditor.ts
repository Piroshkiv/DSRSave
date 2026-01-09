import { useState, useCallback } from 'react';
import { SaveFileEditor } from '../lib/SaveFileEditor';
import { Character } from '../lib/Character';
import { FileHandle, getFileSystemAdapter } from '../lib/adapters';
import { getFilePathFromHandle, extractFilename } from '../lib/filePathUtils';

export interface UseDS1SaveEditorResult {
  saveEditor: SaveFileEditor | null;
  characters: Character[];
  selectedCharacterIndex: number | null;
  originalFilename: string;

  handleFileLoaded: (file: File, fileHandle: FileHandle | null) => Promise<void>;
  handleCharacterSelect: (index: number) => void;
  handleCharacterUpdate: () => void;
  handleSave: () => Promise<void>;
  handleSaveAs: () => Promise<void>;
  handleReload: () => Promise<void>;
}

export const useDS1SaveEditor = (): UseDS1SaveEditorResult => {
  const [saveEditor, setSaveEditor] = useState<SaveFileEditor | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState<number | null>(null);
  const [, setUpdateTrigger] = useState(0);
  const [originalFilename, setOriginalFilename] = useState<string>('DRAKS0005.sl2');

  const handleFileLoaded = useCallback(async (file: File, fileHandle: FileHandle | null) => {
    try {
      const filePath = await getFilePathFromHandle(
        file,
        fileHandle as FileSystemFileHandle | null
      );
      setOriginalFilename(filePath);

      const editor = await SaveFileEditor.fromFileData(file, fileHandle);

      setSaveEditor(editor);
      const allCharacters = editor.getCharacters();
      const displayedCharacters = allCharacters.slice(0, 10);
      setCharacters(displayedCharacters);

      const firstNonEmptyIndex = displayedCharacters.findIndex(char => !char.isEmpty);
      setSelectedCharacterIndex(firstNonEmptyIndex !== -1 ? firstNonEmptyIndex : null);
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
          const adapter = getFileSystemAdapter();
          const fileData = await adapter.loadLastFile();

          if (fileData) {
            await handleFileLoaded(fileData.file, fileData.handle);
          } else {
            alert('Cannot reload: unable to access the file. Please load the file again.');
          }
        }
      } else {
        alert('Cannot reload: no file handle available. Please load the file again.');
      }
    } catch (error) {
      console.error('Error reloading file:', error);
      alert('Error reloading file. Please try again.');
    }
  }, [saveEditor, handleFileLoaded]);

  return {
    saveEditor,
    characters,
    selectedCharacterIndex,
    originalFilename,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
  };
};
