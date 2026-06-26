import {
  Chart,
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  RadialLinearScale,
  CategoryScale,
  LogarithmicScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  Title
} from "chart.js";

Chart.register(
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  RadialLinearScale,
  CategoryScale,
  LogarithmicScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  Title
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app.jsx';
import './index.css';

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