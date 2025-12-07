import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../shared/components/Layout';
import { FileActions } from '../../shared/components/FileSystem';
import { FileUpload, CharacterList, TabPanel, TermsPage, AboutPage } from './components';
import { useDS1SaveEditor } from './hooks';
import { MetaTags } from '../../core/MetaTags';

// Use relative path for logo to work in both web and Electron
const logoImg = (import.meta.env.MODE === 'static' || typeof window !== 'undefined' && window.location.protocol === 'file:')
  ? 'logo.png'
  : '/logo.png';

interface DS1AppProps {
  onHome?: () => void;
}

export const DS1App: React.FC<DS1AppProps> = ({ onHome }) => {
  const navigate = useNavigate();
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
  } = useDS1SaveEditor();

  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);

  const handleTutorial = () => {
    navigate('/ds1/tutorial');
  };

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
        structuredData={[{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "DSR Save Editor",
          "alternateName": ["Dark Souls Save Editor", "DS1 Save Editor", "Dark Souls Remastered Save Editor", "Dark Souls Character Editor"],
          "applicationCategory": "GameApplication",
          "operatingSystem": "Web Browser",
          "browserRequirements": "Requires JavaScript. Works with Chrome, Firefox, Safari, Edge.",
          "image": "https://dsrsaveeditor.pages.dev/logo.png",
          "screenshot": "https://dsrsaveeditor.pages.dev/screenshot.png",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "description": "Free online save editor for Dark Souls Remastered (DSR). Edit character stats, soul level, humanity, inventory, equipment, and more directly in your browser without any installation.",
          "url": "https://dsrsaveeditor.pages.dev/ds1",
          "author": {
            "@type": "Organization",
            "name": "Souls Save Editor Team"
          },
          "featureList": [
            "Edit character stats: Vitality, Attunement, Endurance, Strength, Dexterity, Resistance, Intelligence, Faith",
            "Modify soul level, souls, and humanity count",
            "Edit inventory items, weapons, armor, and equipment",
            "Unlock bonfires and warp points",
            "Support for Dark Souls Remastered (DSR)",
            "Browser-based editor - no installation or download required",
            "100% free and open source",
            "Works offline after initial load",
            "Safe editing with backup functionality"
          ],
          "keywords": "Dark Souls, DS1, DSR, Dark Souls Remastered, PTDE, save editor, game save editor, character editor, stats editor, inventory editor, online save editor",
          "softwareVersion": "2.0",
          "datePublished": "2024-01-01"
        }, {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Does this work with Dark Souls Remastered?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, this save editor is designed specifically for Dark Souls Remastered (DSR) save files (.sl2 format)."
              }
            },
            {
              "@type": "Question",
              "name": "Can I edit PTDE (Prepare to Die Edition) saves?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The editor is optimized for Dark Souls Remastered, but may work with PTDE saves as they share similar formats."
              }
            },
            {
              "@type": "Question",
              "name": "Is this save editor free?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, this is a completely free online tool. No registration, payment, or download required."
              }
            },
            {
              "@type": "Question",
              "name": "Do I need to download anything?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "No, this is a browser-based save editor. Everything works directly in your web browser without any installation."
              }
            }
          ]
        }]}
      />
      <AppLayout
        title="Dark Souls Save Editor"
        icon={logoImg}
        showHomeButton={!!onHome}
        onHome={onHome}
        sidebar={sidebar}
        onTermsClick={() => setShowTerms(true)}
        onAboutClick={() => setShowAbout(true)}
        showTutorialButton={true}
        onTutorial={handleTutorial}
        showGameNav={true}
        currentGame="ds1"
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
      {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
    </>
  );
};
