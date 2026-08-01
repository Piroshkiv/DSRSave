import React from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { EntityListTab, EntityListTabConfig } from './EntityListTab';

interface BossesTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

export const BossesTab: React.FC<BossesTabProps> = (props) => {
  const { lang } = useLang();
  const bossConfig: EntityListTabConfig = {
    entityType: 'boss',
    title: t('tab_bosses', lang),
    filterFn: (npc) => npc.name.includes('(boss)'),
    nameTransform: (name) => name.replace(' (boss)', ''),
    searchPlaceholder: t('searchBosses', lang),
    loadingMessage: t('loadingBosses', lang),
    readState: true,
    showOnlyDead: true,
  };
  return <EntityListTab {...props} config={bossConfig} />;
};
