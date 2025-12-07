import React, { ReactNode, useState } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import './AppLayout.css';

interface AppLayoutProps {
  title: string;
  icon?: string;
  showHomeButton?: boolean;
  onHome?: () => void;
  sidebar?: ReactNode;
  children: ReactNode;
  onTermsClick?: () => void;
  onAboutClick?: () => void;
  showTutorialButton?: boolean;
  onTutorial?: () => void;
  showGameNav?: boolean;
  currentGame?: 'ds1' | 'ds3' | 'eldenring';
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  icon,
  showHomeButton,
  onHome,
  sidebar,
  children,
  onTermsClick,
  onAboutClick,
  showTutorialButton,
  onTutorial,
  showGameNav,
  currentGame,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="app">
      <Header
        title={title}
        icon={icon}
        showHomeButton={showHomeButton}
        onHome={onHome}
        showBurger={!!sidebar}
        onBurgerClick={toggleSidebar}
        showTutorialButton={showTutorialButton}
        onTutorial={onTutorial}
        showGameNav={showGameNav}
        currentGame={currentGame}
      />

      <div className="app-content">
        {sidebar && (
          <>
            <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
              <button className="sidebar-close" onClick={toggleSidebar}>
                ✕
              </button>
              {sidebar}
            </aside>
            {isSidebarOpen && (
              <div className="sidebar-overlay" onClick={toggleSidebar}></div>
            )}
          </>
        )}
        <main className="main-content">{children}</main>
      </div>

      <Footer onTermsClick={onTermsClick} onAboutClick={onAboutClick} />
    </div>
  );
};
