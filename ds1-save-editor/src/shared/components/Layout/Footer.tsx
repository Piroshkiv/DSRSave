import React from 'react';
import './Footer.css';

interface FooterProps {
  onTermsClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onTermsClick }) => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-contacts-single">
          {onTermsClick && (
            <>
              <button onClick={onTermsClick} className="terms-link">
                <span className="contact-icon">📜</span>
                <span>Terms of Use</span>
              </button>
              <span className="separator">•</span>
            </>
          )}
          <span className="footer-label">Contact:</span>
          <a href="mailto:laim0999716349@gmail.com" className="contact-link">
            <span className="contact-icon">✉</span>
            <span>laim0999716349@gmail.com</span>
          </a>
          <span className="separator">•</span>
          <a
            href="https://discord.gg/FZuCXNcUWA"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link"
          >
            <span className="contact-icon">💬</span>
            <span>Discord Community</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
