import React from 'react';

interface TermsPageProps {
  onClose: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Terms of Use</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <section className="terms-section">
            <h3>⚠️ Use at Your Own Risk</h3>
            <p>
              This tool is provided <strong>AS-IS</strong> without any warranties. By using this
              save editor, you accept all risks associated with modifying your game saves.
            </p>
          </section>

          <section className="terms-section">
            <h3>What You Need to Know</h3>
            <ul>
              <li>Save file modifications may cause <strong>data corruption</strong></li>
              <li>Modified saves may be <strong>detectable by anti-cheat systems</strong></li>
              <li>Using modified saves online may violate <strong>game Terms of Service</strong></li>
              <li><strong>Always backup</strong> your original save files before editing</li>
            </ul>
          </section>

          <section className="terms-section">
            <h3>No Liability</h3>
            <p>
              The developers are <strong>not responsible</strong> for:
            </p>
            <ul>
              <li>Corrupted or lost save files</li>
              <li>Game bans or account suspensions</li>
              <li>Any other issues arising from using this tool</li>
            </ul>
          </section>

          <section className="terms-section disclaimer-box">
            <p>
              <strong>Not affiliated with FromSoftware or Bandai Namco.</strong><br/>
              This is a community-made tool for personal use only.
            </p>
          </section>
        </div>

        <div className="modal-footer">
          <button className="close-btn" onClick={onClose}>I Understand</button>
        </div>

        <style>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
            overflow-y: auto;
          }

          .modal-content {
            background: #1a1a1a;
            border-radius: 8px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem 2rem;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          }

          .modal-header h2 {
            margin: 0;
            color: #ff6b35;
            font-size: 1.8rem;
          }

          .close-button {
            background: none;
            border: none;
            color: #fff;
            font-size: 2rem;
            cursor: pointer;
            padding: 0;
            width: 2rem;
            height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
          }

          .close-button:hover {
            color: #ff6b35;
          }

          .modal-body {
            padding: 2rem;
            color: #fff;
            line-height: 1.6;
          }

          .terms-section {
            margin-bottom: 2rem;
          }

          .terms-section h3 {
            color: #ff6b35;
            margin-bottom: 1rem;
            font-size: 1.2rem;
          }

          .terms-section p {
            margin-bottom: 1rem;
            color: rgba(255, 255, 255, 0.9);
          }

          .terms-section ul {
            margin: 1rem 0;
            padding-left: 1.5rem;
          }

          .terms-section li {
            margin-bottom: 0.75rem;
            color: rgba(255, 255, 255, 0.9);
          }

          .terms-section strong {
            color: #ff6b35;
          }

          .disclaimer-box {
            background: rgba(244, 67, 54, 0.1);
            border: 2px solid rgba(244, 67, 54, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
          }

          .disclaimer-box p {
            margin: 0;
          }

          .modal-footer {
            padding: 1.5rem 2rem;
            border-top: 2px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: center;
          }

          .close-btn {
            padding: 0.75rem 2rem;
            background: #ff6b35;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
            font-size: 1rem;
          }

          .close-btn:hover {
            background: #e55a2b;
          }

          @media (max-width: 768px) {
            .modal-header,
            .modal-body,
            .modal-footer {
              padding: 1rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
