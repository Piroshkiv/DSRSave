import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';

export const TermsFullPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        title="Terms of Use"
        showHomeButton
        onHome={() => navigate('/')}
        showGameNav={true}
      />

      <div style={{ flex: 1, padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>
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

        <style>{`
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
        `}</style>
      </div>

      <Footer />
    </div>
  );
};
