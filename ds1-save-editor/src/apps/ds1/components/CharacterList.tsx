import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Character } from '../lib/Character';

interface CharacterListProps {
  characters: Character[];
  selectedIndex: number | null;
  onSelectCharacter: (index: number) => void;
}

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  selectedIndex,
  onSelectCharacter
}) => {
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const navigate = useNavigate();

  const handleFixSaveClick = () => {
    navigate('/ds1/fix-save');
  };

  const handleMergeExportClick = () => {
    navigate('/ds1/merge-export');
  };

  return (
    <div className="character-list">
      {characters.length > 0 && (
        <>
          <h3>Characters</h3>
          <div className="character-slots">
            {characters.map((char, index) => (
              <div
                key={index}
                className={`character-slot ${char.isEmpty ? 'empty' : ''} ${selectedIndex === index ? 'selected' : ''}`}
                onClick={() => !char.isEmpty && onSelectCharacter(index)}
              >
                <div className="character-name">
                  {char.isEmpty ? 'Empty Slot' : char.name || 'Unnamed'}
                </div>
                <div className="character-level">
                  {char.isEmpty ? '' : `Level ${char.level}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tools Section */}
      <div className="tools-section">
        <div
          className={`tools-header ${isToolsExpanded ? 'expanded' : ''}`}
          onClick={() => setIsToolsExpanded(!isToolsExpanded)}
        >
          <span>Tools</span>
          <span className="expand-icon">{isToolsExpanded ? '▼' : '▶'}</span>
        </div>
        {isToolsExpanded && (
          <div className="tools-content">
            <button className="tool-link" onClick={handleFixSaveClick}>
              🔧 Fix Your Save File
            </button>
            <button className="tool-link" onClick={handleMergeExportClick}>
              📦 Merge, Duplicate or Export Save
            </button>
          </div>
        )}
      </div>

      <style>{`
        .tools-section {
          margin-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 0.5rem;
        }

        .tools-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: rgba(255, 107, 53, 0.1);
          border: 1px solid rgba(255, 107, 53, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
        }

        .tools-header:hover {
          background: rgba(255, 107, 53, 0.15);
          border-color: rgba(255, 107, 53, 0.5);
        }

        .tools-header.expanded {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .expand-icon {
          font-size: 0.8rem;
          transition: transform 0.2s;
        }

        .tools-content {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 107, 53, 0.3);
          border-top: none;
          border-bottom-left-radius: 4px;
          border-bottom-right-radius: 4px;
          padding: 0.5rem;
        }

        .tool-link {
          display: block;
          width: 100%;
          padding: 0.75rem;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          color: #fff;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }

        .tool-link:hover {
          background: rgba(255, 107, 53, 0.1);
          border-color: rgba(255, 107, 53, 0.5);
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
};
