import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CardArtProvider } from './cardArt/cardArtContext';
import { PlayerDisplayPreferencesProvider } from './playerDisplayPreferences';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CardArtProvider>
      <PlayerDisplayPreferencesProvider>
        <App />
      </PlayerDisplayPreferencesProvider>
    </CardArtProvider>
  </StrictMode>,
);
