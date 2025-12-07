import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';

interface DS1TutorialPageProps {
  onClose?: () => void;
}

export const DS1TutorialPage: React.FC<DS1TutorialPageProps> = ({ onClose }) => {
  const navigate = useNavigate();

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
        title="Dark Souls Remastered - Tutorial"
        showHomeButton
        onHome={handleHome}
        showGameNav={true}
      />

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>
          <section className="guide-section">
            <h2>Getting Started</h2>
            <p>
              Welcome to the DS Save Editor! This guide will walk you through the process of editing
              your Dark Souls save files safely and effectively.
            </p>
          </section>

          <section className="guide-section">
            <h3>Step 1: Exit to Main Menu</h3>
            <p className="warning-box">
              ⚠️ <strong>IMPORTANT:</strong> Exit to the main menu in Dark Souls before using the save editor. Otherwise, your changes won't be saved!
            </p>
            <p>
              Make sure you're at the main menu screen (not in-game) before proceeding.
            </p>
            <div className="screenshot-container">
              <img src="/screenshots/screen1.png" alt="Dark Souls main menu" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>Step 2: Load Your Save File</h3>
            <p>
              Click the <strong>"Load File"</strong> button and select your Dark Souls save file.
            </p>
            <p>
              Dark Souls Remastered save files are typically located at:
            </p>
            <div className="code-block">
              <code>C:\Users\[YourUsername]\Documents\NBGI\DARK SOULS REMASTERED\[SteamID]\</code>
            </div>
            <p>
              Look for files with the <strong>.sl2</strong> extension, usually named <code>DRAKS0005.sl2</code>.
            </p>
            <div className="screenshot-container">
              <img src="/screenshots/screen2.png" alt="Load file button" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>Step 3: Create a Backup (Optional but Highly Recommended)</h3>
            <p className="warning-box">
              ⚠️ <strong>HIGHLY RECOMMENDED:</strong> Always create a backup of your save file before editing!
            </p>
            <ol>
              <li>Create a new folder for backups (e.g., "Dark Souls Backups")</li>
              <li>Copy your <code>.sl2</code> file to this folder</li>
              <li>Optionally rename it with a date (e.g., <code>DRAKS0005_2024-01-15.sl2</code>)</li>
            </ol>
            <div className="screenshot-container">
              <img src="/screenshots/screen3.png" alt="Creating backup folder" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>Step 4: Select Your Character</h3>
            <p>
              After loading your save file, you'll see a list of all characters. Click on the character you want to edit.
            </p>
            <div className="screenshot-container">
              <img src="/screenshots/screen4.png" alt="Character selection" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>Step 5: Edit Your Character</h3>
            <p>
              The editor provides several tabs for different aspects of your character. Each tab focuses on specific aspects of your save file.
            </p>

            <h4>General Tab</h4>
            <p>
              The General tab allows you to edit your character's core stats and attributes:
            </p>
            <ul className="features-list">
              <li><strong>Stats:</strong> Modify Vitality, Attunement, Endurance, Strength, Dexterity, Resistance, Intelligence, and Faith</li>
              <li><strong>Soul Level:</strong> Change your character's overall level</li>
              <li><strong>Souls:</strong> Set the amount of souls you currently have</li>
              <li><strong>Humanity:</strong> Adjust your humanity counter</li>
              <li><strong>Name & Class:</strong> Edit your character's name and starting class</li>
            </ul>
            <div className="screenshot-container">
              <img src="/screenshots/screen5.png" alt="General tab - character stats" className="tutorial-screenshot" />
            </div>

            <h4>Inventory Tab</h4>
            <p>
              The Inventory tab lets you add, modify, or remove all types of items:
            </p>
            <ul className="features-list">
              <li><strong>Weapons:</strong> Swords, axes, spears, bows, catalysts, talismans, and shields</li>
              <li><strong>Armor:</strong> Helmets, chest armor, gauntlets, and leggings</li>
              <li><strong>Rings:</strong> All rings in the game</li>
              <li><strong>Consumables:</strong> Estus Flask, humanity items, resins, mosses</li>
              <li><strong>Upgrade Materials:</strong> Titanite shards, chunks, slabs, twinkling titanite, dragon scales</li>
              <li><strong>Key Items:</strong> Quest items, keys, covenant items</li>
              <li><strong>Spells:</strong> Sorceries, pyromancies, and miracles</li>
              <li><strong>Weapon Memory:</strong> You can recalibrate weapon memory if all weapons are lower level than current weapon memory capacity</li>
            </ul>
            <div className="screenshot-container">
              <img src="/screenshots/screen6.png" alt="Inventory tab - items and equipment" className="tutorial-screenshot" />
            </div>

            <h4>Bonfires Tab</h4>
            <p>
              The Bonfires tab allows you to unlock bonfires:
            </p>
            <ul className="features-list">
              <li><strong>Unlock Bonfires:</strong> Instantly discover any bonfire in the game</li>
              <li>Simply check or uncheck bonfires to enable/disable them</li>
            </ul>
            <div className="screenshot-container">
              <img src="/screenshots/screen7.png" alt="Bonfires tab - bonfire management" className="tutorial-screenshot" />
            </div>

            <h4>NPCs & Bosses Tabs</h4>
            <p>
              These tabs allow you to modify NPC states and boss defeats:
            </p>
            <ul className="features-list">
              <li><strong>NPCs Tab:</strong> Change NPC states (alive, dead, hostile, quest progress)</li>
              <li><strong>Bosses Tab:</strong> Mark bosses as defeated or respawn them by unchecking</li>
            </ul>
            <div className="screenshot-container">
              <img src="/screenshots/screen8.png" alt="NPCs tab - NPC and quest management" className="tutorial-screenshot" />
            </div>
          </section>

          <section className="guide-section">
            <h3>Step 6: Save Your Changes</h3>
            <p>
              After making your edits, you have two save options:
            </p>
            <ul className="features-list">
              <li><strong>Save:</strong> Updates your current save file directly</li>
              <li><strong>Save As:</strong> Downloads the save file to your Downloads folder, allowing you to choose where to save it</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3>Step 7: Using Reload</h3>
            <p className="warning-box">
              ⚠️ <strong>IMPORTANT:</strong> Always click <strong>Reload</strong> after playing the game, or your edits will be overwritten!
            </p>
            <p>
              The correct workflow when making multiple edits:
            </p>
            <ol>
              <li>Make changes in the save editor</li>
              <li>Click <strong>Save</strong></li>
              <li>Play the game and do something (level up, get an item, etc.)</li>
              <li>Exit to main menu in Dark Souls</li>
              <li>Click <strong>Reload</strong> in the save editor to load the updated save</li>
              <li>Make more changes and repeat</li>
            </ol>
            <p>
              If you don't click Reload, the editor will still have the old save data in memory, and when you save again, it will overwrite any progress you made in-game.
            </p>
          </section>

          <section className="guide-section troubleshooting-section">
            <h3>Troubleshooting</h3>

            <div className="trouble-item">
              <h4>Can't Find My Save File</h4>
              <ul>
                <li>Check if your save is on a different drive (D:, E:, etc.)</li>
                <li>Make sure the path is <code>Documents\NBGI\</code> and NOT <code>Documents\FromSoftware\</code></li>
                <li>Verify you're looking in the correct Steam user folder (SteamID)</li>
                <li>Search your entire computer for <code>*.sl2</code> files</li>
              </ul>
            </div>

            <div className="trouble-item">
              <h4>File Won't Load</h4>
              <ul>
                <li>Make sure the file is a valid <code>.sl2</code> file</li>
                <li>Check that the file isn't corrupted (try loading it in the game first)</li>
                <li>Try using a different browser (Chrome, Firefox, Edge)</li>
              </ul>
            </div>

            <div className="trouble-item">
              <h4>Changes Aren't Showing In-Game</h4>
              <ul>
                <li>Make sure you exited to the main menu before saving changes</li>
                <li>Verify you edited the correct character slot</li>
                <li>Check that you're using the correct Steam account</li>
                <li>Ensure the save file is in the correct location for your current Steam user</li>
              </ul>
            </div>
          </section>

          <section className="guide-section disclaimer-section">
            <h3>⚠️ Important Reminders</h3>
            <ul>
              <li>This tool is not affiliated with FromSoftware or Bandai Namco</li>
              <li>Use at your own risk - we're not responsible for corrupted saves or bans</li>
              <li>Always maintain backups of your original save files</li>
              <li>Respect the game and other players when using edited saves online</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3>Need Help?</h3>
            <p>
              If you encounter issues or have questions, join our community:
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
