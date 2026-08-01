import React, { useState, useEffect, useMemo } from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { ProgressAnalyzer, GamePhase, PlayerProgress } from '../lib/progressAnalyzer';
import { STORYLINES, Storyline, getStorylineForPhase } from '../lib/storylines';

interface HelpTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

interface GuideButton {
  id: string;
  icon: string;
  name_en: string;
  name_zh: string;
}

const GUIDE_BUTTONS: GuideButton[] = [
  { id: 'where_to_go', icon: '🗺️', name_en: "I don't know where to go", name_zh: '我不知道现在去哪里' },
  { id: 'boss_help', icon: '⚔️', name_en: "I can't beat this boss", name_zh: '我打不过这个BOSS' },
  { id: 'upgrade_gear', icon: '🔧', name_en: 'What equipment to upgrade', name_zh: '该升级什么装备' },
  { id: 'find_gear', icon: '🛡️', name_en: 'Where to find equipment', name_zh: '什么装备该去哪里获取' },
];

// 阶段名称映射
const PHASE_NAMES: Record<GamePhase, { en: string; zh: string }> = {
  [GamePhase.Start]: { en: 'Beginning', zh: '起始' },
  [GamePhase.ReturnToAsylum]: { en: 'Return to Asylum', zh: '重返北方不死院' },
  [GamePhase.UndeadBurg]: { en: 'Undead Burg', zh: '不死镇' },
  [GamePhase.UndeadParish]: { en: 'Undead Parish', zh: '不死人教区' },
  [GamePhase.AfterBell1]: { en: 'After First Bell', zh: '敲响第一口钟后' },
  [GamePhase.Depths]: { en: 'The Depths', zh: '下水道' },
  [GamePhase.Blighttown]: { en: 'Blighttown', zh: '病村' },
  [GamePhase.AfterBell2]: { en: 'After Second Bell', zh: '敲响第二口钟后' },
  [GamePhase.SensFortress]: { en: "Sen's Fortress", zh: '赛恩古城' },
  [GamePhase.AnorLondo]: { en: 'Anor Londo', zh: '亚诺尔隆德' },
  [GamePhase.AfterOrnsteinSmough]: { en: 'After Ornstein & Smough', zh: '击败翁斯坦与斯摩后' },
  [GamePhase.ObtainedLordvessel]: { en: 'Obtained Lordvessel', zh: '获得王器' },
  [GamePhase.SeekingLordSouls]: { en: 'Seeking Lord Souls', zh: '收集薪王灵魂' },
  [GamePhase.AllLordSouls]: { en: 'All Lord Souls', zh: '所有薪王灵魂' },
  [GamePhase.ReadyForKiln]: { en: 'Ready for Kiln', zh: '准备前往初火之炉' },
  [GamePhase.GameComplete]: { en: 'Game Complete', zh: '游戏完成' },
};

// Boss名称映射
const BOSS_NAMES: Record<string, { en: string; zh: string }> = {
  asylumDemon: { en: 'Asylum Demon', zh: '不死院恶魔' },
  taurusDemon: { en: 'Taurus Demon', zh: '牛头恶魔' },
  bellGargoyles: { en: 'Bell Gargoyles', zh: '钟楼石像鬼' },
  capraDemon: { en: 'Capra Demon', zh: '羊头恶魔' },
  gapingDragon: { en: 'Gaping Dragon', zh: '贪食魔龙' },
  queelaag: { en: 'Chaos Witch Quelaag', zh: '混沌魔女克拉格' },
  ironGolem: { en: 'Iron Golem', zh: '钢铁巨偶' },
  ornsteinAndSmough: { en: 'Ornstein & Smough', zh: '翁斯坦与斯摩' },
  moonlightButterfly: { en: 'Moonlight Butterfly', zh: '月光蝶' },
  sif: { en: 'Great Grey Wolf Sif', zh: '大狼希夫' },
  pinwheel: { en: 'Pinwheel', zh: '三面魔' },
  nito: { en: 'Gravelord Nito', zh: '墓王尼特' },
  seath: { en: 'Seath the Scaleless', zh: '白龙希斯' },
  fourKings: { en: 'Four Kings', zh: '小隆德四王' },
  BedOfChaos: { en: 'Bed of Chaos', zh: '混沌温床' },
  gwyn: { en: 'Gwyn, Lord of Cinder', zh: '乌薪王葛温' },
  sanctuaryGuardian: { en: 'Sanctuary Guardian', zh: '庇护所守护者' },
  artorias: { en: 'Artorias', zh: '深渊漫步者阿尔特留斯' },
  kalameet: { en: 'Black Dragon Kalameet', zh: '黑龙卡拉米特' },
  manus: { en: 'Manus', zh: '深渊之主马努斯' },
};

export const HelpTab: React.FC<HelpTabProps> = ({ character }) => {
  const { lang } = useLang();
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedNpcs, setExpandedNpcs] = useState<Set<string>>(new Set());

  const analyzer = useMemo(() => new ProgressAnalyzer(character), [character]);

  // 加载进度
  useEffect(() => {
    const loadProgress = async () => {
      setLoading(true);
      try {
        const p = await analyzer.analyzeProgress();
        setProgress(p);
      } catch (error) {
        console.error('Failed to analyze progress:', error);
      } finally {
        setLoading(false);
      }
    };

    if (activeGuide === 'where_to_go') {
      loadProgress();
    }
  }, [character, activeGuide, analyzer]);

  const handleGuideClick = (id: string) => {
    setActiveGuide(prev => prev === id ? null : id);
    setExpandedItem(null);
    setExpandedNpcs(new Set());
  };

  const handleItemExpand = (id: string) => {
    setExpandedItem(prev => prev === id ? null : id);
  };

  const handleNpcExpand = (id: string) => {
    setExpandedNpcs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 获取当前阶段的推荐故事线
  const getRecommendedStoryline = (): Storyline | null => {
    if (!progress) return null;

    // 根据阶段查找推荐故事线，传递bossesDefeated用于更精确的判断
    const storyline = getStorylineForPhase(progress.phase, progress.bossesDefeated);
    if (storyline) return storyline;

    // 如果没有找到，遍历所有故事线查找匹配的阶段
    for (const s of STORYLINES) {
      if (s.prerequisities.includes(progress.phase)) {
        return s;
      }
    }

    return null;
  };

  // 获取已完成的Boss列表
  const getDefeatedBosses = (): string[] => {
    if (!progress) return [];

    const defeated: string[] = [];
    const bosses = progress.bossesDefeated;

    Object.entries(bosses).forEach(([key, value]) => {
      if (value && BOSS_NAMES[key]) {
        defeated.push(lang === 'zh' ? BOSS_NAMES[key].zh : BOSS_NAMES[key].en);
      }
    });

    return defeated;
  };

  // 过滤玩家拥有的物品
  const getAvailableItems = (storyline: Storyline) => {
    if (!progress) return storyline.items;

    // 过滤掉玩家没有的物品
    return storyline.items.filter(item => {
      // 如果没有requiredItemIds，始终显示
      if (!item.requiredItemIds || item.requiredItemIds.length === 0) {
        return true;
      }

      // 检查玩家是否拥有所需的物品
      return item.requiredItemIds.every(id => progress.ownedItemIds.includes(id));
    });
  };

  // 获取未探索的可选区域列表
  const getOptionalAreasRemaining = (): { areaId: string; name_en: string; name_zh: string; hint_en: string; hint_zh: string; npcDialogue?: { name_en: string; name_zh: string; dialogue_en: string; dialogue_zh: string } }[] => {
    if (!progress) return [];

    const optionalAreas = [
      {
        areaId: 'darkroot',
        name_en: 'Darkroot Garden',
        name_zh: '黑森林庭院',
        hint_en: 'A mystical forest guarded by ancient stone knights. The moonlight shines through the canopy, and a great wolf protects the grave of a legendary knight.',
        hint_zh: '一片被远古石骑士守护的神秘森林。月光透过树冠洒落，一只巨狼守护着传奇骑士的坟墓。',
        bosses: ['moonlightButterfly', 'sif'],
        npcDialogue: {
          name_en: 'Alvina',
          name_zh: '雅薇娜',
          dialogue_en: "I am Alvina, of the Darkroot Wood. ... Sif, the great grey wolf, guards the grave of Knight Artorias. He will not let you pass easily.",
          dialogue_zh: '我是雅薇娜，来自黑森林庭院。......大狼希夫守护着骑士亚尔特留斯的坟墓。他不会轻易让你通过。',
        },
      },
      {
        areaId: 'catacombs',
        name_en: 'The Catacombs',
        name_zh: '墓地',
        hint_en: 'A dark and labyrinthine underground crypt filled with skeletons. Somewhere deep below, the Lord of the Dead awaits in eternal darkness.',
        hint_zh: '一个黑暗迷宫般的地下墓穴，充满了骷髅。在深处的某个地方，死亡之主在永恒的黑暗中等待。',
        bosses: ['pinwheel'],
        npcDialogue: {
          name_en: 'Patches',
          name_zh: '帕奇',
          dialogue_en: "You're heading to the Tomb of Giants? Nito is down there, you know. The First of the Dead. He's powerful, and the darkness is absolute. Bring a light, or you'll be eaten alive.",
          dialogue_zh: '你要去巨人墓地？尼特就在下面，你知道的。最初的死者。他很强大，黑暗是绝对的。带上光源，否则你会被活活吃掉。',
        },
      },
      {
        areaId: 'oolacile',
        name_en: 'Oolacile (DLC)',
        name_zh: '乌拉席露（DLC）',
        hint_en: 'A lost city from the ancient past, accessible through a dark portal. Here, the legacy of Knight Artorias and the tragedy of the Abyss can be uncovered.',
        hint_zh: '一座来自远古的失落之城，通过黑暗传送门进入。在这里，可以揭开骑士亚尔特留斯的遗产和深渊的悲剧。',
        bosses: ['sanctuaryGuardian', 'artorias', 'kalameet', 'manus'],
        npcDialogue: {
          name_en: 'Dusk of Oolacile',
          name_zh: '乌拉席露的黄昏',
          dialogue_en: "Thank you for rescuing me. I am Dusk of Oolacile. ... Oolacile was a city of ancient magic, where sorceries were born. But it was destroyed by the Abyss.",
          dialogue_zh: '谢谢你救了我。我是乌拉席露的黄昏。......乌拉席露是一座古老的魔法之城，那里是魔法的起源。但它被深渊摧毁了。',
        },
      },
    ];

    // 检查哪些区域还有未击败的Boss
    // 特殊处理：如果亚尔特留斯已经被击败，乌拉席露区域不再显示
    return optionalAreas.filter(area => {
      // 如果是乌拉席露区域，且亚尔特留斯已被击败，则不显示
      if (area.areaId === 'oolacile' && progress.bossesDefeated.artorias) {
        return false;
      }
      // 检查该区域是否还有未击败的Boss
      return area.bosses.some(boss => !progress.bossesDefeated[boss as keyof typeof progress.bossesDefeated]);
    });
  };

  // 渲染"我不知道现在去哪里"内容
  const renderWhereToGo = () => {
    if (loading) {
      return (
        <div className="guide-loading">
          {lang === 'zh' ? '分析进度中...' : 'Analyzing progress...'}
        </div>
      );
    }

    if (!progress) {
      return (
        <div className="guide-error">
          {lang === 'zh' ? '无法读取进度' : 'Unable to read progress'}
        </div>
      );
    }

    const recommended = getRecommendedStoryline();
    const defeatedBosses = getDefeatedBosses();
    const phaseName = PHASE_NAMES[progress.phase];

    return (
      <div className="guide-where-to-go">
        {/* 当前进度概览 */}
        <div className="progress-section">
          <h3>{lang === 'zh' ? '当前进度' : 'Current Progress'}</h3>
          <div className="progress-phase">
            {lang === 'zh' ? '阶段：' : 'Phase: '}
            <span className="phase-name">
              {lang === 'zh' ? phaseName.zh : phaseName.en}
            </span>
          </div>

          {defeatedBosses.length > 0 && (
            <div className="defeated-bosses">
              <span className="bosses-label">
                {lang === 'zh' ? '已击败Boss：' : 'Defeated Bosses: '}
              </span>
              <span className="bosses-list">
                {defeatedBosses.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* 推荐行动 */}
        {recommended && (
          <div className="recommendation-section">
            <h3>{lang === 'zh' ? '推荐行动' : 'Recommended Action'}</h3>
            <div className="recommendation-card">
              <div className="recommendation-title">
                {lang === 'zh' ? recommended.name_zh : recommended.name_en}
              </div>
              <div className="recommendation-theme">
                {lang === 'zh' ? recommended.theme_zh : recommended.theme_en}
              </div>
              <div className="recommendation-text">
                {lang === 'zh' ? recommended.recommendation_zh : recommended.recommendation_en}
              </div>
              <div className="recommendation-reason">
                <span className="reason-label">
                  {lang === 'zh' ? '原因：' : 'Reason: '}
                </span>
                {lang === 'zh' ? recommended.reason_zh : recommended.reason_en}
              </div>

              {/* 道具指引 */}
              {getAvailableItems(recommended).length > 0 && (
                <div className="items-section">
                  <div className="items-header">
                    {lang === 'zh' ? '推荐阅读道具' : 'Recommended Items to Read'}
                  </div>
                  {getAvailableItems(recommended).map(item => (
                    <div key={item.id} className="item-card">
                      <div className="item-name">
                        {lang === 'zh' ? item.name_zh : item.name_en}
                      </div>
                      <div className="item-hint">
                        {lang === 'zh' ? item.hint_zh : item.hint_en}
                      </div>
                      <button
                        className="expand-btn"
                        onClick={() => handleItemExpand(item.id)}
                      >
                        {expandedItem === item.id
                          ? (lang === 'zh' ? '收起详情' : 'Hide Details')
                          : (lang === 'zh' ? '查看详情' : 'Show Details')
                        }
                      </button>
                      {expandedItem === item.id && (
                        <div className="item-description">
                          {lang === 'zh' ? item.description_zh : item.description_en}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* NPC对话指引 */}
              {recommended.npcDialogues && recommended.npcDialogues.length > 0 && (
                <div className="npc-section">
                  <div className="npc-header">
                    {lang === 'zh' ? 'NPC指引' : 'NPC Guidance'}
                  </div>
                  {recommended.npcDialogues.map((npc, index) => {
                    const npcId = `${npc.npcName_en}_${index}`;
                    const dialogue = lang === 'zh' ? npc.dialogue_zh : npc.dialogue_en;
                    const isShortDialogue = dialogue.length <= 100; // 短对话直接显示
                    const isExpanded = expandedNpcs.has(npcId);

                    return (
                      <div key={index} className="npc-card">
                        <div className="npc-name">
                          {lang === 'zh' ? npc.npcName_zh : npc.npcName_en}
                        </div>
                        <div className="npc-location">
                          {lang === 'zh' ? npc.location_zh : npc.location_en}
                        </div>

                        {isShortDialogue ? (
                          // 短对话直接显示
                          <div className="npc-dialogue-full">
                            {dialogue}
                          </div>
                        ) : (
                          // 长对话显示预览和展开按钮
                          <>
                            {!isExpanded && (
                              <div className="npc-dialogue-preview">
                                {dialogue.substring(0, 100) + '...'}
                              </div>
                            )}
                            <button
                              className="expand-btn"
                              onClick={() => handleNpcExpand(npcId)}
                            >
                              {isExpanded
                                ? (lang === 'zh' ? '收起对话' : 'Hide Dialogue')
                                : (lang === 'zh' ? '查看完整对话' : 'Show Full Dialogue')
                              }
                            </button>
                            {isExpanded && (
                              <div className="npc-dialogue-full">
                                {dialogue}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 可选区域提示 - 只在ReadyForKiln阶段显示 */}
        {progress.phase === GamePhase.ReadyForKiln && getOptionalAreasRemaining().length > 0 && (
          <div className="optional-bosses-section">
            <h3>{lang === 'zh' ? '可探索区域' : 'Optional Areas'}</h3>
            <div className="optional-bosses-card">
              <div className="optional-bosses-intro">
                {lang === 'zh'
                  ? '除了主线任务外，罗德兰大陆上还有一些未被探索的区域。这些地方隐藏着古老的秘密和强大的力量，等待着勇敢的冒险者去发掘。'
                  : 'Beyond the main path, unexplored regions of Lordran await. These places hide ancient secrets and powerful forces, waiting for brave adventurers to uncover them.'
                }
              </div>
              {getOptionalAreasRemaining().map((area, index) => (
                <div key={index} className="optional-area-item">
                  <div className="optional-area-header">
                    <div className="optional-area-name">
                      {lang === 'zh' ? area.name_zh : area.name_en}
                    </div>
                  </div>
                  <div className="optional-area-hint">
                    {lang === 'zh' ? area.hint_zh : area.hint_en}
                  </div>
                  {area.npcDialogue && (
                    <div className="optional-area-npc">
                      <div className="optional-area-npc-name">
                        {lang === 'zh' ? area.npcDialogue.name_zh : area.npcDialogue.name_en}
                      </div>
                      <div className="optional-area-npc-dialogue">
                        {lang === 'zh' ? area.npcDialogue.dialogue_zh : area.npcDialogue.dialogue_en}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 无推荐时的提示 */}
        {!recommended && progress.phase === GamePhase.GameComplete && (
          <div className="completion-message">
            <div className="completion-icon">🎉</div>
            <div className="completion-text">
              {lang === 'zh'
                ? '恭喜！你已完成黑暗之魂的主线剧情。'
                : 'Congratulations! You have completed the main storyline of Dark Souls.'
              }
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="help-tab">
      <h2>{lang === 'zh' ? '游戏帮助' : 'Game Guide'}</h2>

      <div className="guide-buttons">
        {GUIDE_BUTTONS.map(btn => (
          <button
            key={btn.id}
            className={`guide-btn ${activeGuide === btn.id ? 'active' : ''}`}
            onClick={() => handleGuideClick(btn.id)}
          >
            <span className="guide-btn-icon">{btn.icon}</span>
            <span className="guide-btn-text">{lang === 'zh' ? btn.name_zh : btn.name_en}</span>
          </button>
        ))}
      </div>

      {activeGuide && (
        <div className="guide-content">
          {activeGuide === 'where_to_go' && renderWhereToGo()}
          {activeGuide !== 'where_to_go' && (
            <div className="guide-placeholder">
              {lang === 'zh' ? '功能开发中...' : 'Coming soon...'}
            </div>
          )}
        </div>
      )}

      <style>{`
        .help-tab {
          padding: 0;
        }

        .help-tab h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #c0c0c0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 0.75rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 107, 53, 0.25);
        }

        .guide-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .guide-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          color: #b0b0b0;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .guide-btn:hover {
          background: rgba(255, 107, 53, 0.1);
          border-color: rgba(255, 107, 53, 0.3);
          color: #e0e0e0;
        }

        .guide-btn.active {
          background: rgba(255, 107, 53, 0.15);
          border-color: rgba(255, 107, 53, 0.4);
          color: #ff6b35;
        }

        .guide-btn-icon {
          font-size: 0.9rem;
        }

        .guide-btn-text {
          white-space: nowrap;
        }

        .guide-content {
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 4px;
        }

        .guide-placeholder {
          font-size: 0.8rem;
          color: #666;
          text-align: center;
          padding: 1.5rem;
          font-style: italic;
        }

        .guide-loading, .guide-error {
          font-size: 0.8rem;
          color: #888;
          text-align: center;
          padding: 1rem;
        }

        .guide-where-to-go {
          font-size: 0.8rem;
          color: #b0b0b0;
        }

        .progress-section {
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .progress-section h3 {
          font-size: 0.85rem;
          font-weight: 600;
          color: #c0c0c0;
          margin: 0 0 0.5rem;
        }

        .progress-phase {
          margin-bottom: 0.5rem;
        }

        .phase-name {
          color: #ff6b35;
          font-weight: 500;
        }

        .defeated-bosses, .undefeated-bosses {
          font-size: 0.75rem;
          color: #888;
          margin-bottom: 0.25rem;
        }

        .bosses-label {
          color: #666;
        }

        .bosses-list {
          color: #999;
        }

        .undefeated-bosses .bosses-list {
          color: #ff6b35;
        }

        .recommendation-section {
          margin-bottom: 1rem;
        }

        .recommendation-section h3 {
          font-size: 0.85rem;
          font-weight: 600;
          color: #c0c0c0;
          margin: 0 0 0.5rem;
        }

        .recommendation-card {
          background: rgba(255, 107, 53, 0.05);
          border: 1px solid rgba(255, 107, 53, 0.15);
          border-radius: 4px;
          padding: 0.75rem;
        }

        .recommendation-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #ff6b35;
          margin-bottom: 0.25rem;
        }

        .recommendation-theme {
          font-size: 0.75rem;
          color: #888;
          font-style: italic;
          margin-bottom: 0.5rem;
        }

        .recommendation-text {
          font-size: 0.8rem;
          color: #b0b0b0;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .recommendation-reason {
          font-size: 0.75rem;
          color: #888;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .reason-label {
          color: #666;
        }

        .items-section, .npc-section {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .items-header, .npc-header {
          font-size: 0.8rem;
          font-weight: 500;
          color: #c0c0c0;
          margin-bottom: 0.5rem;
        }

        .item-card, .npc-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 3px;
          padding: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .item-name, .npc-name {
          font-size: 0.8rem;
          font-weight: 500;
          color: #d0d0d0;
          margin-bottom: 0.25rem;
        }

        .npc-location {
          font-size: 0.7rem;
          color: #888;
          margin-bottom: 0.25rem;
        }

        .item-hint, .npc-dialogue-preview {
          font-size: 0.75rem;
          color: #888;
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .expand-btn {
          font-size: 0.7rem;
          color: #ff6b35;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
        }

        .expand-btn:hover {
          color: #ff8c5a;
        }

        .item-description, .npc-dialogue-full {
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          font-size: 0.75rem;
          color: #999;
          line-height: 1.5;
          white-space: pre-line;
        }

        .optional-bosses-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .optional-bosses-section h3 {
          font-size: 0.85rem;
          font-weight: 600;
          color: #c0c0c0;
          margin: 0 0 0.5rem;
        }

        .optional-bosses-card {
          background: rgba(100, 149, 237, 0.05);
          border: 1px solid rgba(100, 149, 237, 0.15);
          border-radius: 4px;
          padding: 0.75rem;
        }

        .optional-bosses-intro {
          font-size: 0.75rem;
          color: #888;
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }

        .optional-area-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 3px;
          padding: 0.6rem;
          margin-bottom: 0.5rem;
        }

        .optional-area-item:last-child {
          margin-bottom: 0;
        }

        .optional-area-header {
          margin-bottom: 0.4rem;
        }

        .optional-area-name {
          font-size: 0.85rem;
          color: #6495ED;
          font-weight: 500;
        }

        .optional-area-hint {
          font-size: 0.75rem;
          color: #999;
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .optional-area-npc {
          background: rgba(255, 107, 53, 0.05);
          border-left: 2px solid rgba(255, 107, 53, 0.3);
          padding-left: 0.5rem;
          margin-top: 0.5rem;
        }

        .optional-area-npc-name {
          font-size: 0.7rem;
          color: #ff6b35;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .optional-area-npc-dialogue {
          font-size: 0.7rem;
          color: #888;
          line-height: 1.4;
          font-style: italic;
        }

        .completion-message {
          text-align: center;
          padding: 1.5rem;
        }

        .completion-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .completion-text {
          font-size: 0.9rem;
          color: #b0b0b0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};
