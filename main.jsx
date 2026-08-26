import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app.jsx';
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
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);