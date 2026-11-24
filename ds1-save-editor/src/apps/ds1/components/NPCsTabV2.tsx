import React from 'react';
import { Character } from '../lib/Character';
import { StateMachineEntityTab, StateMachineEntityTabConfig } from './StateMachineEntityTab';

interface Props {
  character: Character;
  onCharacterUpdate: () => void;
}

/** New NPCs page backed by npc_state_machine.json (quest-stage rollback,
 * not just alive/dead) -- kept separate from the original NPCsTab so the
 * older, simpler tool stays available side by side. */
export const NPCsTabV2: React.FC<Props> = (props) => {
  const config: StateMachineEntityTabConfig = {
    entityType: 'npc',
    title: 'NPCs (New)',
    searchPlaceholder: 'Search NPCs...',
    loadingMessage: 'Loading NPC state machine data...',
    includeGroups: true,
  };
  return <StateMachineEntityTab {...props} config={config} />;
};
