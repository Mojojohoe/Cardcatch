import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CardArtProvider } from './cardArt/cardArtContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CardArtProvider>
      <App />
    </CardArtProvider>
  </StrictMode>,
);
