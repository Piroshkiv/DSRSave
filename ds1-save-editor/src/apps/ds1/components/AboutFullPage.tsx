import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';

export const AboutFullPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        title="About DS Save Editor"
        showHomeButton
        onHome={() => navigate('/')}
        showGameNav={true}
      />

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>
          <section className="about-section">
            <h3>What is this?</h3>
            <p>
              DS Save Editor is a free, browser-based save file editor for Dark Souls series games.
              It allows you to modify your save files directly in your web browser without downloading
              or installing any software.
            </p>
            <p>
              Edit character stats, inventory, bonfires, NPCs, bosses, and more - all from the comfort
              of your browser with a clean, intuitive interface.
            </p>
          </section>

          <section className="about-section">
            <h3>How it works</h3>
            <p>
              The editor runs entirely in your browser using modern web technologies. Your save files
              never leave your computer - all editing happens locally on your device.
            </p>
            <ol className="how-it-works-list">
              <li><strong>Upload your save file</strong> (.sl2 format for Dark Souls Remastered)</li>
              <li><strong>Edit your character</strong> stats, inventory, bonfires, and more</li>
              <li><strong>Download the modified save</strong> and replace your original file</li>
            </ol>
            <p className="note">
              <strong>Note:</strong> Always backup your original save files before editing!
            </p>
          </section>

          <section className="about-section">
            <h3>Why this project?</h3>
            <p>
              Created by <strong>CWin</strong> in 2025, this project was born out of frustration with:
            </p>
            <ul>
              <li>Save editors hidden behind registration walls</li>
              <li>Download sites with 60+ second wait times</li>
              <li>Having to build projects from GitHub yourself</li>
            </ul>
            <p>
              The goal was simple: create a free, accessible, no-BS save editor that just works.
            </p>
          </section>

          <section className="about-section">
            <h3>Technology Stack</h3>
            <div className="tech-stack">
              <div className="tech-item">
                <strong>React</strong>
                <span>UI Framework</span>
              </div>
              <div className="tech-item">
                <strong>TypeScript</strong>
                <span>Type Safety</span>
              </div>
              <div className="tech-item">
                <strong>Vite</strong>
                <span>Build Tool</span>
              </div>
              <div className="tech-item">
                <strong>Web Crypto API</strong>
                <span>Save File Decryption</span>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h3>Open Source & Community</h3>
            <p>
              This project is completely free and open source. No ads, no tracking, no premium features.
            </p>
            <div className="links-section">
              <a
                href="https://dsrsaveeditor.pages.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                🌐 Website
              </a>
              <a
                href="https://www.nexusmods.com/darksoulsremastered/mods/1113"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                📦 NexusMods Page
              </a>
              <a
                href="https://discord.com/invite/FZuCXNcUWA"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                💬 Discord Community
              </a>
            </div>
            <p className="contribute-note">
              Found a bug or want to contribute? Join our Discord community!
            </p>
          </section>

          <section className="about-section">
            <h3>Supported Games</h3>
            <ul className="games-list">
              <li className="game-available">✅ Dark Souls Remastered (DS1/DSR)</li>
              <li className="game-coming">🔜 Dark Souls 3 (Coming Soon)</li>
              <li className="game-coming">🔜 Elden Ring (Coming Soon)</li>
            </ul>
          </section>

          <section className="about-section disclaimer-section">
            <h3>⚠️ Important Disclaimer</h3>
            <p>
              This is a community-made tool and is <strong>not affiliated with FromSoftware or Bandai Namco</strong>.
              Use at your own risk. Always backup your save files before editing.
            </p>
            <p>
              The developers are not responsible for any corrupted saves, bans, or other issues
              that may arise from using this tool.
            </p>
          </section>
        </div>

        <style>{`
          .about-section {
            margin-bottom: 2rem;
          }

          .about-section h3 {
            color: #ff6b35;
            margin-bottom: 1rem;
            font-size: 1.3rem;
          }

          .about-section p {
            margin-bottom: 1rem;
            color: rgba(255, 255, 255, 0.9);
          }

          .how-it-works-list {
            margin: 1rem 0;
            padding-left: 1.5rem;
          }

          .how-it-works-list li {
            margin-bottom: 0.75rem;
            color: rgba(255, 255, 255, 0.9);
          }

          .how-it-works-list strong {
            color: #ff6b35;
          }

          .note {
            background: rgba(255, 152, 0, 0.1);
            border-left: 4px solid #ff9800;
            padding: 0.75rem 1rem;
            border-radius: 4px;
            margin-top: 1rem;
          }

          .tech-stack {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
          }

          .tech-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #ff6b35;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .tech-item strong {
            color: #ff6b35;
            font-size: 1.1rem;
          }

          .tech-item span {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9rem;
          }

          .links-section {
            display: flex;
            gap: 1rem;
            margin: 1rem 0;
            flex-wrap: wrap;
          }

          .external-link {
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

          .external-link:hover {
            background: rgba(255, 107, 53, 0.2);
            transform: translateY(-2px);
          }

          .contribute-note {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
            font-style: italic;
          }

          .games-list {
            list-style: none;
            padding: 0;
          }

          .games-list li {
            padding: 0.75rem 1rem;
            margin-bottom: 0.5rem;
            border-radius: 4px;
          }

          .game-available {
            background: rgba(76, 175, 80, 0.1);
            border-left: 4px solid #4caf50;
          }

          .game-coming {
            background: rgba(255, 152, 0, 0.1);
            border-left: 4px solid #ff9800;
            color: rgba(255, 255, 255, 0.7);
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

          @media (max-width: 768px) {
            .tech-stack {
              grid-template-columns: 1fr;
            }

            .links-section {
              flex-direction: column;
            }
          }
        `}</style>
      </div>

      <Footer />
    </div>
  );
};
