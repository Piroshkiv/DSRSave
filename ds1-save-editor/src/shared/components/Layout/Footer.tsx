import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Footer.css';

interface FooterProps {
  onTermsClick?: () => void;
  onAboutClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onTermsClick, onAboutClick }) => {
  const navigate = useNavigate();

  // Detect if running in Electron
  const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';

  const handleAbout = () => {
    if (onAboutClick) {
      onAboutClick();
    } else {
      navigate('/about');
    }
  };

  const handleTerms = () => {
    if (onTermsClick) {
      onTermsClick();
    } else {
      navigate('/terms');
    }
  };

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-contacts-single">
          <button onClick={handleAbout} className="terms-link">
            <span className="contact-icon">ℹ️</span>
            <span>About</span>
          </button>
          <span className="separator">•</span>
          <button onClick={handleTerms} className="terms-link">
            <span className="contact-icon">📜</span>
            <span>Terms</span>
          </button>
          <span className="separator">•</span>
          {isElectron && (
            <>
              <a
                href="https://dsrsaveeditor.pages.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-link"
              >
                <span className="contact-icon">🌐</span>
                <span>Website</span>
              </a>
              <span className="separator">•</span>
            </>
          )}
          <a
            href="https://www.nexusmods.com/darksoulsremastered/mods/1113"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link"
          >
            <span className="contact-icon">📦</span>
            <span>NexusMods</span>
          </a>
          <span className="separator">•</span>
          <a
            href="https://discord.gg/FZuCXNcUWA"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link"
          >
            <span className="contact-icon">💬</span>
            <span>Discord</span>
          </a>
          <span className="separator">•</span>
          <a href="mailto:laim0999716349@gmail.com" className="contact-link">
            <span className="contact-icon">✉</span>
            <span>Contact</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
