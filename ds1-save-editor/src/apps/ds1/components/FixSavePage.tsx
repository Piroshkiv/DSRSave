import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';

interface FixSavePageProps {
  onClose?: () => void;
}

export const FixSavePage: React.FC<FixSavePageProps> = ({ onClose }) => {
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
        title="Fix Your Save File"
        showHomeButton
        onHome={handleHome}
        showGameNav={true}
      />

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>
          <section className="guide-section">
            <h2>Save File Repair Tool</h2>
            <p>
              Content coming soon...
            </p>
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

          .guide-section p {
            margin-bottom: 1rem;
            color: rgba(255, 255, 255, 0.9);
          }
        `}</style>
      </div>

      <Footer />
    </div>
  );
};
