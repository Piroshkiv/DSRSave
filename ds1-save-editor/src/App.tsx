import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Router } from './core/Router';
import './App.css';

// Detect if running in Electron or Tauri
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const isTauri = window.__TAURI__ !== undefined;
const isDesktopApp = isElectron || isTauri;

function App() {
  // Use HashRouter for desktop apps (Electron/Tauri), BrowserRouter for web
  const RouterComponent = isDesktopApp ? HashRouter : BrowserRouter;

  return (
    <RouterComponent>
      <Router />
    </RouterComponent>
  );
}

export default App;
