import React from 'react';
import { SaveFileEditor } from '../lib/SaveFileEditor';
import { getFileSystemAdapter } from '../lib/adapters';

interface DualFileUploadProps {
  onSourceLoaded: (editor: SaveFileEditor) => void;
  onDestinationLoaded: (editor: SaveFileEditor) => void;
  onError?: (message: string) => void;
  sourceLoaded: boolean;
  destinationLoaded: boolean;
}

export const DualFileUpload: React.FC<DualFileUploadProps> = ({
  onSourceLoaded,
  onDestinationLoaded,
  onError,
  sourceLoaded,
  destinationLoaded
}) => {

  const handleSourceClick = async () => {
    try {
      const adapter = getFileSystemAdapter();
      const fileData = await adapter.openFile();
      const editor = await SaveFileEditor.fromFileData(fileData.file, fileData.handle);
      onSourceLoaded(editor);
    } catch (error: any) {
      if (error.message !== 'User cancelled file selection') {
        console.error('Error loading source save file:', error);
        if (onError) {
          onError(`Error loading source file:\n${error.message || 'Please make sure it is a valid Dark Souls save file (.sl2).'}`);
        }
      }
    }
  };

  const handleDestinationClick = async () => {
    try {
      const adapter = getFileSystemAdapter();
      const fileData = await adapter.openFile();
      const editor = await SaveFileEditor.fromFileData(fileData.file, fileData.handle);
      onDestinationLoaded(editor);
    } catch (error: any) {
      if (error.message !== 'User cancelled file selection') {
        console.error('Error loading destination save file:', error);
        if (onError) {
          onError(`Error loading destination file:\n${error.message || 'Please make sure it is a valid Dark Souls save file (.sl2).'}`);
        }
      }
    }
  };

  return (
    <div className="dual-file-upload">
      <div className="file-upload-section">
        <button className="load-button source-button" onClick={handleSourceClick}>
          {sourceLoaded ? '✓ Source File Loaded' : 'Load Source File'}
        </button>
      </div>

      <div className="file-upload-section">
        <button className="load-button dest-button" onClick={handleDestinationClick}>
          {destinationLoaded ? '✓ Destination File Loaded' : 'Load Destination File'}
        </button>
      </div>

      <style>{`
        .dual-file-upload {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .file-upload-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .load-button {
          padding: 0.875rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border: 2px solid;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .source-button {
          background: rgba(255, 107, 53, 0.15);
          border-color: rgba(255, 107, 53, 0.5);
          color: #ff6b35;
        }

        .source-button:hover {
          background: rgba(255, 107, 53, 0.25);
          border-color: #ff6b35;
          transform: translateY(-2px);
        }

        .dest-button {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.5);
          color: #3b82f6;
        }

        .dest-button:hover {
          background: rgba(59, 130, 246, 0.25);
          border-color: #3b82f6;
          transform: translateY(-2px);
        }

        .load-button:active {
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .dual-file-upload {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
};
