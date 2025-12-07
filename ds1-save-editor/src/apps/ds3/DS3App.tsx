import { useState, useRef } from 'react';
import { AppLayout } from '../../shared/components/Layout';
import { FileActions } from '../../shared/components/FileSystem';
import { FileUpload, CharacterList, TabPanel, SaveWarningModal, type FileUploadRef } from './components';
import { useDS3SaveEditor } from './hooks';

// Use relative path for logo to work in both web and Electron
const logoImg = (import.meta.env.MODE === 'static' || typeof window !== 'undefined' && window.location.protocol === 'file:')
  ? 'ds3logo.png'
  : '/ds3logo.png';

interface DS3AppProps {
  onHome?: () => void;
}

export const DS3App: React.FC<DS3AppProps> = ({ onHome }) => {
  const fileUploadRef = useRef<FileUploadRef>(null);
  const [showSaveWarning, setShowSaveWarning] = useState(false);

  const {
    saveEditor,
    characters,
    selectedCharacterIndex,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
  } = useDS3SaveEditor(fileUploadRef);

  const [isAutoLoading, setIsAutoLoading] = useState(false);

  const handleSaveAsClick = () => {
    // Check if we've shown the warning before
    const hasShownWarning = localStorage.getItem('ds3-save-as-warning-shown');

    if (!hasShownWarning) {
      setShowSaveWarning(true);
    } else {
      handleSaveAs();
    }
  };

  const handleWarningConfirm = () => {
    localStorage.setItem('ds3-save-as-warning-shown', 'true');
    setShowSaveWarning(false);
    handleSaveAs();
  };

  const selectedCharacter = selectedCharacterIndex !== null
    ? characters[selectedCharacterIndex]
    : null;

  const sidebar = (
    <>
      <FileUpload
        ref={fileUploadRef}
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
    </>
  );

  return (
    <AppLayout
      title="Dark Souls 3 Save Editor"
      icon={logoImg}
      showHomeButton={!!onHome}
      onHome={onHome}
      sidebar={sidebar}
      showTutorialButton={false}
      showGameNav={true}
      currentGame="ds3"
    >
      <TabPanel
        character={selectedCharacter}
        onCharacterUpdate={handleCharacterUpdate}
        onReload={handleReload}
      />

      {saveEditor && (
        <FileActions
          onSave={handleSave}
          onSaveAs={handleSaveAsClick}
          onReload={handleReload}
          disabled={false}
          disableSave={true}
        />
      )}

      <SaveWarningModal
        isOpen={showSaveWarning}
        onConfirm={handleWarningConfirm}
      />
    </AppLayout>
  );
};
