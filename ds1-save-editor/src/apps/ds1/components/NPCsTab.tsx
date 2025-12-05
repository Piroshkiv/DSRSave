import React from 'react';
import { Character } from '../lib/Character';
import { EntityListTab, EntityListTabConfig } from './EntityListTab';

interface NPCsTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

const npcConfig: EntityListTabConfig = {
  entityType: 'npc',
  title: 'NPCs',
  filterFn: (npc) => !npc.name.includes('(boss)'),
  searchPlaceholder: 'Search NPCs...',
  loadingMessage: 'Loading NPC data...',
};

export const NPCsTab: React.FC<NPCsTabProps> = (props) => {
  return <EntityListTab {...props} config={npcConfig} />;
};
