import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
// Self-hosted fonts (works offline in the PWA; no third-party font requests).
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './index.css';

// Chart.js se registra en utils/chartSetup.js, que importan solo los componentes con gráficos (lazy).

const rootElement = document.getElementById('root');

// Un import dinámico que falla suele ser un deploy nuevo (los chunks viejos ya no existen): recargar una vez.
// Sin red, o si vuelve a fallar enseguida, no recargar en bucle: el error sigue su curso (catch del import
// o ErrorBoundary) y no se pierde lo que se estaba editando.
const PRELOAD_RELOAD_KEY = 'scl-preload-reload-at';
const PRELOAD_RELOAD_WINDOW_MS = 60_000;
window.addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return;
  let lastReload = 0;
  try { lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY)) || 0; } catch { /* sin sessionStorage */ }
  if (Date.now() - lastReload < PRELOAD_RELOAD_WINDOW_MS) return;
  try { sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now())); } catch { /* sin sessionStorage */ }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);