import { useState } from 'react';
import { SaveFileEditor } from './lib/SaveFileEditor';
import { Character } from './lib/Character';
import { FileUpload } from './components/FileUpload';
import { CharacterList } from './components/CharacterList';
import { TabPanel } from './components/TabPanel';
import { TermsPage } from './components/TermsPage';
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

  const handleFileLoaded = async (file: File, fileHandle?: FileSystemFileHandle) => {
    try {
      setOriginalFilename(file.name);

      // Use fromFileHandle if we have a file handle, otherwise fromFile
      const editor = fileHandle
        ? await SaveFileEditor.fromFileHandle(fileHandle)
        : await SaveFileEditor.fromFile(file);

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
        // Reload from the original file handle
        const fileHandle = saveEditor.getFileHandle();
        if (fileHandle) {
          const file = await fileHandle.getFile();
          await handleFileLoaded(file, fileHandle);
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
