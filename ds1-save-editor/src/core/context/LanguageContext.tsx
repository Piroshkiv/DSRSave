import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Lang } from '../../apps/ds1/lib/i18n';

export const LANGS: Lang[] = ['en', 'zh'];
export const LANG_NAMES: Record<Lang, string> = { en: 'EN', zh: '中' };
export const LANG_FULL_NAMES: Record<Lang, string> = { en: 'English', zh: '中文' };

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('ds1-lang') as Lang) || 'en';
  });

  const setLang = (l: Lang) => {
    localStorage.setItem('ds1-lang', l);
    setLangState(l);
  };

  const toggleLang = () => {
    setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLang must be used within a LanguageProvider');
  return context;
};