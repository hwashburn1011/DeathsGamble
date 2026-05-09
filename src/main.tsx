import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root container missing');

// Test/debug hook — exposes stores on window when running in dev OR when
// the URL contains ?debug. Used by Playwright tests to jump between game
// states without sitting through 60s round timers.
if (import.meta.env.DEV || /[?&]debug/.test(window.location.search)) {
  void Promise.all([
    import('./state/gameStore'),
    import('./state/settingsStore'),
    import('./state/persistentStore'),
  ]).then(([game, settings, persistent]) => {
    (window as Window & { __DG?: unknown }).__DG = {
      gameStore: game.useGameStore,
      settingsStore: settings.useSettingsStore,
      persistentStore: persistent.usePersistentStore,
    };
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
