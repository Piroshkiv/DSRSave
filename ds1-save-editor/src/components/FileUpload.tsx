import React, { useRef, useEffect } from 'react';
import { getFileSystemAdapter, FileHandle } from '../lib/adapters';

interface FileUploadProps {
  onFileLoaded: (file: File, fileHandle: FileHandle | null) => void;
  onAutoLoadAttempt?: (attempting: boolean) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, onAutoLoadAttempt }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoLoadAttemptedRef = useRef(false);

  // Auto-load from last used file on mount
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    autoLoadAttemptedRef.current = true;

    const tryAutoLoad = async () => {
      const adapter = getFileSystemAdapter();

      // Check if auto-load is supported
      if (!adapter.supportsAutoLoad()) {
        return;
      }

      try {
        onAutoLoadAttempt?.(true);

        // Try to load last file
        const fileData = await adapter.loadLastFile();
        if (!fileData) {
          onAutoLoadAttempt?.(false);
          return;
        }

        console.log(`Auto-loading last used file: ${fileData.file.name}`);
        onFileLoaded(fileData.file, fileData.handle);
      } catch (err) {
        console.warn('Auto-load failed:', err);
      } finally {
        onAutoLoadAttempt?.(false);
      }
    };

    // Small delay to let UI render first
    setTimeout(tryAutoLoad, 100);
  }, [onFileLoaded, onAutoLoadAttempt]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileLoaded(file, null);
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
        accept=".sl2"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="button-with-help">
        <button className="upload-button" onClick={handleButtonClick}>
          Load Save File
        </button>
        <span className="help-icon" title="Full path: C:\Users\<YourUsername>\Documents\NBGI\DARK SOULS REMASTERED\<user_id>\DRAKS0005.sl2">
          ?
        </span>
      </div>
    </div>
  );
};
