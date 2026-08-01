import React, { useState, useEffect } from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';

interface WorldEventsTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

interface WorldEvent {
  id: string;
  name_en: string;
  name_zh: string;
  offset: string;
  bit: number;
  reverse: boolean;
  verified: boolean;
}

interface EventCategory {
  id: string;
  name_en: string;
  name_zh: string;
  events: WorldEvent[];
}

const WORLD_EVENTS_CATEGORIES: EventCategory[] = [
  {
    id: 'misc',
    name_en: 'Miscellaneous',
    name_zh: '杂项',
    events: [
      { id: 'rite_of_kindling', name_en: 'Rite of Kindling', name_zh: '获得注火秘仪', offset: '0x3', bit: 1, reverse: false, verified: false },
      { id: 'elevators', name_en: 'Elevators', name_zh: '电梯已激活', offset: '0x0', bit: 2, reverse: false, verified: false },
      { id: 'repair_equipment', name_en: 'Repair Equipment', name_zh: '可修理装备', offset: '0x1C', bit: 3, reverse: true, verified: false },
      { id: 'reinforce_weapon', name_en: 'Reinforce Weapon', name_zh: '可强化武器', offset: '0x1C', bit: 5, reverse: true, verified: false },
      { id: 'reinforce_armor', name_en: 'Reinforce Armor', name_zh: '可强化盔甲', offset: '0x1C', bit: 4, reverse: true, verified: false },
      { id: 'anor_londo_dark', name_en: 'Anor Londo Dark', name_zh: '亚诺尔隆德变暗', offset: '0x4631', bit: 7, reverse: true, verified: false },
      { id: 'lava_solidified', name_en: 'Lava Solidified', name_zh: '岩浆凝固', offset: '0x3C67', bit: 7, reverse: true, verified: false },
    ]
  },
  {
    id: 'fog_gates',
    name_en: 'Fog Gates',
    name_zh: '雾门',
    events: [
      { id: 'fog_asylum', name_en: 'Asylum', name_zh: '不死院', offset: '0x5A08', bit: 5, reverse: true, verified: false },
      { id: 'fog_burg1', name_en: 'Undead Burg 1', name_zh: '不死教区 1', offset: '0xF08', bit: 5, reverse: true, verified: false },
      { id: 'fog_burg2', name_en: 'Undead Burg 2', name_zh: '不死教区 2', offset: '0xF08', bit: 4, reverse: true, verified: false },
      { id: 'fog_blighttown', name_en: 'Blighttown', name_zh: '病村', offset: '0x3708', bit: 4, reverse: true, verified: false },
      { id: 'fog_new_londo', name_en: 'New Londo Ruins', name_zh: '小隆德遗迹', offset: '0x4B08', bit: 5, reverse: true, verified: false },
      { id: 'fog_sen1', name_en: "Sen's Fortress 1", name_zh: '塞恩古城 1', offset: '0x4108', bit: 5, reverse: true, verified: false },
      { id: 'fog_sen2', name_en: "Sen's Fortress 2", name_zh: '塞恩古城 2', offset: '0x4108', bit: 4, reverse: true, verified: false },
      { id: 'fog_anor1', name_en: 'Anor Londo 1', name_zh: '亚诺尔隆德 1', offset: '0x4308', bit: 5, reverse: true, verified: false },
      { id: 'fog_anor2', name_en: 'Anor Londo 2', name_zh: '亚诺尔隆德 2', offset: '0x4308', bit: 4, reverse: true, verified: false },
      { id: 'fog_catacombs', name_en: 'Catacombs', name_zh: '墓地', offset: '0x2808', bit: 5, reverse: true, verified: false },
      { id: 'fog_tomb', name_en: 'Tomb of Giants', name_zh: '巨人墓地', offset: '0x2D08', bit: 5, reverse: true, verified: false },
      { id: 'fog_duke', name_en: "Duke's Archives", name_zh: '公爵书库', offset: '0x5009', bit: 4, reverse: true, verified: false },
      { id: 'crest_artorias', name_en: 'Crest of Artorias', name_zh: '亚尔特留斯徽章', offset: '0xD23D', bit: 3, reverse: true, verified: false },
    ]
  },
  {
    id: 'bells',
    name_en: 'Bells',
    name_zh: '钟',
    events: [
      { id: 'bell1', name_en: 'First Bell of Awakening', name_zh: '第一口钟', offset: '0x180', bit: 0, reverse: false, verified: false },
      { id: 'bell2', name_en: 'Second Bell of Awakening', name_zh: '第二口钟', offset: '0x1D1', bit: 0, reverse: false, verified: false },
    ]
  },
];

export const WorldEventsTab: React.FC<WorldEventsTabProps> = ({ character }) => {
  const { lang } = useLang();
  const [eventStates, setEventStates] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const states: Record<string, boolean> = {};
    WORLD_EVENTS_CATEGORIES.forEach(cat => {
      cat.events.forEach(ev => {
        states[ev.id] = character.getWorldEventFlag(ev.offset, ev.bit, ev.reverse);
      });
    });
    setEventStates(states);
  }, [character]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="world-events-tab">
      <h2>{lang === 'zh' ? '世界事件' : 'World Events'}</h2>

      <div className="world-events-disclaimer">
        {lang === 'zh'
          ? '⚠️ 带 ? 的事件尚未验证，可能显示不准确'
          : '⚠️ Events marked with ? are unverified and may not display accurately'}
      </div>

      {WORLD_EVENTS_CATEGORIES.map(cat => {
        const expanded = expandedCategories[cat.id] !== false;
        const verifiedEvents = cat.events.filter(e => e.verified);
        const unverifiedEvents = cat.events.filter(e => !e.verified);
        const activeCount = cat.events.filter(e => eventStates[e.id]).length;

        return (
          <div key={cat.id} className="event-category">
            <div
              className="category-header"
              onClick={() => toggleCategory(cat.id)}
            >
              <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
              <span className="category-name">{lang === 'zh' ? cat.name_zh : cat.name_en}</span>
              <span className="category-count">{activeCount} / {cat.events.length}</span>
            </div>

            {expanded && (
              <div className="event-list">
                {verifiedEvents.map(ev => (
                  <div key={ev.id} className={`event-item ${eventStates[ev.id] ? 'active' : 'inactive'}`}>
                    <span className="event-icon">{eventStates[ev.id] ? '✓' : '○'}</span>
                    <span className="event-name">{lang === 'zh' ? ev.name_zh : ev.name_en}</span>
                  </div>
                ))}
                {unverifiedEvents.length > 0 && (
                  <>
                    <div className="event-divider">
                      {lang === 'zh' ? '未验证' : 'Unverified'}
                    </div>
                    {unverifiedEvents.map(ev => (
                      <div key={ev.id} className={`event-item unverified ${eventStates[ev.id] ? 'active' : 'inactive'}`}>
                        <span className="event-icon">?</span>
                        <span className="event-name">{lang === 'zh' ? ev.name_zh : ev.name_en}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        .world-events-tab {
          padding: 0;
        }

        .world-events-tab h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 0.75rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 107, 53, 0.25);
        }

        .world-events-disclaimer {
          font-size: 0.75rem;
          color: #a07830;
          margin-bottom: 1rem;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 152, 0, 0.06);
          border-radius: 4px;
          border-left: 2px solid rgba(255, 152, 0, 0.3);
        }

        .event-category {
          margin-bottom: 0.75rem;
        }

        .category-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .category-header:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .expand-icon {
          font-size: 0.7rem;
          color: #666;
        }

        .category-name {
          font-size: 0.85rem;
          font-weight: 500;
          color: #c0c0c0;
        }

        .category-count {
          margin-left: auto;
          font-size: 0.75rem;
          color: #666;
        }

        .event-list {
          padding: 0.5rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .event-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.75rem;
          border-radius: 3px;
        }

        .event-item.active {
          background: rgba(76, 175, 80, 0.06);
        }

        .event-item.inactive {
          opacity: 0.4;
        }

        .event-item.unverified {
          opacity: 0.35;
        }

        .event-icon {
          font-size: 0.85rem;
          width: 1.2rem;
          text-align: center;
        }

        .event-item.active .event-icon {
          color: #5a9a5a;
        }

        .event-item.inactive .event-icon {
          color: #666;
        }

        .event-name {
          font-size: 0.8rem;
          color: #c0c0c0;
        }

        .event-divider {
          font-size: 0.7rem;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0.3rem 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  );
};
