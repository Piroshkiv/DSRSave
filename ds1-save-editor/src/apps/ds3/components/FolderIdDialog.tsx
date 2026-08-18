import React, { useEffect, useState } from 'react';
import './SaveWarningModal.css';
import { parseSteamId, steamIdFromPath, formatSteamId, formatSteamIdHex } from '../lib/steamId';

interface FolderIdDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (steamId: bigint) => void;
}

/**
 * Asks for the save folder's name, which is the account's SteamID64 in hex.
 *
 * Tauri hands us the real path, so this only appears in the browser, where no
 * path exists and the user has to read the folder name themselves. A full path
 * pasted from the address bar works too, as does a plain decimal Steam ID.
 */
export const FolderIdDialog: React.FC<FolderIdDialogProps> = ({ isOpen, onCancel, onConfirm }) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (isOpen) setValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const parsed = steamIdFromPath(value) ?? parseSteamId(value);
  const invalid = value.trim() !== '' && parsed === null;

  const confirm = () => {
    if (parsed !== null) onConfirm(parsed);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content ds3-folderid-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Save folder ID</h2>
          <p className="modal-subtitle">
            The folder your save sits in is named after your Steam ID:{' '}
            <code>%APPDATA%\DarkSoulsIII\&lt;id&gt;</code>
          </p>
        </div>

        <div className="modal-body">
          <input
            type="text"
            className={`ds3-steamid-input${invalid ? ' invalid' : ''}`}
            value={value}
            placeholder="0110000131bf8025"
            spellCheck={false}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <p className="ds3-export-hint">
            {invalid
              ? 'Not a Steam ID — paste the folder name, its full path, or the decimal ID.'
              : parsed !== null
                ? `${formatSteamIdHex(parsed)} — ${formatSteamId(parsed)}`
                : 'Paste the folder name, its full path, or the decimal ID.'}
          </p>
        </div>

        <div className="modal-footer">
          <button className="modal-button modal-button-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="modal-button modal-button-confirm"
            onClick={confirm}
            disabled={parsed === null}
          >
            Use this ID
          </button>
        </div>
      </div>
    </div>
  );
};
