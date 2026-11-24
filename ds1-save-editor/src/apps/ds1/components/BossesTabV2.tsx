import React from 'react';
import { Character } from '../lib/Character';
import { StateMachineEntityTab, StateMachineEntityTabConfig } from './StateMachineEntityTab';

interface Props {
  character: Character;
  onCharacterUpdate: () => void;
}

/** New Bosses page backed by npc_state_machine.json -- kept separate from the
 * original BossesTab so the older, simpler tool stays available side by side. */
export const BossesTabV2: React.FC<Props> = (props) => {
  const config: StateMachineEntityTabConfig = {
    entityType: 'boss',
    title: 'Bosses (New)',
    searchPlaceholder: 'Search bosses...',
    loadingMessage: 'Loading boss state machine data...',
    includeGroups: false,
  };
  return <StateMachineEntityTab {...props} config={config} />;
};
