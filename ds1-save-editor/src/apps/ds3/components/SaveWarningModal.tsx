import React, { useState } from 'react';
import './SaveWarningModal.css';

interface SaveWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export const SaveWarningModal: React.FC<SaveWarningModalProps> = ({
  isOpen,
  onConfirm,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText('%APPDATA%\\DarkSoulsIII');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>⚠️ Important Save Location Warning</h2>
        </div>
        <div className="modal-body">
          <p className="warning-text">
            <strong>You cannot save directly to the game save folder!</strong>
          </p>
          <p>
            Due to browser security restrictions, you must:
          </p>
          <ol>
            <li>Save the file to <strong>Downloads</strong> or <strong>Desktop</strong> folder</li>
            <li>Then manually copy it to your Dark Souls 3 save folder</li>
          </ol>
          <div className="save-path-hint">
            <p>To quickly navigate to your save folder:</p>
            <div className="path-copy-container">
              <code>%APPDATA%\DarkSoulsIII</code>
              <button
                className={`copy-path-button ${copySuccess ? 'copied' : ''}`}
                onClick={handleCopyPath}
                title="Copy path to clipboard"
              >
                {copySuccess ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <p className="path-instruction">
              Press <kbd>Win + R</kbd>, paste this path, and press Enter
            </p>
          </div>
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
