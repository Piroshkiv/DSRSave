import React, { useState } from 'react';
import './Header.css';

interface HeaderProps {
  title: string;
  icon?: string;
  showHomeButton?: boolean;
  onHome?: () => void;
  showBurger?: boolean;
  onBurgerClick?: () => void;
  showTutorialButton?: boolean;
  onTutorial?: () => void;
  showGameNav?: boolean;
  currentGame?: 'ds1' | 'ds3' | 'eldenring';
}

export const Header: React.FC<HeaderProps> = ({
  title,
  icon,
  showHomeButton,
  onHome,
  showBurger,
  onBurgerClick,
  showTutorialButton,
  onTutorial,
  showGameNav,
  currentGame,
}) => {
  const [showGameMenu, setShowGameMenu] = useState(false);

  return (
    <header className="app-header">
      <div className="header-content">
        {showBurger && (
          <button className="burger-button" onClick={onBurgerClick}>
            <span></span>
            <span></span>
            <span></span>
          </button>
        )}
        {showHomeButton && (
          <button className="home-button" onClick={onHome}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Home
          </button>
        )}
        <h1 className="header-title">
          {icon && <img src={icon} alt={title} className="header-icon" />}
          <span className="header-title-text">{title}</span>
        </h1>
        <div className="header-actions">
          {showGameNav && (
            <div className="game-nav-dropdown">
              <button
                className="game-nav-button"
                onClick={() => setShowGameMenu(!showGameMenu)}
              >
                <span className="button-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="11" x2="10" y2="11"></line>
                    <line x1="8" y1="9" x2="8" y2="13"></line>
                    <line x1="15" y1="12" x2="15.01" y2="12"></line>
                    <line x1="18" y1="10" x2="18.01" y2="10"></line>
                    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"></path>
                  </svg>
                </span>
                <span className="button-text">Games</span>
                <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {showGameMenu && (
                <div className="game-nav-menu">
                  <a
                    href="/ds1"
                    className={`game-nav-item ${currentGame === 'ds1' ? 'active' : ''}`}
                    onClick={() => setShowGameMenu(false)}
                  >
                    Dark Souls Remastered
                  </a>
                  <a
                    href="/ds3"
                    className={`game-nav-item ${currentGame === 'ds3' ? 'disabled' : ''}`}
                    onClick={() => setShowGameMenu(false)}
                  >
                    Dark Souls 3
                    <span className="coming-soon-badge">Coming Soon</span>
                  </a>
                  <a
                    href="/eldenring"
                    className={`game-nav-item ${currentGame === 'eldenring' ? 'disabled' : ''}`}
                    onClick={() => setShowGameMenu(false)}
                  >
                    Elden Ring
                    <span className="coming-soon-badge">Coming Soon</span>
                  </a>
                </div>
              )}
            </div>
          )}
          {showTutorialButton && (
            <a href="/ds1/tutorial" className="tutorial-button" onClick={(e) => {
              if (onTutorial) {
                e.preventDefault();
                onTutorial();
              }
            }}>
              <span className="button-icon">📖</span>
              <span className="button-text">Tutorial</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
