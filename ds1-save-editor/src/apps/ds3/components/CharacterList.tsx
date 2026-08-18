import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DS3Character } from '../lib/Character';

interface CharacterListProps {
  characters: DS3Character[];
  selectedIndex: number | null;
  onSelectCharacter: (index: number) => void;
  isSlotActive: (slotIndex: number) => boolean;
  /** Stored backups per slot — an empty slot with history stays clickable. */
  backupCounts?: Record<number, number>;
}

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  selectedIndex,
  onSelectCharacter,
  isSlotActive,
  backupCounts,
}) => {
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const navigate = useNavigate();

  const activeCount = characters.filter((_, i) => isSlotActive(i)).length;

  return (
    <div className="character-list">
      <div className="char-list-header">
        <span className="char-list-title">Characters</span>
        <span className="char-list-count">{activeCount} / {characters.length}</span>
      </div>
      <div className="character-slots">
        {characters.map((char, index) => {
          const active = isSlotActive(index);
          const hasData = !char.isEmpty;
          const isDeleted = hasData && !active;
          const backups = backupCounts?.[char.slotIndex] ?? 0;
          const isClickable = hasData || backups > 0;

          return (
            <div
              key={index}
              className={`character-slot${char.isEmpty ? ' empty' : ''}${isDeleted ? ' deleted' : ''}${selectedIndex === index ? ' selected' : ''}${char.isEmpty && backups > 0 ? ' has-backups' : ''}`}
              onClick={() => isClickable && onSelectCharacter(index)}
            >
              <div className="character-name">
                {char.isEmpty
                  ? 'Empty Slot'
                  : (char.name || 'Unnamed')}
                {isDeleted && <span className="character-deleted-badge"> (Deleted)</span>}
              </div>
              <div className="character-level">
                {hasData ? `Lv ${char.level}` : ''}
              </div>
            </div>
          );
        })}
      </div>

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
            <button className="tool-link" onClick={() => navigate('/ds3/merge-export')}>
              Merge / Export Slots
            </button>
          </div>
        )}
      </div>

      <style>{`
        /* An empty slot that still has backups is a valid destination to restore
           into, so it stays lit and clickable unlike a plain empty slot */
        .character-slot.empty.has-backups {
          opacity: 0.7;
          cursor: pointer;
        }

        .character-slot.empty.has-backups:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .tools-section {
          margin-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 0.5rem;
        }

        .tools-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0.65rem;
          background: rgba(255, 107, 53, 0.06);
          border: 1px solid rgba(255, 107, 53, 0.18);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
          font-size: 0.8rem;
          color: #888;
        }

        .tools-header:hover {
          background: rgba(255, 107, 53, 0.1);
          border-color: rgba(255, 107, 53, 0.35);
          color: #bbb;
        }

        .tools-header.expanded {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .expand-icon {
          font-size: 0.7rem;
          transition: transform 0.2s;
        }

        .tools-content {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 107, 53, 0.18);
          border-top: none;
          border-bottom-left-radius: 4px;
          border-bottom-right-radius: 4px;
          padding: 0.35rem;
        }

        .tool-link {
          display: block;
          width: 100%;
          padding: 0.5rem 0.65rem;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          color: #aaa;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 0.8rem;
        }

        .tool-link:hover {
          background: rgba(255, 107, 53, 0.07);
          border-color: rgba(255, 107, 53, 0.35);
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
};
