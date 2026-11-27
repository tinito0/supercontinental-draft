import React, { useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../../utils/chartSetup.js';
import { formatMoney } from '../../utils/helpers.js';
import { budgetTone, BUDGET_TONE_CLASSES } from '../../utils/budgetDisplay.js';
import { SQUAD_LINES, countByLine, lineColor } from '../../utils/squadLines.js';
import { Stat } from '../ui/Stat.jsx';
import { Alert } from '../ui/Alert.jsx';

const MAX_COUNTRIES = 5;

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: '#b8c2d6', font: { size: 11, family: 'Barlow' }, boxWidth: 10, padding: 15 } },
    title: { display: false },
  },
  scales: {
    y: { ticks: { color: '#8692ab', stepSize: 1 }, grid: { color: 'rgba(150, 166, 200, 0.12)', drawBorder: false } },
    x: { ticks: { color: '#b8c2d6' }, grid: { display: false } },
  },
};

// The legend is the list below the chart (figures readable without a tooltip), so the canvas one stays off.
const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

/** Balance block: «Disponible» leads, the other three figures explain it. The one place the balance repeats the header. */
function BalanceSection({ budgetStatus, onRetryBudget, remaining, percent, base, spent, committed }) {
  const ready = budgetStatus === 'ready';
  const tone = ready ? budgetTone(percent) : 'accent';
  const figure = (amount) => (ready ? formatMoney(amount) : '–');
  return (
    <section aria-label="Balance financiero" className="border-b border-line/[0.08] pb-5">
      {budgetStatus === 'error' && (
        <Alert tone="danger" title="No pudimos cargar tus contratos" className="mb-4"
          action={onRetryBudget && <button type="button" onClick={onRetryBudget} className="btn btn-secondary min-h-11">Reintentar</button>}>
          Sin ellos no podemos calcular tu presupuesto.
        </Alert>
      )}
      <Stat label="Disponible" value={figure(remaining)} size="lg" tone={ready ? tone : 'default'}
        hint={ready ? `${percent.toFixed(0)}% del presupuesto` : undefined} />
      {ready && (
        <div className="mt-3 h-3 rounded-full bg-white/[0.06] overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(percent)} aria-label="Presupuesto disponible">
          <div className={`h-full rounded-full transition-[width] duration-move ${BUDGET_TONE_CLASSES[tone].bar}`} style={{ width: `${percent}%` }} />
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        <Stat label="Presupuesto" value={figure(base)} size="sm" hint="Cambia con los traspasos" />
        <Stat label="Gastado" value={figure(spent)} size="sm" hint="En el plantel" />
        <Stat label="En ofertas" value={figure(committed)} size="sm" tone={ready && committed > 0 ? 'warning' : 'default'} hint="Enviadas, pendientes" />
      </div>
    </section>
  );
}

function LedgerSection({ ledger }) {
  const { totals } = ledger;
  return (
    <section className="panel-flat p-5" aria-labelledby="cart-ledger">
      <h3 id="cart-ledger" className="eyebrow mb-4">Movimientos de la temporada</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Fichajes" value={formatMoney(totals.spentOnSignings)} hint={`${ledger.signings.length} jugadores`} size="sm" />
        <Stat label="Compras" value={formatMoney(totals.spentOnPurchases)} hint={`${ledger.purchases.length} traspasos`} size="sm" />
        <Stat label="Ventas (neto)" value={formatMoney(totals.receivedFromSales)} hint={`comisión ${formatMoney(totals.fees)}`} size="sm" />
        <Stat label="Balance" value={formatMoney(totals.net)} tone={totals.net < 0 ? 'danger' : 'default'} size="sm" />
      </div>
      {(ledger.purchases.length > 0 || ledger.sales.length > 0) && (
        <ul className="mt-4 divide-y divide-line/[0.08] text-sm">
          {ledger.purchases.map(row => (
            <li key={`buy-${row.id}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-ink-2">Compra · <span className="text-ink">{row.name}</span>{row.club ? ` de ${row.club}` : ''}</span>
              <span className="num font-semibold text-danger-soft shrink-0">{formatMoney(-row.amount)}</span>
            </li>
          ))}
          {ledger.sales.map(row => (
            <li key={`sale-${row.id}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-ink-2">Venta · <span className="text-ink">{row.name}</span>{row.club ? ` a ${row.club}` : ''}</span>
              <span className="num font-semibold text-success-soft shrink-0">+{formatMoney(row.net)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-3">Los fichajes cuentan a precio de catálogo; las ventas, después de la comisión de la liga. El presupuesto disponible es el de arriba.</p>
    </section>
  );
}

/** Doughnut of players per line, in the colours of the position chips, with the figures listed beside it. */
function LinesChart({ lineCounts }) {
  const data = useMemo(() => ({
    labels: SQUAD_LINES.map(line => `${line.label} · ${lineCounts[line.key]}`),
    datasets: [{
      data: SQUAD_LINES.map(line => lineCounts[line.key]),
      backgroundColor: SQUAD_LINES.map(line => lineColor(line)),
      borderColor: '#0e1320',
      borderWidth: 2,
      hoverOffset: 4,
    }],
  }), [lineCounts]);
  return (
    <section className="panel-flat p-5 flex flex-col" aria-labelledby="cart-chart-positions">
      <h3 id="cart-chart-positions" className="eyebrow mb-4">Distribución por línea</h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-[180px] w-[180px] shrink-0">
          <Doughnut data={data} options={doughnutOptions} aria-label="Gráfico de jugadores por línea" role="img" />
        </div>
        <dl className="w-full min-w-0 space-y-2 text-sm">
          {SQUAD_LINES.map(line => (
            <div key={line.key} className="flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-sm pos-${line.key}`} aria-hidden="true" />
              <dt className="min-w-0 flex-1 truncate text-ink-2">{line.label}</dt>
              <dd className="num font-semibold text-ink">{lineCounts[line.key]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function CountriesChart({ cart, countryMap }) {
  const data = useMemo(() => {
    const counts = {};
    cart.forEach(player => { counts[player.Country1] = (counts[player.Country1] || 0) + 1; });
    const top = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, MAX_COUNTRIES);
    return {
      labels: top.map(([code, count]) => `${(countryMap && countryMap[code] ? countryMap[code] : code).substring(0, 10)} (${count})`),
      datasets: [{ label: 'Jugadores', data: top.map(([, count]) => count), backgroundColor: '#3a66c4', borderRadius: 6, barThickness: 20 }],
    };
  }, [cart, countryMap]);
  return (
    <section className="panel-flat p-5 flex flex-col" aria-labelledby="cart-chart-countries">
      <h3 id="cart-chart-countries" className="eyebrow mb-4">Nacionalidades</h3>
      <div className="flex-grow relative min-h-[220px]">
        <Bar data={data} options={barOptions} aria-label="Gráfico de las cinco nacionalidades más presentes" role="img" />
      </div>
    </section>
  );
}

/** «Finanzas» tab of Plantel y finanzas. */
export function FinancesPanel({ budgetStatus, onRetryBudget, remaining, percent, base, spent, committed, ledger, cart, countryMap }) {
  const lineCounts = useMemo(() => countByLine(cart), [cart]);
  const averages = useMemo(() => {
    const total = cart.length;
    const mean = (key) => (total > 0 ? Math.round(cart.reduce((sum, player) => sum + (player[key] || 0), 0) / total) : 0);
    return { total, avgOvr: mean('OVR_CALCULADO'), avgAge: mean('Age') };
  }, [cart]);
  return (
    <div className="space-y-6">
      <BalanceSection budgetStatus={budgetStatus} onRetryBudget={onRetryBudget} remaining={remaining} percent={percent}
        base={base} spent={spent} committed={committed} />
      <LedgerSection ledger={ledger} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        <Stat label="Media del plantel" value={averages.avgOvr} tone="accent" size="sm" />
        <Stat label="Edad promedio" value={averages.avgAge} hint="años" size="sm" />
        <Stat label="Jugadores" value={averages.total} size="sm" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LinesChart lineCounts={lineCounts} />
        <CountriesChart cart={cart} countryMap={countryMap} />
      </div>
    </div>
  );
}
