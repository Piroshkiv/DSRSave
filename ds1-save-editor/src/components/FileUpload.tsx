import React, { useRef, useEffect, useState } from 'react';
import { settingsHelper } from '../lib/settings';
import { findFirstSL2File } from '../lib/fileSearch';

interface FileUploadProps {
  onFileLoaded: (file: File, fileHandle?: FileSystemFileHandle) => void;
  onAutoLoadAttempt?: (attempting: boolean) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, onAutoLoadAttempt }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoLoadAttemptedRef = useRef(false);
  const [isSearching, setIsSearching] = useState(false);

  // Auto-load from last used file on mount
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    autoLoadAttemptedRef.current = true;

    const tryAutoLoad = async () => {
      // Only works with File System Access API
      if (!('showOpenFilePicker' in window)) return;

      try {
        onAutoLoadAttempt?.(true);

        // Try to get last used file handle
        const lastHandle = await settingsHelper.getLastFileHandle();
        if (!lastHandle) {
          onAutoLoadAttempt?.(false);
          return;
        }

        // Verify we still have permission
        const permission = await (lastHandle as any).queryPermission?.({ mode: 'read' });
        if (permission !== 'granted') {
          // Try to request permission
          const newPermission = await (lastHandle as any).requestPermission?.({ mode: 'read' });
          if (newPermission !== 'granted') {
            console.log('No permission to access last file');
            onAutoLoadAttempt?.(false);
            return;
          }
        }

        // Load the file
        const file = await lastHandle.getFile();
        console.log(`Auto-loading last used file: ${file.name}`);
        onFileLoaded(file, lastHandle);
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
      onFileLoaded(file);
    }
  };

  const handleAutoFind = async () => {
    // Only works with File System Access API
    if (!('showDirectoryPicker' in window)) {
      alert('This feature is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    setIsSearching(true);

    try {
      // Ask user to select a directory (NBGI or DARK SOULS REMASTERED)
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      console.log(`Searching for .sl2 files in: ${dirHandle.name}`);

      // Save this directory for next time (so "Load Save File" can start here)
      await settingsHelper.saveLastDirectory(dirHandle);

      // Search for first .sl2 file
      const result = await findFirstSL2File(dirHandle);

      if (result) {
        const file = await result.fileHandle.getFile();
        console.log(`Found save file: ${result.path.join('/')}`);

        // Save this file handle for next time
        await settingsHelper.saveLastFileHandle(result.fileHandle, file.name);

        onFileLoaded(file, result.fileHandle);
      } else {
        alert('No .sl2 save files found in the selected folder and its subfolders.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Search failed:', err);
        alert('Failed to search for save files. Please try again or use manual selection.');
      }
      // User cancelled - do nothing
    } finally {
      setIsSearching(false);
    }
  };

  const handleButtonClick = async () => {
    // Try to use File System Access API first
    if ('showOpenFilePicker' in window) {
      try {
        // Try to get the last used directory to start the picker there
        const lastDir = await settingsHelper.getLastDirectory();

        const pickerOptions: any = {
          types: [{
            description: 'Dark Souls Save File',
            accept: { 'application/octet-stream': ['.sl2'] }
          }],
          multiple: false
        };

        // If we have a saved directory, start the picker there
        if (lastDir) {
          try {
            // Check if we still have permission to the directory
            const permission = await (lastDir as any).queryPermission?.({ mode: 'read' });
            if (permission === 'granted' || permission === 'prompt') {
              pickerOptions.startIn = lastDir;
              console.log('Starting file picker in last used directory');
            }
          } catch (err) {
            console.warn('Could not use last directory as starting point:', err);
          }
        }

        const [fileHandle] = await window.showOpenFilePicker(pickerOptions);

        const file = await fileHandle.getFile();

        // Save this file handle for next time
        await settingsHelper.saveLastFileHandle(fileHandle, file.name);

        onFileLoaded(file, fileHandle);
        return;
      } catch (err: any) {
        // User cancelled or API not available - fall back to input
        if (err.name !== 'AbortError') {
          console.warn('File System Access API failed, falling back to input:', err);
        } else {
          return; // User cancelled
        }
      }
    }

    // Fallback to traditional file input
    fileInputRef.current?.click();
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

      <div className="button-with-help">
        <button
          className="upload-button auto-find-button"
          onClick={handleAutoFind}
          disabled={isSearching}
        >
          {isSearching ? 'Searching...' : 'Find save in folder'}
        </button>
        <span className="help-icon" title="Select NBGI or DARK SOULS REMASTERED folder. App will search recursively for .sl2 files.">
          ?
        </span>
      </div>
    </div>
  );
};
