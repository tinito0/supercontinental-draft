import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { DRAFT_BASE, isDraftPath, legacyDraftRedirect, normalizeDraftPath } from './utils/siteRoutes.js';
import { resolveObsRequest } from './utils/obsScenes.js';
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

// Shown while a route chunk downloads: no imports beyond React, so it paints with the entry bundle.
function RouteFallback() {
  return (
    <div role="status" className="min-h-[100dvh] bg-canvas">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="h-16 border-b border-line/10 bg-canvas" />
    </div>
  );
}

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

// Two apps share this page (utils/siteRoutes.js): the draft under /draft (typed by hand, also as /DRAFT) and the
// public league site everywhere else. Each one is its own chunk, so a league visitor never downloads the draft.
const App = lazy(() => import('./app.jsx'));
const LeagueSite = lazy(() => import('./screens/league/LeagueSite.jsx'));
// Fuentes de OBS (/draft/overlay, ?mode=obs…): solo la transmisión, sin cargar el draft (login, mercado).
const ObsScreen = lazy(() => import('./screens/ObsScreen.jsx'));

const { pathname, search, hash } = window.location;
const legacyTarget = legacyDraftRedirect({ pathname, search });

if (legacyTarget) {
  // An OBS source or link from before the draft moved: the hosting cannot redirect on a query string.
  window.location.replace(legacyTarget + hash);
} else {
  const isDraft = isDraftPath(pathname);
  const obsRequest = isDraft ? resolveObsRequest(normalizeDraftPath(pathname).slice(DRAFT_BASE.length) || '/', search) : null;
  if (obsRequest?.transparent) document.documentElement.classList.add('obs-source');
  if (isDraft && !obsRequest) {
    if (normalizeDraftPath(pathname) !== pathname) {
      window.history.replaceState(window.history.state, '', normalizeDraftPath(pathname) + search + hash);
    }
    // index.html describes the public league site; the draft has its own name and is the installable PWA.
    document.title = 'SCL Draft';
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/manifest.json';
    document.head.appendChild(manifest);
  }
  // The draft and its OBS sources live under /draft: keep them out of search and drop the league's canonical.
  if (isDraft) {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    document.querySelector('link[rel="canonical"]')?.remove();
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        {/* OBS sources stay transparent while their chunk loads: an opaque fallback would cover the game feed. */}
        <Suspense fallback={obsRequest ? null : <RouteFallback />}>
          {obsRequest ? (
            <ObsScreen request={obsRequest} />
          ) : isDraft ? (
            <BrowserRouter basename={DRAFT_BASE}>
              <App />
            </BrowserRouter>
          ) : (
            <BrowserRouter>
              <LeagueSite />
            </BrowserRouter>
          )}
        </Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );
}