import React from 'react';
import './Header.css';

interface HeaderProps {
  title: string;
  icon?: string;
  showHomeButton?: boolean;
  onHome?: () => void;
  showBurger?: boolean;
  onBurgerClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  icon,
  showHomeButton,
  onHome,
  showBurger,
  onBurgerClick,
}) => {
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
          {title}
        </h1>
      </div>
    </header>
  );
};
