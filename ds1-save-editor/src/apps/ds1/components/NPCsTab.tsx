import React from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { EntityListTab, EntityListTabConfig } from './EntityListTab';

interface NPCsTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

export const NPCsTab: React.FC<NPCsTabProps> = (props) => {
  const { lang } = useLang();
  const npcConfig: EntityListTabConfig = {
    entityType: 'npc',
    title: t('tab_npcs', lang),
    filterFn: (npc) => !npc.name.includes('(boss)'),
    searchPlaceholder: t('searchNpcs', lang),
    loadingMessage: t('loadingNpcs', lang),
  };
  return <EntityListTab {...props} config={npcConfig} />;
};
