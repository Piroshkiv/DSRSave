import React, { useEffect, useMemo, useState } from 'react';
import { Character } from '../lib/Character';
import { Covenant } from '../lib/constants';
import { NpcStateMachineEngine } from '../lib/npcStateMachine';
import { BOSS_IDS } from '../lib/npcStateMachineBossIds';
import { matchesItemSearch } from '../../../shared/items';
import './EntityListTab.css';
import './StateMachineEntityTab.css';

export interface StateMachineEntityTabConfig {
  entityType: 'npc' | 'boss';
  title: string;
  searchPlaceholder: string;
  loadingMessage: string;
  /** Bosses tab shows only BOSS_IDS; NPCs tab shows everything else plus groups. */
  includeGroups: boolean;
}

interface Props {
  character: Character;
  onCharacterUpdate: () => void;
  config: StateMachineEntityTabConfig;
}

/** Blacksmith NPCs whose id/name doesn't already say "Blacksmith" get the
 * old editor's "(Blackmish)" parenthetical appended, matching npc_data.json's
 * (intentionally-kept, matches the old tool exactly) spelling. Giant
 * Blacksmith already says it in the name, so it's left alone. */
const BLACKSMITH_SUFFIXES: Record<string, string> = {
  andre_of_astora: '(Blackmish)',
  rickert_of_vinheim: '(Blackmish)',
  vamos: '(Skeleton Blackmish)',
};

/** Alvina's own hostile toggle was extended to also absolve/reset Shiva's
 * and Bodyguard of Shiva's shared betrayal flags (see project memory,
 * ds1-npc-bug-classes) -- flagged here so it's not mistaken for a toggle
 * that only affects her. */
const HOSTILE_SUFFIXES: Record<string, string> = {
  alvina: '(all covenant)',
};

function prettyId(id: string): string {
  const base = id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const suffix = BLACKSMITH_SUFFIXES[id];
  return suffix ? `${base} ${suffix}` : base;
}

/** Every multi-state axis here (alive/dead, hostile/calm, covenant
 * locked/unlocked) is a real circular linked list: buildCycle() wires each
 * node's `next` to the actual sibling node object, not a second lookup by
 * id, so an axis that ever grows a 3rd state is just a longer defs array and
 * one more `.next` hop -- no redesign. Alive/dead is the one axis still
 * rendered as a single click-to-advance button (ds3-slot-status style);
 * hostile/calm and the covenant lock walk the SAME list via cycleOptions()
 * into a <select> of states plus a "Go" button, same pattern as the
 * quest-stage picker. */
interface CycleNode {
  id: string;
  label: string;
  next: CycleNode;
}

function buildCycle(defs: { id: string; label: string }[]): Record<string, CycleNode> {
  const nodes: Record<string, CycleNode> = {};
  for (const d of defs) nodes[d.id] = { ...d, next: null as unknown as CycleNode };
  defs.forEach((d, i) => { nodes[d.id].next = nodes[defs[(i + 1) % defs.length].id]; });
  return nodes;
}

/** Walks the ring starting at `startId` all the way around once, by
 * following `next` pointers -- this is what feeds the <select> options. */
function cycleOptions(cycle: Record<string, CycleNode>, startId: string): CycleNode[] {
  const out: CycleNode[] = [];
  let n = cycle[startId];
  const start = n;
  do { out.push(n); n = n.next; } while (n !== start);
  return out;
}

const ALIVE_CYCLE = buildCycle([
  { id: 'dead', label: 'Dead' },
  { id: 'alive', label: 'Alive' },
]);

const HOSTILE_CYCLE = buildCycle([
  { id: 'calm', label: 'Non-aggressive' },
  { id: 'hostile', label: 'Aggressive' },
]);

/** Gwyndolin-only: killing him normally locks Blade of the Darkmoon out of
 * the covenant menu. This is a direct read/write of the covenant-available
 * bit (Character.isCovenantAvailable/setCovenantAvailable), not an
 * EventFlag, so unlike alive/hostile it's never "undetected" -- it always
 * reads a real true/false. 'locked' is the node a freshly-killed Gwyndolin
 * would be in, matching vanilla behaviour. */
const COVENANT_CYCLE = buildCycle([
  { id: 'locked', label: 'Covenant Not Available' },
  { id: 'unlocked', label: 'Covenant Available' },
]);

export const StateMachineEntityTab: React.FC<Props> = ({ character, onCharacterUpdate, config }) => {
  const engine = useMemo(() => new NpcStateMachineEngine(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashMap, setFlashMap] = useState<Record<string, 'kill' | 'revive' | 'aggro' | 'calm' | 'stage'>>({});
  const [stagePicker, setStagePicker] = useState<Record<string, string>>({});
  const [hostilePicker, setHostilePicker] = useState<Record<string, string>>({});
  const [covenantPicker, setCovenantPicker] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    engine.load().then(() => { if (mounted) setReady(true); }).catch(err => setError(err.message));
    return () => { mounted = false; };
  }, [engine]);

  const npcIds = useMemo(() => {
    if (!ready) return [];
    return Object.keys(engine.schema.npcs)
      .filter(id => (config.entityType === 'boss') === BOSS_IDS.has(id))
      .sort();
  }, [ready, engine, config.entityType]);

  const groupIds = useMemo(() => {
    if (!ready || !config.includeGroups) return [];
    return Object.keys(engine.schema.npc_groups).sort();
  }, [ready, engine, config.includeGroups]);

  /** NPCs that belong to a group are rendered nested inside that group's
   * card instead of as their own top-level row -- a group is one list
   * element, not a header plus N unrelated-looking rows. */
  const groupedMemberIds = useMemo(() => {
    const s = new Set<string>();
    groupIds.forEach(gid => engine.schema.npc_groups[gid].members.forEach(m => s.add(m)));
    return s;
  }, [groupIds, engine]);

  const flash = (id: string, type: 'kill' | 'revive' | 'aggro' | 'calm' | 'stage') => {
    setFlashMap(prev => ({ ...prev, [id]: type }));
    setTimeout(() => setFlashMap(prev => { const n = { ...prev }; delete n[id]; return n; }), 350);
  };

  const withErrorHandling = (fn: () => void) => {
    try {
      fn();
      onCharacterUpdate();
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  };

  const filteredNpcIds = npcIds
    .filter(id => !groupedMemberIds.has(id))
    .filter(id => matchesItemSearch(prettyId(id), searchQuery));
  const filteredGroupIds = groupIds.filter(id => {
    const group = engine.schema.npc_groups[id];
    const names = [prettyId(id), ...group.members.map(prettyId)];
    return names.some(name => matchesItemSearch(name, searchQuery));
  });

  function renderNpcRow(id: string) {
    const npc = engine.schema.npcs[id];
    const summary = engine.summarize(character, id);
    const f = flashMap[id];
    // non_key_stages (e.g. trusty_patches' forgiven_awaiting_nito) are hidden
    // from the dropdown -- they exist only so detectCurrentStage can fold their
    // flags into their parent's match score (see npcStateMachine.ts); offering
    // them as a separate manual rollback target would just re-surface the same
    // "stage that never shows as itself" confusion.
    const stages = engine.listStages(npc).filter(s => !npc.non_key_stages?.[s.id]);
    const hasAlive = !!npc.status_axes?.alive;
    const hasHostile = !!npc.status_axes?.hostile;
    const isDead = hasAlive && summary.alive === 'false';
    const detectedStage = stages.some(s => s.id === summary.stage) ? summary.stage : undefined;
    const pickedStage = stagePicker[id] ?? detectedStage ?? (stages[0]?.id ?? '');

    return (
      <div key={id} className={`entity-item entity-item--${config.entityType}${f ? ` entity-item--flash-${f}` : ''}`}>
        <div className="entity-info">
          <span className="entity-name">
            {prettyId(id)}
            {npc.coupled_npcs && (
              <span className="warning-icon" title={Object.values(npc.coupled_npcs).join('\n\n')}>⚠️</span>
            )}
          </span>
          <span className="sm-status-line">
            {summary.stage !== 'default' && (
              <span className={`sm-badge sm-badge--${summary.stage === 'unknown' ? 'unknown' : 'stage'}`}>{summary.stage}</span>
            )}
            {hasAlive && summary.alive === 'unknown' && (
              <span className="sm-badge sm-badge--unknown">undetected</span>
            )}
            {hasHostile && !isDead && summary.hostile === 'unknown' && (
              <span className="sm-badge sm-badge--unknown">undetected</span>
            )}
          </span>
        </div>
        <div className="entity-actions sm-actions">
          {hasHostile && !isDead && (() => {
            const options = cycleOptions(HOSTILE_CYCLE, 'calm');
            const detected = summary.hostile === 'true' ? 'hostile' : 'calm';
            const picked = hostilePicker[id] ?? detected;
            return (
              <select
                className="sm-cycle-select"
                value={picked}
                onChange={e => {
                  const next = e.target.value;
                  setHostilePicker(prev => ({ ...prev, [id]: next }));
                  withErrorHandling(() => {
                    engine.axisAction(character, id, 'hostile', next === 'hostile');
                    flash(id, next === 'hostile' ? 'aggro' : 'calm');
                  });
                }}
              >
                {options.map(o => (
                  <option key={o.id} value={o.id}>
                    {HOSTILE_SUFFIXES[id] ? `${o.label} ${HOSTILE_SUFFIXES[id]}` : o.label}
                  </option>
                ))}
              </select>
            );
          })()}
          {id === 'gwyndolin' && isDead && (() => {
            const options = cycleOptions(COVENANT_CYCLE, 'locked');
            const detected = character.isCovenantAvailable(Covenant.DarkmoonBlade) ? 'unlocked' : 'locked';
            const picked = covenantPicker[id] ?? detected;
            return (
              <select
                className="sm-cycle-select"
                value={picked}
                title="Killing Gwyndolin normally locks Blade of the Darkmoon out of the covenant menu — this flag controls that lock directly."
                onChange={e => {
                  const next = e.target.value;
                  setCovenantPicker(prev => ({ ...prev, [id]: next }));
                  withErrorHandling(() => {
                    character.setCovenantAvailable(Covenant.DarkmoonBlade, next === 'unlocked');
                  });
                }}
              >
                {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            );
          })()}
          {!isDead && stages.length > 0 && !npc.stages_read_only && (
            <select
              className="sm-cycle-select"
              value={pickedStage}
              onChange={e => {
                const next = e.target.value;
                setStagePicker(prev => ({ ...prev, [id]: next }));
                withErrorHandling(() => { engine.rollback(character, id, next); flash(id, 'stage'); });
              }}
            >
              {stages.map(s => (
                <option key={s.id} value={s.id}>{prettyId(s.id)}</option>
              ))}
            </select>
          )}
          {hasAlive && (() => {
            const isUndetected = summary.alive === 'unknown';
            const node = ALIVE_CYCLE[summary.alive === 'true' ? 'alive' : 'dead'];
            const actionKey = node.id === 'alive' ? 'kill' : 'revive';
            const actionLabel = node.id === 'alive' ? 'Kill' : 'Revive';
            const flashing = f === 'kill' || f === 'revive';
            return (
              <button
                className={`sm-status-toggle sm-status-toggle--action-${actionKey}${isUndetected ? ' sm-status-toggle--undetected' : ''}${flashing ? ` sm-status-toggle--flash-${f}` : ''}`}
                onClick={() => withErrorHandling(() => {
                  engine.axisAction(character, id, 'alive', node.next.id === 'alive');
                  flash(id, actionKey);
                })}
                title={isUndetected ? "Alive/dead state could not be detected from this save's flags — defaulting to Revive." : undefined}
              >
                <span className="sm-status-toggle-dot" />
                <span>{actionLabel}</span>
              </button>
            );
          })()}
        </div>
      </div>
    );
  }

  /** No group entity, no group name, no group-level control -- a group is
   * just its 2-4 member NPCs' own rows placed next to each other in one
   * block, each keeping its own independent controls. */
  function renderGroupCard(id: string) {
    const group = engine.schema.npc_groups[id];
    return (
      <div key={id} className="entity-group">
        {group.members.map(memberId => renderNpcRow(memberId))}
      </div>
    );
  }

  return (
    <div className={`entity-list-tab entity-list-tab--${config.entityType} state-machine-tab`}>
      <h2>{config.title}</h2>

      <div className="disclaimer">
        Experimental: stage/quest data is reverse-engineered and marked "not verified yet" where it
        has not been confirmed on a real save. Always confirm the game is sitting at the main menu
        before applying a change here.
      </div>

      {!ready && !error && <div className="loading-message">{config.loadingMessage}</div>}
      {error && <div className="error-message">{error}</div>}

      {ready && (
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder={config.searchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <div className="entity-list">
        {filteredNpcIds.map(id => renderNpcRow(id))}

        {filteredGroupIds.map(id => renderGroupCard(id))}
      </div>
    </div>
  );
};
