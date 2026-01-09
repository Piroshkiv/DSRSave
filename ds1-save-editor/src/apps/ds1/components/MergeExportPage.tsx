import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';
import { SaveFileEditor } from '../lib/SaveFileEditor';
import { DualFileUpload } from './DualFileUpload';
import { SlotGrid } from './SlotGrid';
import { ConfirmModal } from './ConfirmModal';
import { copyCharacterSlot, downloadSlot, importSlotFromBinary } from '../lib/slotDuplicator';

interface MergeExportPageProps {
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

export const MergeExportPage: React.FC<MergeExportPageProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [sourceEditor, setSourceEditor] = useState<SaveFileEditor | null>(null);
  const [destEditor, setDestEditor] = useState<SaveFileEditor | null>(null);
  const [sourceSlot, setSourceSlot] = useState<number | null>(null);
  const [destSlot, setDestSlot] = useState<number | null>(null);
  const [isCopying, setIsCopying] = useState(false);
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

  const handleSourceLoaded = (editor: SaveFileEditor) => {
    setSourceEditor(editor);
    setSourceSlot(null);

    // If destination is not loaded, auto-load source as destination too
    if (!destEditor) {
      setDestEditor(editor);
      setDestSlot(null);
    }
  };

  const handleDestLoaded = (editor: SaveFileEditor) => {
    setDestEditor(editor);
    setDestSlot(null);

    // If source is not loaded, auto-load destination as source too
    if (!sourceEditor) {
      setSourceEditor(editor);
      setSourceSlot(null);
    }
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const showModal = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'info' | 'success' | 'error' = 'info', confirmText?: string) => {
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

  const performCopy = async () => {
    if (!sourceEditor || !destEditor || sourceSlot === null || destSlot === null) {
      return;
    }

    setIsCopying(true);

    try {
      // Copy character
      copyCharacterSlot(sourceEditor, destEditor, sourceSlot, destSlot);

      // Save to file
      if (destEditor.hasFileHandle()) {
        await destEditor.saveToOriginalFile();
        showModal(
          'Success',
          `Successfully copied character from slot ${sourceSlot} to slot ${destSlot}!\n\nThe destination save file has been updated.`,
          () => {},
          'success',
          'OK'
        );
      } else {
        await destEditor.downloadSaveFile('modified_save.sl2');
        showModal(
          'Success',
          `Successfully copied character from slot ${sourceSlot} to slot ${destSlot}!\n\nThe modified save file has been downloaded.`,
          () => {},
          'success',
          'OK'
        );
      }

      // Refresh display
      const chars = destEditor.getCharacters();
      setDestEditor(destEditor);
      // Force re-render by creating new array reference
      destEditor.getCharacters().forEach((_, i) => chars[i]);
    } catch (error) {
      console.error('Error copying character:', error);
      showModal(
        'Error',
        `Error copying character:\n${error instanceof Error ? error.message : 'Unknown error'}`,
        () => {},
        'error',
        'OK'
      );
    } finally {
      setIsCopying(false);
    }
  };

  const handleExportSlot = (mode: 'source' | 'destination') => {
    const editor = mode === 'source' ? sourceEditor : destEditor;
    const slot = mode === 'source' ? sourceSlot : destSlot;

    if (!editor || slot === null) {
      showModal(
        'No Slot Selected',
        `Please select a ${mode} slot to export.`,
        () => {},
        'error',
        'OK'
      );
      return;
    }

    const chars = editor.getCharacters();
    const char = chars[slot];

    if (char?.isEmpty) {
      showModal(
        'Slot Empty',
        'Cannot export empty slot!',
        () => {},
        'error',
        'OK'
      );
      return;
    }

    try {
      downloadSlot(char);
      showModal(
        'Export Successful',
        `Slot ${slot} exported successfully!\n\nCharacter: ${char.name}\nLevel: ${char.level}`,
        () => {},
        'success',
        'OK'
      );
    } catch (error) {
      console.error('Error exporting slot:', error);
      showModal(
        'Export Failed',
        `Failed to export slot:\n${error instanceof Error ? error.message : 'Unknown error'}`,
        () => {},
        'error',
        'OK'
      );
    }
  };

  const handleImportSlot = async (mode: 'source' | 'destination') => {
    const editor = mode === 'source' ? sourceEditor : destEditor;
    const slot = mode === 'source' ? sourceSlot : destSlot;

    if (!editor || slot === null) {
      showModal(
        'No Slot Selected',
        `Please select a ${mode} slot to import to.`,
        () => {},
        'error',
        'OK'
      );
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin,.dsrslot,.bin.dsrslot';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const slotData = new Uint8Array(arrayBuffer);

        const chars = editor.getCharacters();
        const existingChar = chars[slot];

        const performImport = async () => {
          try {
            importSlotFromBinary(editor, slotData, slot);

            // Save the changes
            if (editor.hasFileHandle()) {
              await editor.saveToOriginalFile();
              showModal(
                'Import Successful',
                `Slot ${slot} imported successfully!\n\nThe save file has been updated.`,
                () => {},
                'success',
                'OK'
              );
            } else {
              await editor.downloadSaveFile('imported_save.sl2');
              showModal(
                'Import Successful',
                `Slot ${slot} imported successfully!\n\nThe modified save file has been downloaded.`,
                () => {},
                'success',
                'OK'
              );
            }

            // Force re-render
            if (mode === 'source') {
              setSourceEditor(editor);
            } else {
              setDestEditor(editor);
            }
          } catch (error) {
            console.error('Error importing slot:', error);
            showModal(
              'Import Failed',
              `Failed to import slot:\n${error instanceof Error ? error.message : 'Unknown error'}`,
              () => {},
              'error',
              'OK'
            );
          }
        };

        if (!existingChar?.isEmpty) {
          showModal(
            'Overwrite Character?',
            `Slot ${slot} is not empty!\n\nThe character "${existingChar.name}" (Level ${existingChar.level}) will be deleted forever and replaced with the imported character.\n\nAre you sure you want to overwrite this character?`,
            performImport,
            'warning',
            'Yes, Import'
          );
        } else {
          performImport();
        }
      } catch (error) {
        console.error('Error reading file:', error);
        showModal(
          'Import Failed',
          `Failed to read file:\n${error instanceof Error ? error.message : 'Unknown error'}`,
          () => {},
          'error',
          'OK'
        );
      }
    };

    input.click();
  };

  const handleCopySlot = () => {
    if (!sourceEditor || !destEditor || sourceSlot === null || destSlot === null) {
      return;
    }

    const sourceChars = sourceEditor.getCharacters();
    const destChars = destEditor.getCharacters();

    if (sourceSlot >= 10 || destSlot >= 10) {
      return;
    }

    const sourceChar = sourceChars[sourceSlot];
    if (sourceChar?.isEmpty) {
      showModal(
        'Slot Empty',
        'Source slot is empty! Please select a non-empty slot.',
        () => {},
        'error',
        'OK'
      );
      return;
    }

    const destChar = destChars[destSlot];
    if (!destChar?.isEmpty) {
      showModal(
        'Overwrite Character?',
        `Destination slot isn't empty!\n\nThe character "${destChar.name}" (Level ${destChar.level}) in slot ${destSlot} will be deleted forever and replaced with "${sourceChar.name}" (Level ${sourceChar.level}) from slot ${sourceSlot}.\n\nAre you sure you want to overwrite this character?`,
        performCopy,
        'warning',
        'Yes, Overwrite'
      );
    } else {
      performCopy();
    }
  };

  const canCopy = sourceEditor && destEditor && sourceSlot !== null && destSlot !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        title="Merge, Duplicate or Export Save"
        showHomeButton
        onHome={handleHome}
        showGameNav={true}
      />

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>
          <section className="page-header">
            <h2>📦 Character Slot Manager</h2>
          </section>

          <DualFileUpload
            onSourceLoaded={handleSourceLoaded}
            onDestinationLoaded={handleDestLoaded}
            onError={(message) => showModal('Error', message, () => {}, 'error', 'OK')}
            sourceLoaded={sourceEditor !== null}
            destinationLoaded={destEditor !== null}
          />

          {sourceEditor && destEditor && (
            <div className="copy-interface">
              <div className="grids-container">
                <div className="grid-with-actions">
                  <SlotGrid
                    characters={sourceEditor.getCharacters()}
                    selectedIndex={sourceSlot}
                    onSelectSlot={setSourceSlot}
                    mode="source"
                  />
                  <div className="slot-actions">
                    <button
                      className="action-button export-button"
                      onClick={() => handleExportSlot('source')}
                      disabled={sourceSlot === null}
                    >
                      💾 Export Slot
                    </button>
                    <button
                      className="action-button import-button"
                      onClick={() => handleImportSlot('source')}
                      disabled={sourceSlot === null}
                    >
                      📥 Import Slot
                    </button>
                  </div>
                </div>

                <div className="copy-arrow-container">
                  <button
                    className="copy-button"
                    onClick={handleCopySlot}
                    disabled={!canCopy || isCopying}
                  >
                    {isCopying ? '⏳ Copying...' : '➜ Copy'}
                  </button>
                  {sourceSlot !== null && destSlot !== null && (
                    <div className="copy-info">
                      <div>Source: Slot {sourceSlot}</div>
                      <div>Destination: Slot {destSlot}</div>
                    </div>
                  )}
                </div>

                <div className="grid-with-actions">
                  <SlotGrid
                    characters={destEditor.getCharacters()}
                    selectedIndex={destSlot}
                    onSelectSlot={setDestSlot}
                    mode="destination"
                  />
                  <div className="slot-actions">
                    <button
                      className="action-button export-button"
                      onClick={() => handleExportSlot('destination')}
                      disabled={destSlot === null}
                    >
                      💾 Export Slot
                    </button>
                    <button
                      className="action-button import-button"
                      onClick={() => handleImportSlot('destination')}
                      disabled={destSlot === null}
                    >
                      📥 Import Slot
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!sourceEditor && !destEditor && (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <h3>Load Save Files to Get Started</h3>
              <p>Upload source and destination save files to begin copying characters between slots.</p>
            </div>
          )}

          <section className="info-section">
            <p className="info-intro">
              Copy characters between save files, duplicate them within the same save, or export/import individual character slots.
              Load two save files (or the same file twice) and select slots to work with.
            </p>

            <div className="features-grid">
              <div className="feature-box">
                <h3>➜ Copy Between Saves</h3>
                <p>Copy characters from one save file to another, preserving all data and load screen information.</p>
              </div>

              <div className="feature-box">
                <h3>💾 Export Slots</h3>
                <p>Export individual character slots as <code>.bin.dsrslot</code> files for backup or sharing.</p>
              </div>

              <div className="feature-box">
                <h3>📥 Import Slots</h3>
                <p>Import character slots from <code>.bin.dsrslot</code> files into any save file.</p>
              </div>
            </div>

            <div className="warning-box">
              <strong>⚠️ Important Note:</strong> When importing slots, the character information in the game's load menu (name, level, location)
              will display incorrectly until you load that character once. This is normal behavior - the data updates automatically
              after entering the save slot.
            </div>
          </section>
        </div>

        <style>{`
          .page-header {
            margin-bottom: 2rem;
          }

          .page-header h2 {
            color: #ff6b35;
            font-size: 2rem;
            margin: 0;
            border-bottom: 2px solid #ff6b35;
            padding-bottom: 0.5rem;
          }

          .info-section {
            margin-top: 3rem;
            margin-bottom: 2rem;
          }

          .info-intro {
            margin-bottom: 1.5rem;
            color: rgba(255, 255, 255, 0.9);
            font-size: 1rem;
            line-height: 1.6;
          }

          .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin: 1.5rem 0;
          }

          .feature-box {
            background: rgba(0, 0, 0, 0.3);
            padding: 1.25rem;
            border-radius: 6px;
            border: 1px solid rgba(255, 107, 53, 0.3);
          }

          .feature-box h3 {
            color: #ff6b35;
            font-size: 1.1rem;
            margin: 0 0 0.75rem 0;
            font-weight: 600;
          }

          .feature-box p {
            margin: 0;
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.5;
          }

          .feature-box code {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-size: 0.85rem;
            color: #ff6b35;
          }

          .warning-box {
            background: rgba(255, 107, 53, 0.1);
            border: 2px solid rgba(255, 107, 53, 0.4);
            border-radius: 6px;
            padding: 1rem 1.25rem;
            margin-top: 1.5rem;
          }

          .warning-box strong {
            color: #ff6b35;
            display: block;
            margin-bottom: 0.5rem;
          }

          @media (max-width: 768px) {
            .features-grid {
              grid-template-columns: 1fr;
              gap: 0.75rem;
            }

            .feature-box {
              padding: 1rem;
            }

            .page-header h2 {
              font-size: 1.5rem;
            }
          }

          .copy-interface {
            margin-top: 2rem;
          }

          .grids-container {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 2rem;
            align-items: start;
          }

          .grid-with-actions {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .slot-actions {
            display: flex;
            gap: 0.75rem;
            justify-content: center;
          }

          .action-button {
            flex: 1;
            padding: 0.75rem 1rem;
            font-size: 0.9rem;
            font-weight: 600;
            border: 2px solid;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .export-button {
            background: rgba(255, 107, 53, 0.15);
            border-color: rgba(255, 107, 53, 0.5);
            color: #ff6b35;
          }

          .export-button:hover:not(:disabled) {
            background: rgba(255, 107, 53, 0.25);
            border-color: #ff6b35;
            transform: translateY(-2px);
          }

          .import-button {
            background: rgba(59, 130, 246, 0.15);
            border-color: rgba(59, 130, 246, 0.5);
            color: #3b82f6;
          }

          .import-button:hover:not(:disabled) {
            background: rgba(59, 130, 246, 0.25);
            border-color: #3b82f6;
            transform: translateY(-2px);
          }

          .action-button:active:not(:disabled) {
            transform: translateY(0);
          }

          .action-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            filter: grayscale(1);
          }

          .copy-arrow-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
          }

          .copy-button {
            padding: 1.25rem 2rem;
            font-size: 1.25rem;
            font-weight: 600;
            background: #ff6b35;
            color: #fff;
            border: 2px solid #ff6b35;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .copy-button:hover:not(:disabled) {
            background: #f7931e;
            border-color: #f7931e;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
          }

          .copy-button:active:not(:disabled) {
            transform: translateY(0);
          }

          .copy-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            background: #555;
            border-color: #555;
          }

          .copy-info {
            background: rgba(0, 0, 0, 0.4);
            padding: 0.875rem;
            border-radius: 6px;
            border: 1px solid rgba(255, 107, 53, 0.3);
            text-align: center;
            font-size: 0.875rem;
            color: rgba(255, 255, 255, 0.9);
            min-width: 140px;
          }

          .copy-info div {
            margin: 0.375rem 0;
            line-height: 1.4;
          }

          .copy-info div:first-child {
            color: #ff6b35;
            font-weight: 500;
          }

          .copy-info div:last-child {
            color: #3b82f6;
            font-weight: 500;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 2rem;
            color: rgba(255, 255, 255, 0.6);
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .empty-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            opacity: 0.5;
          }

          .empty-state h3 {
            color: #ff6b35;
            font-size: 1.5rem;
            margin-bottom: 0.75rem;
            font-weight: 600;
          }

          .empty-state p {
            font-size: 1rem;
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.6;
          }

          @media (max-width: 1200px) {
            .grids-container {
              grid-template-columns: 1fr;
              gap: 1.5rem;
            }

            .copy-arrow-container {
              flex-direction: row;
              justify-content: center;
            }

            .copy-button {
              transform: rotate(90deg);
            }

            .copy-button:hover:not(:disabled) {
              transform: rotate(90deg) translateY(-2px) scale(1.05);
            }

            .copy-button:active:not(:disabled) {
              transform: rotate(90deg) translateY(0) scale(1);
            }

            .slot-actions {
              flex-direction: row;
            }
          }

          @media (max-width: 480px) {
            .slot-actions {
              flex-direction: column;
            }

            .action-button {
              font-size: 0.8rem;
              padding: 0.65rem 0.85rem;
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
