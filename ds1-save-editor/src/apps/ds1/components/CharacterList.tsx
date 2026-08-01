import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';

const PLATFORM_LABELS: Record<string, string> = {
  pc: 'PC',
  ps4: 'PS4',
  nintendo: 'Nintendo Switch',
  unknown: 'Unknown',
};

interface CharacterListProps {
  characters: Character[];
  selectedIndex: number | null;
  onSelectCharacter: (index: number) => void;
  platform?: 'pc' | 'nintendo' | 'ps4' | 'unknown' | null;
}

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  selectedIndex,
  onSelectCharacter,
  platform,
}) => {
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const navigate = useNavigate();
  const { lang } = useLang();

  const handleFixSaveClick = () => {
    navigate('/ds1/fix-save');
  };

  const handleMergeExportClick = () => {
    navigate('/ds1/merge-export');
  };

  const nonEmpty = characters.filter(c => !c.isEmpty).length;

  return (
    <div className="character-list">
      {characters.length > 0 && (
        <>
          <div className="char-list-header">
            <span className="char-list-title">{t('characters', lang)}</span>
            <span className="char-list-count">{nonEmpty} / {characters.length}</span>
          </div>
          <div className="character-slots">
            {characters.map((char, index) => (
              <div
                key={index}
                className={`character-slot ${char.isEmpty ? 'empty' : ''} ${selectedIndex === index ? 'selected' : ''}`}
                onClick={() => !char.isEmpty && onSelectCharacter(index)}
              >
                <div className="character-name">
                  {char.isEmpty ? t('emptySlot', lang) : char.name || t('unnamed', lang)}
                </div>
                <div className="character-level">
                  {char.isEmpty ? '' : `${t('levelShort', lang)} ${char.level}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tools Section */}
      <div className="tools-section">
        {platform && (
          <div className="platform-badge">
            {t('platform', lang)} <strong>{PLATFORM_LABELS[platform] ?? platform}</strong>
          </div>
        )}
        <div
          className={`tools-header ${isToolsExpanded ? 'expanded' : ''}`}
          onClick={() => setIsToolsExpanded(!isToolsExpanded)}
        >
          <span>{t('tools', lang)}</span>
          <span className="expand-icon">{isToolsExpanded ? '▼' : '▶'}</span>
        </div>
        {isToolsExpanded && (
          <div className="tools-content">
            <button className="tool-link" onClick={handleFixSaveClick}>
              {t('fixSave', lang)}
            </button>
            <button className="tool-link" onClick={handleMergeExportClick}>
              {t('mergeExport', lang)}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .platform-badge {
          padding: 0.3rem 0.6rem;
          background-color: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 107, 53, 0.2);
          border-radius: 4px;
          color: #666;
          font-size: 0.72rem;
        }

        .platform-badge strong {
          color: #a08050;
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
