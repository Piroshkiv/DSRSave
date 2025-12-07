// Use relative path for logo to work in both web and Electron
const logoImg = (import.meta.env.MODE === 'static' || typeof window !== 'undefined' && window.location.protocol === 'file:')
  ? 'logo.png'
  : '/logo.png';

export interface GameInfo {
  id: string;
  enabled: boolean;
  name: string;
  shortName: string;
  route: string;
  icon: string;
  description: string;
  saveFileExtension: string;
  defaultFileName: string;
}

export const GAMES: Record<string, GameInfo> = {
  DS1: {
    id: 'ds1',
    enabled: true,
    name: 'Dark Souls Remastered',
    shortName: 'DS1',
    route: '/ds1',
    icon: logoImg,
    description: 'Edit your Dark Souls Remastered save files',
    saveFileExtension: '.sl2',
    defaultFileName: 'DRAKS0005.sl2',
  },
  DS3: {
    id: 'ds3',
    enabled: false,
    name: 'Dark Souls 3',
    shortName: 'DS3',
    route: '/ds3',
    icon: '/ds3logo.png',
    description: 'Edit your Dark Souls 3 save files (In work)',
    saveFileExtension: '.sl2',
    defaultFileName: 'DS30000.sl2',
  },
  ELDEN_RING: {
    id: 'eldenring',
    enabled: false,
    name: 'Elden Ring',
    shortName: 'ER',
    route: '/eldenring',
    icon: '/logo-er.png',
    description: 'Edit your Elden Ring save files (Coming Soon)',
    saveFileExtension: '.sl2',
    defaultFileName: 'ER0000.sl2',
  },
} as const;

export const getEnabledGames = (): GameInfo[] => {
  return Object.values(GAMES).filter((game) => game.enabled);
};

export const getAllGames = (): GameInfo[] => {
  return Object.values(GAMES);
};

export const getGameById = (id: string): GameInfo | undefined => {
  return Object.values(GAMES).find((game) => game.id === id);
};
