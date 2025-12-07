import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { FileHandle } from '../../ds1/lib/adapters';

interface FileUploadProps {
  onFileLoaded: (file: File, fileHandle: FileHandle | null) => void;
  onAutoLoadAttempt?: (attempting: boolean) => void;
}

export interface FileUploadRef {
  openFileDialog: () => void;
}

export const FileUpload = forwardRef<FileUploadRef, FileUploadProps>(({ onFileLoaded }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileLoaded(file, null);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Expose method to parent to trigger file dialog
  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      fileInputRef.current?.click();
    }
  }));

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
        <span className="help-icon" title="Full path: %APPDATA%\DarkSoulsIII\<user_id>\DS30000.sl2">
          ?
        </span>
      </div>
    </div>
  );
});
