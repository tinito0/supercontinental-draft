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

// Chart.js registration moved to a lazy-loaded module.
// Components that need charts import and register on demand.
// This avoids loading ~200KB of chart.js on every page.
const registerChartDefaults = async () => {
  const [
    { Chart, ArcElement, LineElement, BarElement, PointElement,
      LinearScale, RadialLinearScale, CategoryScale, LogarithmicScale,
      TimeScale, Tooltip, Legend, Filler, Title }
  ] = await Promise.all([import('chart.js')]);
  Chart.register(
    ArcElement, LineElement, BarElement, PointElement,
    LinearScale, RadialLinearScale, CategoryScale, LogarithmicScale,
    TimeScale, Tooltip, Legend, Filler, Title
  );
};

// Fire and forget — charts register before any chart component renders
// (they're all behind React.lazy anyway)
registerChartDefaults();

const rootElement = document.getElementById('root');

// Handle dynamic import errors (typically caused by new deployments superseding old chunks)
window.addEventListener('vite:preloadError', (event) => {
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