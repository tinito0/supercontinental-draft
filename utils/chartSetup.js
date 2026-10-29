// Registro de Chart.js. Lo importan solo los componentes con gráficos (CartModal, ComparisonModal,
// PlayerModal), que ya se cargan con React.lazy: así Chart.js (~200 kB) baja recién al abrir uno de ellos.
// Antes main.jsx lo importaba al arrancar y vite.config.js lo precargaba en todas las páginas.
import {
  Chart, ArcElement, LineElement, BarElement, PointElement,
  LinearScale, RadialLinearScale, CategoryScale, LogarithmicScale,
  TimeScale, Tooltip, Legend, Filler, Title,
} from 'chart.js';

Chart.register(
  ArcElement, LineElement, BarElement, PointElement,
  LinearScale, RadialLinearScale, CategoryScale, LogarithmicScale,
  TimeScale, Tooltip, Legend, Filler, Title,
);
