import React from 'react';
import { Character } from '../lib/Character';
import { EntityListTab, EntityListTabConfig } from './EntityListTab';

interface BossesTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

const bossConfig: EntityListTabConfig = {
  entityType: 'boss',
  title: 'Bosses',
  filterFn: (npc) => npc.name.includes('(boss)'),
  nameTransform: (name) => name.replace(' (boss)', ''),
  searchPlaceholder: 'Search bosses...',
  loadingMessage: 'Loading boss data...',
};

export const BossesTab: React.FC<BossesTabProps> = (props) => {
  return <EntityListTab {...props} config={bossConfig} />;
};
