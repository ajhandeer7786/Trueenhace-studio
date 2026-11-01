import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker for standalone installability & offline caching
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration note:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
