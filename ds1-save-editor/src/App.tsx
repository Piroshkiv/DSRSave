import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Router } from './core/Router';
import './App.css';
import { useEffect } from 'react';

// Detect if running in Electron or Tauri
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const isTauri = window.__TAURI__ !== undefined;
const isDesktopApp = isElectron || isTauri;

// Get the page identifier from the HTML file's body tag
const getPageFromHTML = (): string | null => {
  return document.body.getAttribute('data-page');
};

// Component that handles initial navigation based on HTML file loaded
const InitialNavigator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const page = getPageFromHTML();

  useEffect(() => {
    // If we're on a specific page HTML file (ds1.html, ds3.html, etc.)
    // and the current location doesn't match, we need to navigate
    if (page && page !== 'home' && window.location.pathname === '/') {
      // Replace the URL with the correct path without causing a page reload
      window.history.replaceState(null, '', `/${page}`);
    }
  }, [page]);

  return <>{children}</>;
};

function App() {
  // Use HashRouter for desktop apps (Electron/Tauri), BrowserRouter for web
  const RouterComponent = isDesktopApp ? HashRouter : BrowserRouter;

  return (
    <RouterComponent>
      <InitialNavigator>
        <Router />
      </InitialNavigator>
    </RouterComponent>
  );
}

export default App;
