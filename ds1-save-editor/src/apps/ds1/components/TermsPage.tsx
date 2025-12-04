import React from 'react';

interface TermsPageProps {
  onClose: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onClose }) => {
  return (
    <div className="terms-page-overlay">
      <div className="terms-page">
        <div className="terms-page-header">
          <h1>Terms of Use</h1>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="terms-page-content">
          <section>
            <h2>Disclaimer</h2>
            <p>
              This tool is provided <strong>as-is</strong> for educational and personal use purposes only.
              The developers make no warranties, express or implied, regarding the functionality,
              reliability, or suitability of this software for any particular purpose.
            </p>
          </section>

          <section>
            <h2>Use at Your Own Risk</h2>
            <p>
              By using this save editor, you acknowledge and accept that:
            </p>
            <ul>
              <li>Modifying save files may result in data corruption or loss</li>
              <li>Using modified saves may affect your game experience</li>
              <li>Online play with modified saves may violate game terms of service</li>
              <li>You are solely responsible for backing up your original save files</li>
              <li>The developers are not liable for any damages or losses resulting from the use of this tool</li>
            </ul>
          </section>

          <section>
            <h2>Recommendations</h2>
            <ul>
              <li><strong>Always backup your save files</strong> before making any modifications</li>
              <li>Use the "Safe mod" feature to prevent invalid character configurations</li>
              <li>Test modified saves in offline mode first</li>
              <li>Be aware that some modifications may be detectable by anti-cheat systems</li>
            </ul>
          </section>

          <section>
            <h2>Support</h2>
            <p>
              This is a community-developed tool. For questions, bug reports, or feature requests,
              please contact us through the provided channels in the footer.
            </p>
          </section>

          <div className="terms-footer">
            <button className="close-button-bottom" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};
