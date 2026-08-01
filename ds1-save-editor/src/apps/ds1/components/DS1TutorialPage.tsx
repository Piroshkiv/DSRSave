import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';
import { t } from '../lib/i18n';
import { useLang } from '../../../core/context/LanguageContext';

// Use relative path for screenshots to work in both web and Electron
const getScreenshotPath = (filename: string) => {
  const isStatic = import.meta.env.MODE === 'static' || (typeof window !== 'undefined' && window.location.protocol === 'file:');
  return isStatic ? `screenshots/${filename}` : `/screenshots/${filename}`;
};

interface DS1TutorialPageProps {
  onClose?: () => void;
}

export const DS1TutorialPage: React.FC<DS1TutorialPageProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { lang } = useLang();

  const handleHome = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        title={t('tutorialTitle', lang)}
        showHomeButton
        onHome={handleHome}
        showGameNav={true}
      />

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>
          <section className="guide-section">
            <h2>{t('gettingStarted', lang)}</h2>
            <p>
              {t('welcomeText', lang)}
            </p>
          </section>

          <section className="guide-section">
            <h3>{t('step1Title', lang)}</h3>
            <p className="warning-box">
              ⚠️ <strong>{t('step1Important', lang)}</strong>
            </p>
            <p>
              {t('step1Text', lang)}
            </p>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen1.png')} alt="Dark Souls main menu" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>{t('step2Title', lang)}</h3>
            <p>
              {t('step2Text', lang)}
            </p>
            <p>
              {t('step2Loc', lang)}
            </p>
            <div className="code-block">
              <code>C:\Users\[YourUsername]\Documents\NBGI\DARK SOULS REMASTERED\[SteamID]\</code>
            </div>
            <p>
              {t('step2Look', lang)}
            </p>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen2.png')} alt="Load file button" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>{t('step3Title', lang)}</h3>
            <p className="warning-box">
              ⚠️ <strong>{t('step3Important', lang)}</strong>
            </p>
            <ol>
              <li>{t('step3Text', lang)}</li>
            </ol>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen3.png')} alt="Creating backup folder" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>{t('step4Title', lang)}</h3>
            <p>
              {t('step4Text', lang)}
            </p>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen4.png')} alt="Character selection" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>{t('step5Title', lang)}</h3>
            <p>
              {t('step5Text', lang)}
            </p>

            <h4>{t('generalTab', lang)}</h4>
            <p>
              {t('generalTabDesc', lang)}
            </p>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen5.png')} alt="General tab - character stats" className="tutorial-screenshot" />
            </div>

            <h4>{t('inventoryTab', lang)}</h4>
            <p>
              {t('inventoryTabDesc', lang)}
            </p>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen6.png')} alt="Inventory tab - items and equipment" className="tutorial-screenshot" />
            </div>

            <h4>{t('bonfiresTab', lang)}</h4>
            <p>
              {t('bonfiresTabDesc', lang)}
            </p>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen7.png')} alt="Bonfires tab - bonfire management" className="tutorial-screenshot" />
            </div>

            <h4>{t('npcsTab', lang)}</h4>
            <p>
              {t('npcsTabDesc', lang)}
            </p>
            <div className="screenshot-container">
              <img src={getScreenshotPath('screen8.png')} alt="NPCs tab - NPC and quest management" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>{t('step6Title', lang)}</h3>
            <p>
              {t('step6Text', lang)}
            </p>
          </section>

          <section className="guide-section">
            <h3>{t('step7Title', lang)}</h3>
            <p className="warning-box">
              ⚠️ <strong>{t('step7Important', lang)}</strong>
            </p>
            <p>
              {t('workflow', lang)}
            </p>
            <ol>
              <li>{t('wf1', lang)}</li>
              <li>{t('wf2', lang)}</li>
              <li>{t('wf3', lang)}</li>
              <li>{t('wf4', lang)}</li>
              <li>{t('wf5', lang)}</li>
              <li>{t('wf6', lang)}</li>
            </ol>
            <p>
              {t('wfNote', lang)}
            </p>
          </section>

          <section className="guide-section troubleshooting-section">
            <h3>{t('troubleshootingTitle', lang)}</h3>

            <div className="trouble-item">
              <h4>{t('cantFindSave', lang)}</h4>
              <ul>
                <li>{t('cantFindSaveTip1', lang)}</li>
                <li>{t('cantFindSaveTip2', lang)}</li>
                <li>{t('cantFindSaveTip3', lang)}</li>
                <li>{t('cantFindSaveTip4', lang)}</li>
              </ul>
            </div>

            <div className="trouble-item">
              <h4>{t('fileWontLoad', lang)}</h4>
              <ul>
                <li>{t('fileWontLoadTip1', lang)}</li>
                <li>{t('fileWontLoadTip2', lang)}</li>
                <li>{t('fileWontLoadTip3', lang)}</li>
              </ul>
            </div>

            <div className="trouble-item">
              <h4>{t('changesNotShowing', lang)}</h4>
              <ul>
                <li>{t('changesNotShowingTip1', lang)}</li>
                <li>{t('changesNotShowingTip2', lang)}</li>
                <li>{t('changesNotShowingTip3', lang)}</li>
                <li>{t('changesNotShowingTip4', lang)}</li>
              </ul>
            </div>
          </section>

          <section className="guide-section disclaimer-section">
            <h3>{t('importantReminders', lang)}</h3>
            <ul>
              <li>{t('notAffiliatedReminder', lang)}</li>
              <li>{t('useAtOwnRiskReminder', lang)}</li>
              <li>{t('alwaysMaintainBackups', lang)}</li>
              <li>{t('respectGame', lang)}</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3>{t('needHelp', lang)}</h3>
            <p>
              {t('needHelpText', lang)}
            </p>
            <div className="help-links">
              <a
                href="https://discord.gg/FZuCXNcUWA"
                target="_blank"
                rel="noopener noreferrer"
                className="help-link"
              >
                💬 Discord Community
              </a>
              <a
                href="https://www.nexusmods.com/darksoulsremastered/mods/1113"
                target="_blank"
                rel="noopener noreferrer"
                className="help-link"
              >
                📦 NexusMods Page
              </a>
            </div>
          </section>
        </div>

        <style>{`
          .guide-section {
            margin-bottom: 2.5rem;
          }

          .guide-section h2 {
            color: #ff6b35;
            font-size: 2rem;
            margin-bottom: 1rem;
            border-bottom: 2px solid #ff6b35;
            padding-bottom: 0.5rem;
          }

          .guide-section h3 {
            color: #ff6b35;
            font-size: 1.5rem;
            margin-bottom: 1rem;
            margin-top: 1.5rem;
          }

          .guide-section h4 {
            color: #ff8c5a;
            font-size: 1.2rem;
            margin-bottom: 0.5rem;
            margin-top: 1rem;
          }

          .guide-section p {
            margin-bottom: 1rem;
            color: rgba(255, 255, 255, 0.9);
          }

          .guide-section ol,
          .guide-section ul {
            margin: 1rem 0;
            padding-left: 1.5rem;
          }

          .guide-section li {
            margin-bottom: 0.75rem;
            color: rgba(255, 255, 255, 0.9);
          }

          .guide-section strong {
            color: #ff6b35;
          }

          .code-block {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-left: 4px solid #ff6b35;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
            overflow-x: auto;
          }

          .code-block code {
            color: #4fc3f7;
            font-family: 'Courier New', monospace;
            font-size: 0.95rem;
          }

          .warning-box {
            background: rgba(255, 152, 0, 0.1);
            border: 2px solid #ff9800;
            border-radius: 8px;
            padding: 1rem 1.5rem;
            margin: 1rem 0;
          }

          .screenshot-placeholder {
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.1) 0%, rgba(255, 107, 53, 0.05) 100%);
            border: 2px dashed rgba(255, 107, 53, 0.4);
            border-radius: 8px;
            padding: 3rem 2rem;
            margin: 1.5rem 0;
            text-align: center;
            transition: all 0.3s;
          }

          .screenshot-placeholder:hover {
            border-color: rgba(255, 107, 53, 0.6);
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(255, 107, 53, 0.08) 100%);
          }

          .placeholder-text {
            color: rgba(255, 255, 255, 0.6);
            font-size: 1.1rem;
            font-style: italic;
          }

          .screenshot-container {
            margin: 1.5rem 0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            border: 2px solid rgba(255, 107, 53, 0.3);
          }

          .tutorial-screenshot {
            width: 100%;
            height: auto;
            display: block;
          }

          .features-list li {
            padding-left: 0.5rem;
          }

          .tips-list li {
            margin-bottom: 1rem;
            padding-left: 0.5rem;
          }

          .troubleshooting-section {
            background: rgba(255, 152, 0, 0.05);
            border: 1px solid rgba(255, 152, 0, 0.2);
            border-radius: 8px;
            padding: 2rem;
          }

          .trouble-item {
            margin-bottom: 1.5rem;
          }

          .trouble-item:last-child {
            margin-bottom: 0;
          }

          .disclaimer-section {
            background: rgba(244, 67, 54, 0.1);
            border: 2px solid rgba(244, 67, 54, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
          }

          .disclaimer-section h3 {
            margin-top: 0;
          }

          .help-links {
            display: flex;
            gap: 1rem;
            margin: 1rem 0;
            flex-wrap: wrap;
          }

          .help-link {
            display: inline-flex;
            align-items: center;
            padding: 0.75rem 1.5rem;
            background: rgba(255, 107, 53, 0.1);
            border: 2px solid #ff6b35;
            border-radius: 8px;
            color: #ff6b35;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.2s;
          }

          .help-link:hover {
            background: rgba(255, 107, 53, 0.2);
            transform: translateY(-2px);
          }

          @media (max-width: 768px) {
            .guide-section h2 {
              font-size: 1.6rem;
            }

            .guide-section h3 {
              font-size: 1.3rem;
            }

            .help-links {
              flex-direction: column;
            }
          }
        `}</style>
      </div>

      <Footer />
    </div>
  );
};
