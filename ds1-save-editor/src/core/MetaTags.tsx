// MetaTags component - мета-теги теперь генерируются статически при билде
// Этот компонент больше не нужен, но оставляем для обратной совместимости

interface MetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  canonical?: string;
  structuredData?: Record<string, any> | Record<string, any>[];
}

export const MetaTags: React.FC<MetaTagsProps> = () => {
  // Мета-теги теперь статические в HTML файлах, генерируемых скриптом
  // Нет необходимости обновлять их динамически
  return null;
};
