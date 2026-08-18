import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../../shared/components/Layout/Header';
import { Footer } from '../../../shared/components/Layout/Footer';
import { ConfirmModal } from '../../ds1/components/ConfirmModal';
import { DS3SaveFileEditor } from '../lib/SaveFileEditor';
import { DualFileUpload } from './DualFileUpload';
import { SlotGrid } from './SlotGrid';
import { copyCharacterSlot, downloadSlot, importSlotFromBinary, unpackSlotFile } from '../lib/slotTransfer';
import { formatSteamIdHex } from '../lib/steamId';

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

/** "…and it now belongs to account X" — the half of a DS3 transfer DS1 never needs. */
function rebindNote(steamId: bigint | null, rebound: boolean): string {
  if (steamId === null) return '\n\nThe destination save has no Steam ID, so the character kept its own.';
  if (!rebound) return '\n\nWarning: this slot has no Steam ID field, so it could not be rebound.';
  return `\n\nThe character was rebound to Steam ID ${formatSteamIdHex(steamId)}.`;
}

function summaryNote(copied: boolean): string {
  return copied
    ? ''
    : '\n\nThe load menu will describe the slot incorrectly until the character is loaded once.';
}

export const MergeExportPage: React.FC<MergeExportPageProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [sourceEditor, setSourceEditor] = useState<DS3SaveFileEditor | null>(null);
  const [destEditor, setDestEditor] = useState<DS3SaveFileEditor | null>(null);
  const [sourceSlot, setSourceSlot] = useState<number | null>(null);
  const [destSlot, setDestSlot] = useState<number | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [revision, setRevision] = useState(0);
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

  const handleSourceLoaded = (editor: DS3SaveFileEditor) => {
    setSourceEditor(editor);
    setSourceSlot(null);

    // If destination is not loaded, auto-load source as destination too
    if (!destEditor) {
      setDestEditor(editor);
      setDestSlot(null);
    }
  };

  const handleDestLoaded = (editor: DS3SaveFileEditor) => {
    setDestEditor(editor);
    setDestSlot(null);

    if (!sourceEditor) {
      setSourceEditor(editor);
      setSourceSlot(null);
    }
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const showModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: ModalState['type'] = 'info',
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

  /** Write an editor back where it came from, or hand the user a download. */
  const persist = async (editor: DS3SaveFileEditor, downloadName: string): Promise<string> => {
    if (editor.hasFileHandle()) {
      await editor.saveToOriginalFile();
      return 'The destination save file has been updated.';
    }
    await editor.downloadSaveFile(downloadName);
    return 'The modified save file has been downloaded.';
  };

  const performCopy = async () => {
    if (!sourceEditor || !destEditor || sourceSlot === null || destSlot === null) {
      return;
    }

    setIsCopying(true);

    try {
      const result = copyCharacterSlot(sourceEditor, destEditor, sourceSlot, destSlot);
      const written = await persist(destEditor, 'modified_DS30000.sl2');

      setRevision(r => r + 1);
      showModal(
        'Success',
        `Copied the character from slot ${sourceSlot + 1} to slot ${destSlot + 1}.\n\n${written}` +
          rebindNote(result.steamId, result.reboundSteamId) +
          summaryNote(result.summaryCopied),
        () => {},
        'success',
        'OK'
      );
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
      showModal('No Slot Selected', `Please select a ${mode} slot to export.`, () => {}, 'error', 'OK');
      return;
    }

    const char = editor.getCharacters()[slot];

    try {
      downloadSlot(editor, slot);
      showModal(
        'Export Successful',
        `Slot ${slot + 1} exported.\n\nCharacter: ${char?.name || 'Unnamed'}\nLevel: ${char?.level ?? 0}`,
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
      showModal('No Slot Selected', `Please select a ${mode} slot to import to.`, () => {}, 'error', 'OK');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin,.ds3slot,.bin.ds3slot';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const packed = new Uint8Array(await file.arrayBuffer());
        const { slotData, summary } = unpackSlotFile(packed);
        const existingChar = editor.getCharacters()[slot];

        const performImport = async () => {
          try {
            const result = importSlotFromBinary(editor, slotData, slot, { summary });
            const written = await persist(editor, 'imported_DS30000.sl2');

            setRevision(r => r + 1);
            showModal(
              'Import Successful',
              `Slot ${slot + 1} imported.\n\n${written}` +
                rebindNote(result.steamId, result.reboundSteamId) +
                summaryNote(result.summaryCopied),
              () => {},
              'success',
              'OK'
            );
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

        if (existingChar && !existingChar.isEmpty) {
          showModal(
            'Overwrite Character?',
            `Slot ${slot + 1} is not empty.\n\nThe character "${existingChar.name || 'Unnamed'}" ` +
              `(Level ${existingChar.level}) will be replaced by the imported character.`,
            () => { void performImport(); },
            'warning',
            'Yes, Import'
          );
        } else {
          await performImport();
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
    if (sourceSlot >= 10 || destSlot >= 10) {
      return;
    }

    const sourceChar = sourceEditor.getCharacters()[sourceSlot];
    if (!sourceChar || sourceChar.isEmpty) {
      showModal('Slot Empty', 'Source slot is empty. Please select a slot with a character.', () => {}, 'error', 'OK');
      return;
    }

    const destChar = destEditor.getCharacters()[destSlot];
    if (destChar && !destChar.isEmpty) {
      showModal(
        'Overwrite Character?',
        `Destination slot ${destSlot + 1} is not empty.\n\n"${destChar.name || 'Unnamed'}" ` +
          `(Level ${destChar.level}) will be replaced by "${sourceChar.name || 'Unnamed'}" ` +
          `(Level ${sourceChar.level}) from slot ${sourceSlot + 1}.`,
        () => { void performCopy(); },
        'warning',
        'Yes, Overwrite'
      );
    } else {
      void performCopy();
    }
  };

  const canCopy = sourceEditor && destEditor && sourceSlot !== null && destSlot !== null;

  const sourceAccount = sourceEditor?.getSteamId() ?? null;
  const destAccount = destEditor?.getSteamId() ?? null;
  const crossAccount = sourceAccount !== null && destAccount !== null && sourceAccount !== destAccount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        title="DS3 — Merge, Duplicate or Export Save"
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
              {crossAccount && (
                <div className="account-note">
                  These saves belong to different Steam accounts. Copied characters are rebound to the
                  destination account ({formatSteamIdHex(destAccount!)}) automatically — without that,
                  the game refuses to load them.
                </div>
              )}
              <div className="grids-container">
                <div className="grid-with-actions">
                  <SlotGrid
                    editor={sourceEditor}
                    selectedIndex={sourceSlot}
                    onSelectSlot={setSourceSlot}
                    mode="source"
                    revision={revision}
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
                      <div>Source: Slot {sourceSlot + 1}</div>
                      <div>Destination: Slot {destSlot + 1}</div>
                    </div>
                  )}
                </div>

                <div className="grid-with-actions">
                  <SlotGrid
                    editor={destEditor}
                    selectedIndex={destSlot}
                    onSelectSlot={setDestSlot}
                    mode="destination"
                    revision={revision}
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
              <p>Upload source and destination DS3 save files to begin copying characters between slots.</p>
            </div>
          )}

          <section className="info-section">
            <p className="info-intro">
              Copy characters between DS3 save files, duplicate them within the same save, or export and
              import individual slots. Load two save files (or the same file twice) and pick the slots to
              work with.
            </p>

            <div className="features-grid">
              <div className="feature-box">
                <h3>➜ Copy Between Saves</h3>
                <p>Copies the character, its load-menu entry and the slot flag, then rebinds it to the
                  destination account's Steam ID.</p>
              </div>

              <div className="feature-box">
                <h3>💾 Export Slots</h3>
                <p>Exports a slot as a <code>.bin.ds3slot</code> file — the raw slot data plus its
                  load-menu entry.</p>
              </div>

              <div className="feature-box">
                <h3>📥 Import Slots</h3>
                <p>Imports a <code>.bin.ds3slot</code> file (or a plain raw slot dump) into any save.</p>
              </div>
            </div>

            <div className="warning-box">
              <strong>⚠️ Steam ID:</strong> DS3 stores the owner's Steam ID inside every character slot and
              refuses a character that belongs to someone else. Every import here rebinds the slot to the
              destination save's account, so a downloaded character loads without further edits. The DS3
              editor is still in beta — play offline to avoid bans, and keep a copy of your save.
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

          .account-note {
            margin-bottom: 1.25rem;
            padding: 0.75rem 1rem;
            background: rgba(59, 130, 246, 0.08);
            border: 1px solid rgba(59, 130, 246, 0.35);
            border-radius: 6px;
            font-size: 0.85rem;
            color: #b9d0f5;
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
        cancelText="Cancel"
      />
    </div>
  );
};
