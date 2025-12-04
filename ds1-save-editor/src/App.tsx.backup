import { useState } from 'react';
import { SaveFileEditor } from './lib/SaveFileEditor';
import { Character } from './lib/Character';
import { FileUpload } from './components/FileUpload';
import { CharacterList } from './components/CharacterList';
import { TabPanel } from './components/TabPanel';
import { TermsPage } from './components/TermsPage';
import { FileHandle } from './lib/adapters';
import logoImg from '/logo.png';
import './App.css';

function App() {
  const [saveEditor, setSaveEditor] = useState<SaveFileEditor | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState<number | null>(null);
  const [, setUpdateTrigger] = useState(0);
  const [originalFilename, setOriginalFilename] = useState<string>('DRAKS0005.sl2');
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleFileLoaded = async (file: File, fileHandle: FileHandle | null) => {
    try {
      setOriginalFilename(file.name);

      // Use new fromFileData method that accepts both file and handle
      const editor = await SaveFileEditor.fromFileData(file, fileHandle);

      setSaveEditor(editor);
      // Only show first 10 character slots (0-9), slot 10 is for settings
      const allCharacters = editor.getCharacters();
      const displayedCharacters = allCharacters.slice(0, 10);
      setCharacters(displayedCharacters);

      // Auto-select first non-empty slot
      const firstNonEmptyIndex = displayedCharacters.findIndex(char => !char.isEmpty);
      setSelectedCharacterIndex(firstNonEmptyIndex !== -1 ? firstNonEmptyIndex : null);
    } catch (error) {
      console.error('Error loading save file:', error);
      alert('Error loading save file. Please make sure it is a valid Dark Souls save file.');
    }
  };

  const handleCharacterSelect = (index: number) => {
    setSelectedCharacterIndex(index);
  };

  const handleCharacterUpdate = () => {
    setUpdateTrigger(prev => prev + 1);
  };

  const handleSave = async () => {
    if (!saveEditor) return;

    try {
      // Trigger one final update to recalculate stats if needed
      setUpdateTrigger(prev => prev + 1);

      if (saveEditor.hasFileHandle()) {
        // Save to original file using File System Access API
        await saveEditor.saveToOriginalFile();
        alert('Save file updated successfully!');
      } else {
        // Fallback: download with original filename
        await saveEditor.downloadSaveFile(originalFilename);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Error saving file. Please try again.');
    }
  };

  const handleSaveAs = async () => {
    if (!saveEditor) return;

    try {
      // Use File System Access API to pick new location
      const editedFilename = `edited_${originalFilename}`;
      await saveEditor.saveToNewFile(editedFilename);
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Error saving file. Please try again.');
    }
  };

  const handleReload = async () => {
    if (!saveEditor) return;

    try {
      if (saveEditor.hasFileHandle()) {
        const fileHandle = saveEditor.getFileHandle();
        if (fileHandle) {
          // Use adapter to reload the file
          const adapter = (await import('./lib/adapters')).getFileSystemAdapter();

          // For WebFS adapter, we can read the file from the handle
          // For Tauri adapter, we read from the stored path
          // The adapter handles this internally based on handle type

          // We need to load the file again using the adapter
          // Since we can't directly read from an abstract FileHandle,
          // we'll need to use loadLastFile which will get the cached handle
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
  };

  const selectedCharacter = selectedCharacterIndex !== null
    ? characters[selectedCharacterIndex]
    : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <img src={logoImg} alt="Dark Souls" className="header-icon" />
          Dark Souls Save Editor
        </h1>
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <FileUpload
            onFileLoaded={handleFileLoaded}
            onAutoLoadAttempt={setIsAutoLoading}
          />
          {isAutoLoading && (
            <div className="loading-indicator">
              Loading last save file...
            </div>
          )}
          {characters.length > 0 && (
            <CharacterList
              characters={characters}
              selectedIndex={selectedCharacterIndex}
              onSelectCharacter={handleCharacterSelect}
            />
          )}
        </aside>

        <main className="main-content">
          <TabPanel
            character={selectedCharacter}
            onCharacterUpdate={handleCharacterUpdate}
            onReload={handleReload}
          />

          {saveEditor && (
            <div className="action-buttons">
              <button className="save-button" onClick={handleSave}>
                Save
              </button>
              <button className="save-button" onClick={handleSaveAs}>
                Save As
              </button>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-contacts-single">
            <button onClick={() => setShowTerms(true)} className="terms-link">
              <span className="contact-icon">📜</span>
              <span>Terms of Use</span>
            </button>
            <span className="separator">•</span>
            <span className="footer-label">Contact:</span>
            <a href="mailto:laim0999716349@gmail.com" className="contact-link">
              <span className="contact-icon">✉</span>
              <span>laim0999716349@gmail.com</span>
            </a>
            <span className="separator">•</span>
            <a href="https://discord.gg/FZuCXNcUWA" target="_blank" rel="noopener noreferrer" className="contact-link">
              <span className="contact-icon">💬</span>
              <span>Discord Community</span>
            </a>
          </div>
        </div>
      </footer>

      {showTerms && <TermsPage onClose={() => setShowTerms(false)} />}
    </div>
  );
}

export default App;
