import React, { useState, useEffect, useMemo } from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { Npc } from '../types/npc';
import { NpcEditor } from '../lib/npc';
import './EntityListTab.css';

export interface EntityListTabConfig {
  entityType: 'boss' | 'npc';
  title: string;
  filterFn: (npc: Npc) => boolean;
  nameTransform?: (name: string) => string;
  searchPlaceholder: string;
  loadingMessage: string;
  readState?: boolean;
  showOnlyDead?: boolean;
}

interface EntityListTabProps {
  character: Character;
  onCharacterUpdate: () => void;
  config: EntityListTabConfig;
}

/**
 * Generic component for displaying and managing a list of entities (bosses or NPCs).
 * Uses NpcEditor as single source of truth for data loading.
 */
export const EntityListTab: React.FC<EntityListTabProps> = ({ character, onCharacterUpdate, config }) => {
  const { lang } = useLang();
  const npcEditor = useMemo(() => new NpcEditor(character), [character]);
  const [entities, setEntities] = useState<Npc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashMap, setFlashMap] = useState<Record<string, 'kill' | 'revive'>>({});

  const loadEntities = async () => {
    try {
      // Load data through NpcEditor (single source of truth with caching)
      const npcCollection = await npcEditor.loadNpcData();

      // Filter entities based on config
      let entityList = npcCollection.npcs.filter(config.filterFn);

      // If showOnlyDead, filter to only killed entities
      if (config.showOnlyDead) {
        entityList = entityList.filter(entity => {
          try {
            return !npcEditor.getNpcAlive(entity.name);
          } catch {
            return false;
          }
        });
      }

      setEntities(entityList);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntities();
  }, [character]);

  const flash = (name: string, type: 'kill' | 'revive') => {
    setFlashMap(prev => ({ ...prev, [name]: type }));
    setTimeout(() => setFlashMap(prev => { const n = { ...prev }; delete n[name]; return n; }), 350);
  };

  const handleRevive = (entity: Npc) => {
    try {
      if (!character || typeof npcEditor.setNpcAlive !== 'function') {
        setError(`Character method not available. Type: ${typeof character}, setNpcAlive: ${typeof npcEditor?.setNpcAlive}`);
        console.error('Character object:', character);
        return;
      }
      npcEditor.setNpcAlive(entity.name, true);
      flash(entity.name, 'revive');
      onCharacterUpdate();
    } catch (err: any) {
      console.error(`Error reviving ${config.entityType}:`, err);
      setError(err.message || `Failed to revive ${config.entityType}`);
    }
  };

  const handleKill = (entity: Npc) => {
    try {
      if (!character || typeof npcEditor.setNpcAlive !== 'function') {
        setError(`Character method not available. Type: ${typeof character}, setNpcAlive: ${typeof npcEditor?.setNpcAlive}`);
        console.error('Character object:', character);
        return;
      }
      npcEditor.setNpcAlive(entity.name, false);
      flash(entity.name, 'kill');
      onCharacterUpdate();
    } catch (err: any) {
      console.error(`Error killing ${config.entityType}:`, err);
      setError(err.message || `Failed to kill ${config.entityType}`);
    }
  };

  const filteredEntities = entities.filter(entity =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`entity-list-tab entity-list-tab--${config.entityType}`}>
      <h2>{config.title}</h2>

      <div
        className="disclaimer"
        dangerouslySetInnerHTML={{
          __html: t('disclaimer', lang).replace('Discord', '<a href="https://discord.com/invite/FZuCXNcUWA" target="_blank" rel="noopener noreferrer">Discord</a>')
        }}
      />

      {loading && (
        <div className="loading-message">
          {config.loadingMessage}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder={config.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="entity-list">
        {filteredEntities.map((entity, index) => {
          const f = flashMap[entity.name];
          return (
            <div
              key={index}
              className={`entity-item entity-item--${config.entityType}${f ? ` entity-item--flash-${f}` : ''}`}
            >
              <div className="entity-info">
                <span className="entity-name">
                  {lang === 'zh' && entity.displayName ? entity.displayName : (config.nameTransform ? config.nameTransform(entity.name) : entity.name)}
                  {entity.warning && (
                    <span className="warning-icon" title={entity.warning}>⚠️</span>
                  )}
                </span>
              </div>
              <div className="entity-actions">
                <button
                  className={`kill-button${f === 'kill' ? ' kill-button--flash' : ''}`}
                  onClick={() => handleKill(entity)}
                >
                  {t('kill', lang)}
                </button>
                <button
                  className={`revive-button${f === 'revive' ? ' revive-button--flash' : ''}`}
                  onClick={() => handleRevive(entity)}
                >
                  {t('revive', lang)}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
