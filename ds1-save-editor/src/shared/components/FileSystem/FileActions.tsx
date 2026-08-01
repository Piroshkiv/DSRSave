import React from 'react';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../../../apps/ds1/lib/i18n';
import './FileActions.css';

interface FileActionsProps {
  onSave?: () => void;
  onSaveAs?: () => void;
  onReload?: () => void;
  disabled?: boolean;
  disableSave?: boolean;
}

export const FileActions: React.FC<FileActionsProps> = ({
  onSave,
  onSaveAs,
  onReload,
  disabled = false,
  disableSave = false,
}) => {
  const { lang } = useLang();
  return (
    <div className="file-actions">
      {onReload && (
        <button className="action-button reload-button" onClick={onReload} disabled={disabled}>
          {t('reload', lang)}
        </button>
      )}
      {onSave && (
        <button className="action-button save-button" onClick={onSave} disabled={disabled || disableSave}>
          {t('save', lang)}
        </button>
      )}
      {onSaveAs && (
        <button className="action-button save-as-button" onClick={onSaveAs} disabled={disabled}>
          {t('saveAs', lang)}
        </button>
      )}
    </div>
  );
};
