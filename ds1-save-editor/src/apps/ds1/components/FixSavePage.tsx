import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';
import { SaveFileEditor } from '../lib/SaveFileEditor';
import { SlotGrid } from './SlotGrid';
import { ConfirmModal } from './ConfirmModal';
import { embedSaveData } from '../lib/saveEmbedder';

interface FixSavePageProps {
  onClose?: () => void;
}

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'warning' | 'info' | 'success' | 'error';
  confirmText?: string;
}

export const FixSavePage: React.FC<FixSavePageProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [defaultSaveEditor, setDefaultSaveEditor] = useState<SaveFileEditor | null>(null);
  const [userSaveEditor, setUserSaveEditor] = useState<SaveFileEditor | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingDefault, setLoadingDefault] = useState(true);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const handleHome = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/');
    }
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const showModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'warning' | 'info' | 'success' | 'error' = 'info',
    confirmText?: string
  ) => {
    setModalState({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        closeModal();
      },
      type,
      confirmText
    });
  };

  // Load default save on mount
  useEffect(() => {
    const loadDefaultSave = async () => {
      try {
        setLoadingDefault(true);
        const response = await fetch('/DRAKS0005.sl2');
        if (!response.ok) {
          throw new Error('Failed to load default save file');
        }
        const arrayBuffer = await response.arrayBuffer();
        const file = new File([arrayBuffer], 'DRAKS0005.sl2');
        const editor = await SaveFileEditor.fromFile(file);
        setDefaultSaveEditor(editor);
        console.log('Default save loaded successfully');
      } catch (error) {
        console.error('Error loading default save:', error);
        showModal(
          'Error',
          'Failed to load default save file. Please refresh the page and try again.',
          () => {},
          'error',
          'OK'
        );
      } finally {
        setLoadingDefault(false);
      }
    };

    loadDefaultSave();
  }, []);

  const handleUserFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const editor = await SaveFileEditor.fromFile(file);
      setUserSaveEditor(editor);
      setSelectedSlot(null);
      console.log('User save loaded successfully');
    } catch (error) {
      console.error('Error loading user save:', error);
      showModal(
        'Error',
        `Failed to load save file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        () => {},
        'error',
        'OK'
      );
    }
  };

  const handleEmbed = async () => {
    if (!defaultSaveEditor || !userSaveEditor || selectedSlot === null) {
      return;
    }

    setIsProcessing(true);

    try {
      const modifiedEditor = await embedSaveData(
        defaultSaveEditor,
        userSaveEditor,
        selectedSlot,
        'character'
      );

      // Download the result
      await modifiedEditor.downloadSaveFile('DRAKS0005.sl2');

      showModal(
        'Success',
        `Successfully fixed slot ${selectedSlot}!\n\nYour save file has been downloaded.\nSlot ${selectedSlot} now has a fixed structure with your character data restored.`,
        () => {},
        'success',
        'OK'
      );
    } catch (error) {
      console.error('Error during embedding:', error);
      showModal(
        'Error',
        `Failed to embed save data:\n${error instanceof Error ? error.message : 'Unknown error'}`,
        () => {},
        'error',
        'OK'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const canEmbed = defaultSaveEditor && userSaveEditor && selectedSlot !== null && !isProcessing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        title="Fix Your Save - Embed Save Data"
        showHomeButton
        onHome={handleHome}
        showGameNav={true}
      />

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>
          <section className="page-header">
            <h2>Save Data Embedding</h2>
            <p className="description">
              Embed data from your selected save slot into the default save file (DRAKS0005.sl2 slot 0).
              This replaces only slot 0 in the default save with your character data.
            </p>
          </section>

          {loadingDefault ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading default save file...</p>
            </div>
          ) : (
            <>
              <div className="upload-section">
                <div className="upload-box">
                  <h3>Step 1: Select Your Save File</h3>
                  <label className="file-upload-button">
                    <input
                      type="file"
                      accept=".sl2"
                      onChange={handleUserFileSelect}
                      style={{ display: 'none' }}
                    />
                    {userSaveEditor ? '✓ Save Loaded - Click to Change' : '📁 Select Save File'}
                  </label>
                  {userSaveEditor && (
                    <p className="success-text">Save file loaded successfully!</p>
                  )}
                </div>
              </div>

              {userSaveEditor && (
                <>
                  <div className="slot-selection-section">
                    <h3>Step 2: Select Source Slot</h3>
                    <SlotGrid
                      characters={userSaveEditor.getCharacters()}
                      selectedIndex={selectedSlot}
                      onSelectSlot={setSelectedSlot}
                      mode="source"
                      title="SELECT SLOT TO COPY FROM"
                    />
                  </div>

                  <div className="action-section">
                    <button
                      className="embed-button"
                      onClick={handleEmbed}
                      disabled={!canEmbed}
                    >
                      {isProcessing ? '⏳ Processing...' : '🔧 Fix Slot & Download'}
                    </button>
                    {selectedSlot !== null && (
                      <div className="embed-info">
                        <div>Fixing: Your Save Slot {selectedSlot}</div>
                        <div>Using: DRAKS0005.sl2 Slot 0 (clean structure)</div>
                        <div>Restoring: character data (0x00-0x1E470)</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <section className="info-section">
                <h3>How It Works</h3>
                <div className="info-box" style={{ maxWidth: '600px' }}>
                  <h4>Character Mode</h4>
                  <p>Copies character data (0x00-0x1E470) from your selected slot into DRAKS0005.sl2 slot 0, including stats, inventory, and equipped items.</p>
                </div>

                <div className="warning-box" style={{ marginTop: '1.5rem' }}>
                  <strong>Important:</strong> The modified DRAKS0005.sl2 will be downloaded.
                  Only slot 0 of DRAKS0005.sl2 is modified - all other slots (1-9) remain unchanged.
                  Replace the game's save file with this modified version to use your character.
                </div>
              </section>
            </>
          )}
        </div>

        <style>{`
          .page-header {
            margin-bottom: 2rem;
          }

          .page-header h2 {
            color: #ff6b35;
            font-size: 2rem;
            margin: 0 0 0.75rem 0;
            border-bottom: 2px solid #ff6b35;
            padding-bottom: 0.5rem;
          }

          .description {
            color: rgba(255, 255, 255, 0.8);
            font-size: 1rem;
            margin: 0;
          }

          .loading-state {
            text-align: center;
            padding: 4rem 2rem;
            color: rgba(255, 255, 255, 0.7);
          }

          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255, 107, 53, 0.2);
            border-top: 4px solid #ff6b35;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .upload-section {
            margin: 2rem 0;
          }

          .upload-box {
            background: rgba(0, 0, 0, 0.3);
            padding: 2rem;
            border-radius: 8px;
            border: 2px dashed rgba(255, 107, 53, 0.5);
            text-align: center;
          }

          .upload-box h3 {
            color: #ff6b35;
            font-size: 1.3rem;
            margin: 0 0 1.5rem 0;
          }

          .file-upload-button {
            display: inline-block;
            padding: 1rem 2rem;
            background: #ff6b35;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 1rem;
            transition: all 0.2s;
          }

          .file-upload-button:hover {
            background: #f7931e;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
          }

          .success-text {
            color: #4ade80;
            margin-top: 1rem;
            font-weight: 500;
          }

          .slot-selection-section {
            margin: 2rem 0;
          }

          .slot-selection-section h3 {
            color: #ff6b35;
            font-size: 1.3rem;
            margin: 0 0 1rem 0;
          }

          .action-section {
            margin: 2rem 0;
            text-align: center;
          }

          .embed-button {
            padding: 1.25rem 3rem;
            font-size: 1.25rem;
            font-weight: 600;
            background: #ff6b35;
            color: white;
            border: 2px solid #ff6b35;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .embed-button:hover:not(:disabled) {
            background: #f7931e;
            border-color: #f7931e;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
          }

          .embed-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            background: #555;
            border-color: #555;
          }

          .embed-info {
            margin-top: 1.5rem;
            background: rgba(0, 0, 0, 0.4);
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid rgba(255, 107, 53, 0.3);
            display: inline-block;
          }

          .embed-info div {
            margin: 0.5rem 0;
            color: rgba(255, 255, 255, 0.9);
          }

          .info-section {
            margin-top: 3rem;
          }

          .info-section h3 {
            color: #ff6b35;
            font-size: 1.5rem;
            margin: 0 0 1rem 0;
          }

          .info-box {
            background: rgba(0, 0, 0, 0.3);
            padding: 1.25rem;
            border-radius: 6px;
            border: 1px solid rgba(255, 107, 53, 0.3);
          }

          .info-box h4 {
            color: #ff6b35;
            font-size: 1.1rem;
            margin: 0 0 0.75rem 0;
          }

          .info-box p {
            margin: 0;
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.8);
          }

          .warning-box {
            background: rgba(255, 107, 53, 0.1);
            border: 2px solid rgba(255, 107, 53, 0.4);
            border-radius: 6px;
            padding: 1rem 1.25rem;
          }

          .warning-box strong {
            color: #ff6b35;
            display: block;
            margin-bottom: 0.5rem;
          }

          @media (max-width: 768px) {
            .page-header h2 {
              font-size: 1.5rem;
            }
          }
        `}</style>
      </div>

      <Footer />

      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        onConfirm={modalState.onConfirm}
        onCancel={closeModal}
        type={modalState.type}
        confirmText={modalState.confirmText}
      />
    </div>
  );
};
