import React from 'react';
import './SaveWarningModal.css';

interface BanWarningModalProps {
  isOpen: boolean;
  /** The save was flipped from online to offline as part of this write. */
  switchedOffline: boolean;
  /** Flag as it now stands; null when the system entry could not be read. */
  online: boolean | null;
  onConfirm: () => void;
}

/**
 * Shown after a save that changed stats. Edited stats reaching the servers
 * before the game has reconciled them locally is what gets accounts banned, so
 * the character has to be loaded once in offline mode first.
 */
export const BanWarningModal: React.FC<BanWarningModalProps> = ({
  isOpen,
  switchedOffline,
  online,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const note = switchedOffline
    ? { text: 'This save was switched to Offline Mode automatically, so the game will start offline.', tone: 'applied' }
    : online === false
      ? { text: 'This save was already set to Offline Mode.', tone: 'applied' }
      : { text: 'The launch setting could not be read from this save, so it was left alone — set Offline Mode in the game before loading the character.', tone: 'unknown' };

  return (
    <div className="modal-overlay">
      <div className="modal-content ds3-ban-modal">
        <div className="modal-header">
          <h2>⚠️ Load this character offline first</h2>
          <p className="modal-subtitle">
            You changed stats. Going straight online with them will get your account banned.
          </p>
        </div>

        <div className="modal-body">
          <ol className="ds3-ban-steps">
            <li>
              Start Dark Souls III in <strong>Offline Mode</strong> and load this character
              at least once.
            </li>
            <li>
              Quit back to the main menu so the game writes the character out itself.
            </li>
            <li>
              Only then switch back to online play.
            </li>
          </ol>

          <p className={`ds3-ban-note ${note.tone}`}>{note.text}</p>
        </div>

        <div className="modal-footer">
          <button className="modal-button modal-button-confirm" onClick={onConfirm}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
