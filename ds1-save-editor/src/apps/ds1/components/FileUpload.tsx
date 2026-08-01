import React, { useRef, useEffect, useState } from 'react';
import { getFileSystemAdapter, FileHandle } from '../lib/adapters';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';

interface FileUploadProps {
  onFileLoaded: (file: File, fileHandle: FileHandle | null) => void;
  onAutoLoadAttempt?: (attempting: boolean) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, onAutoLoadAttempt }) => {
  const { lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasLastFile, setHasLastFile] = useState(false);
  const autoLoadAttemptedRef = useRef(false);

  // Auto-load on mount - try to load if permission already granted
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    autoLoadAttemptedRef.current = true;

    const tryAutoLoad = async () => {
      const adapter = getFileSystemAdapter();
      if (!adapter.supportsAutoLoad()) return;

      try {
        onAutoLoadAttempt?.(true);

        // First try to load directly (if permission already granted)
        const fileData = await adapter.loadLastFile();
        if (fileData) {
          console.log(`[FileUpload] Auto-loading: ${fileData.file.name}`);
          onFileLoaded(fileData.file, fileData.handle);
          return;
        }

        // Permission not granted - check if we have a stored file
        const lastFileName = await (adapter as any).getLastFileName?.();
        if (lastFileName) {
          setHasLastFile(true);
        }
      } catch (err) {
        console.warn('[FileUpload] Auto-load failed:', err);
      } finally {
        onAutoLoadAttempt?.(false);
      }
    };

    // Small delay to let UI render
    setTimeout(tryAutoLoad, 100);
  }, [onFileLoaded, onAutoLoadAttempt]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileLoaded(file, null);
    }
  };

  const handleLoadLastFile = async () => {
    console.log('[FileUpload] Load last file clicked');
    const adapter = getFileSystemAdapter();

    try {
      onAutoLoadAttempt?.(true);
      // Request permission (this is called from user gesture context)
      const fileData = await (adapter as any).requestLastFilePermission?.();
      if (fileData) {
        console.log(`[FileUpload] Loaded: ${fileData.file.name}`);
        onFileLoaded(fileData.file, fileData.handle);
        setHasLastFile(false);
      }
    } catch (err) {
      console.warn('[FileUpload] Load last file failed:', err);
    } finally {
      onAutoLoadAttempt?.(false);
    }
  };

  const handleButtonClick = async () => {
    console.log('[FileUpload] Load button clicked');
    const adapter = getFileSystemAdapter();
    console.log('[FileUpload] Using adapter:', adapter.getAdapterName());

    try {
      console.log('[FileUpload] Opening file...');
      const fileData = await adapter.openFile();
      console.log('[FileUpload] File opened:', fileData.file.name, 'handle:', fileData.handle ? 'yes' : 'no');

      // Save this file for next time (if supported)
      if (fileData.handle) {
        console.log('[FileUpload] Saving file handle for auto-load...');
        await adapter.saveLastFile(fileData.handle, fileData.file.name);
      }

      console.log('[FileUpload] Calling onFileLoaded...');
      onFileLoaded(fileData.file, fileData.handle);
    } catch (err: any) {
      if (err.message === 'User cancelled file selection') {
        console.log('[FileUpload] User cancelled');
        return; // User cancelled - do nothing
      }
      console.error('[FileUpload] Failed to open file:', err);
      alert('Failed to open file. Please try again.');
    }
  };

  return (
    <div className="file-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".sl2,.co2"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="button-with-help">
        <button className="upload-button" onClick={handleButtonClick}>
          {t('loadSave', lang)}
        </button>
        <span className="help-icon" title="Full path: C:\Users\<YourUsername>\Documents\NBGI\DARK SOULS REMASTERED\<user_id>\DRAKS0005.sl2">
          ?
        </span>
      </div>

      {hasLastFile && (
        <button className="upload-button upload-button-last" onClick={handleLoadLastFile}>
          {t('loadLastSave', lang)}
        </button>
      )}
    </div>
  );
};
