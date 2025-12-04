import React, { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import './AppLayout.css';

interface AppLayoutProps {
  title: string;
  icon?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  sidebar?: ReactNode;
  children: ReactNode;
  onTermsClick?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  icon,
  showBackButton,
  onBack,
  sidebar,
  children,
  onTermsClick,
}) => {
  return (
    <div className="app">
      <Header title={title} icon={icon} showBackButton={showBackButton} onBack={onBack} />

      <div className="app-content">
        {sidebar && <aside className="sidebar">{sidebar}</aside>}
        <main className="main-content">{children}</main>
      </div>

      <Footer onTermsClick={onTermsClick} />
    </div>
  );
};
