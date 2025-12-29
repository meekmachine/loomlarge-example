import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThreeProvider } from './context/threeContext';
import { preloadAllSnippets } from './latticework/animation/snippetPreloader';
import './styles.css';

// Preload animation snippets to localStorage for PlaybackControls dropdown menus
preloadAllSnippets();

// Panda CSS is processed via PostCSS - styles are generated at build time
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ThreeProvider>
    <App />
  </ThreeProvider>
);
