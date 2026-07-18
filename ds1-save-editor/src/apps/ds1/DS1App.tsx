import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../shared/components/Layout';
import { FileUpload, CharacterList, TabPanel, TermsPage, AboutPage } from './components';
import { useDS1SaveEditor } from './hooks';
import { MetaTags } from '../../core/MetaTags';
import { extractFilename } from './lib/filePathUtils';
import { useLang } from '../../core/context/LanguageContext';
import { t, Lang } from './lib/i18n';

const logoImg = (import.meta.env.MODE === 'static' || typeof window !== 'undefined' && window.location.protocol === 'file:')
  ? 'logo.png'
  : '/logo.png';

interface DS1AppProps {
  onHome?: () => void;
}

function useTimeAgo(date: Date | null, lang: Lang): string {
  const [label, setLabel] = useState('');

  const compute = useCallback(() => {
    if (!date) return '';
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60) return t('loadedJustNow', lang);
    const mins = Math.floor(secs / 60);
    if (mins < 60) return t('loadedMinAgo', lang).replace('{n}', String(mins));
    const hours = Math.floor(mins / 60);
    return hours > 1
      ? t('loadedHoursAgo', lang).replace('{n}', String(hours))
      : t('loadedHourAgo', lang).replace('{n}', String(hours));
  }, [date, lang]);

  useEffect(() => {
    if (!date) { setLabel(''); return; }
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 30_000);
    return () => clearInterval(id);
  }, [date, compute]);

  return label;
}

export const DS1App: React.FC<DS1AppProps> = ({ onHome }) => {
  const navigate = useNavigate();
  const { lang } = useLang();
  const {
    saveEditor,
    characters,
    selectedCharacterIndex,
    originalFilename,
    platform,
    autoDetect,
    autoDetectAvailable,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
    setAutoDetect,
  } = useDS1SaveEditor();

  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const timeAgo = useTimeAgo(loadedAt, lang);

  useEffect(() => {
    if (saveEditor) setLoadedAt(new Date());
  }, [saveEditor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (import.meta.env.DEV && e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        navigate('/ds1/save-watcher');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const handleTutorial = () => navigate('/ds1/tutorial');

  const selectedCharacter = selectedCharacterIndex !== null
    ? characters[selectedCharacterIndex]
    : null;

  const filename = saveEditor ? extractFilename(originalFilename) : '';

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
      <CharacterList
        characters={characters}
        selectedIndex={selectedCharacterIndex}
        onSelectCharacter={handleCharacterSelect}
        platform={saveEditor ? platform : null}
      />
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
        title="Dark Souls Save Editor Online"
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
        {saveEditor && (
          <div className="ds1-subheader">
            <div className="ds1-subheader-info">
              <span className="ds1-filename">{filename}</span>
              {timeAgo && <span className="ds1-loaded-label">{timeAgo}</span>}
            </div>
            <div className="ds1-subheader-actions">
              <button className="ds1-action-btn" onClick={handleReload}>
                ⟳ {t('reload', lang)}
              </button>
              {autoDetectAvailable && (
                <button
                  className="ds1-safemode-btn"
                  onClick={() => setAutoDetect(!autoDetect)}
                  title={t('autoDetectChangesTitle', lang)}
                >
                  <span className={`ds1-safemode-dot ${autoDetect ? 'on' : 'off'}`}>●</span>
                  {t('autoDetectChanges', lang)}
                  <span className={`ds1-safemode-badge ${autoDetect ? 'on' : 'off'}`}>
                    {autoDetect ? t('on', lang) : t('off', lang)}
                  </span>
                </button>
              )}
              <button
                className="ds1-safemode-btn"
                onClick={() => setSafeMode(v => !v)}
                title={t('safeModeTitle', lang)}
              >
                <span className={`ds1-safemode-dot ${safeMode ? 'on' : 'off'}`}>●</span>
                {t('safeMode', lang)}
                <span className={`ds1-safemode-badge ${safeMode ? 'on' : 'off'}`}>
                  {safeMode ? t('on', lang) : t('off', lang)}
                </span>
              </button>
              <button className="ds1-action-btn" onClick={handleSave}>
                {t('save', lang)}
              </button>
              <button className="ds1-action-btn" onClick={handleSaveAs}>
                {t('saveAs', lang)}
              </button>
            </div>
          </div>
        )}

        <TabPanel
          character={selectedCharacter}
          onCharacterUpdate={handleCharacterUpdate}
          safeMode={safeMode}
        />
      </AppLayout>

      {showTerms && <TermsPage onClose={() => setShowTerms(false)} />}
      {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
    </>
  );
};
