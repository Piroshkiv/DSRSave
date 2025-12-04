import React from 'react';
import './FileActions.css';

interface FileActionsProps {
  onSave?: () => void;
  onSaveAs?: () => void;
  onReload?: () => void;
  disabled?: boolean;
}

export const FileActions: React.FC<FileActionsProps> = ({
  onSave,
  onSaveAs,
  onReload,
  disabled = false,
}) => {
  return (
    <div className="file-actions">
      {onReload && (
        <button className="action-button reload-button" onClick={onReload} disabled={disabled}>
          Reload
        </button>
      )}
      {onSave && (
        <button className="action-button save-button" onClick={onSave} disabled={disabled}>
          Save
        </button>
      )}
      {onSaveAs && (
        <button className="action-button save-as-button" onClick={onSaveAs} disabled={disabled}>
          Save As
        </button>
      )}
    </div>
  );
};
