import React from 'react';
import './Header.css';

interface HeaderProps {
  title: string;
  icon?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, icon, showBackButton, onBack }) => {
  return (
    <header className="app-header">
      <div className="header-content">
        {showBackButton && (
          <button className="back-button" onClick={onBack}>
            ← Back
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
