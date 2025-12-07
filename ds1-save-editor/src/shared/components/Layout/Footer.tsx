import React from 'react';
import './Footer.css';

interface FooterProps {
  onTermsClick?: () => void;
  onAboutClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onTermsClick, onAboutClick }) => {
  // Detect if running in Electron
  const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-contacts-single">
          {onAboutClick ? (
            <button onClick={onAboutClick} className="footer-link-button">
              <span className="contact-icon">ℹ️</span>
              About
            </button>
          ) : (
            <a href="/about" className="footer-link">
              <span className="contact-icon">ℹ️</span>
              About
            </a>
          )}
          <span className="separator"></span>
          {onTermsClick ? (
            <button onClick={onTermsClick} className="footer-link-button">
              <span className="contact-icon">📜</span>
              Terms
            </button>
          ) : (
            <a href="/terms" className="footer-link">
              <span className="contact-icon">📜</span>
              Terms
            </a>
          )}
          <span className="separator"></span>
          {isElectron && (
            <>
              <a
                href="https://dsrsaveeditor.pages.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-link"
              >
                <span className="contact-icon">🌐</span>
                Website
              </a>
              <span className="separator"></span>
            </>
          )}
          <a
            href="https://www.nexusmods.com/darksoulsremastered/mods/1113"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link"
          >
            <span className="contact-icon">📦</span>
            NexusMods
          </a>
          <span className="separator"></span>
          <a
            href="https://discord.gg/FZuCXNcUWA"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link"
          >
            <span className="contact-icon">💬</span>
            Discord
          </a>
          <span className="separator"></span>
          <a href="mailto:laim0999716349@gmail.com" className="contact-link">
            <span className="contact-icon">✉</span>
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
};
