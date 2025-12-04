import { useState } from 'react';
import { AppLayout } from '../../shared/components/Layout';
import { FileActions } from '../../shared/components/FileSystem';
import { FileUpload, CharacterList, TabPanel, TermsPage } from './components';
import { useDS1SaveEditor } from './hooks';
import { MetaTags } from '../../core/MetaTags';
import logoImg from '/logo.png';

interface DS1AppProps {
  onHome?: () => void;
}

export const DS1App: React.FC<DS1AppProps> = ({ onHome }) => {
  const {
    saveEditor,
    characters,
    selectedCharacterIndex,
    isAutoLoading,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
  } = useDS1SaveEditor();

  const [showTerms, setShowTerms] = useState(false);
  const [, setIsAutoLoading] = useState(false);

  const selectedCharacter = selectedCharacterIndex !== null
    ? characters[selectedCharacterIndex]
    : null;

  const sidebar = (
    <>
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
    </>
  );

  return (
    <>
      <MetaTags
        title="Dark Souls Remastered Save Editor - DSR/DS1 Online Editor"
        description="Free online Dark Souls Remastered (DSR) save editor. Edit stats, level, humanity, inventory, and character data directly in your browser. No download required."
        keywords="dark souls save editor, dark souls 1 save editor, dsr save editor, ds1 save editor online, dark souls remastered save editor, dark souls character editor, dark souls stats editor, dark souls inventory editor, ptde save editor, dark souls editor online, save editor dark souls, ds1 editor, dark souls 1 editor, ds remastered editor"
        ogTitle="Dark Souls Remastered Save Editor (DSR) — Online"
        ogDescription="Free online Dark Souls Remastered (DSR) save editor. Edit stats, level, humanity, inventory, and character data directly in your browser."
        canonical="https://dsrsaveeditor.pages.dev/ds1"
      />
      <AppLayout
        title="Dark Souls Save Editor"
        icon={logoImg}
        showHomeButton={!!onHome}
        onHome={onHome}
        sidebar={sidebar}
        onTermsClick={() => setShowTerms(true)}
      >
        <TabPanel
          character={selectedCharacter}
          onCharacterUpdate={handleCharacterUpdate}
          onReload={handleReload}
        />

        {saveEditor && (
          <FileActions
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onReload={handleReload}
          />
        )}
      </AppLayout>

      {showTerms && <TermsPage onClose={() => setShowTerms(false)} />}
    </>
  );
};
