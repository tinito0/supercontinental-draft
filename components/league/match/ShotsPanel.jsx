import React, { useState } from 'react';
import { BallIcon } from './BallIcon.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { SHOT_OUTCOMES } from '../../../utils/matchStats.js';

/* Tiros del partido (utils/matchStats.js shotRows) con filtros y el detalle del elegido. No hay mapa: el juego no
   expone dónde se pateó cada tiro, así que no se dibuja ninguna ubicación. */

const PERIODS = { 1: 'Primer tiempo', 2: 'Segundo tiempo', 3: 'Alargue', 4: 'Alargue' };
const OUTCOME_STYLE = { goal: 'bg-accent text-on-accent', on_target: 'bg-raised text-ink', off_target: 'bg-raised text-ink-3' };

function OutcomeMark({ shot }) {
  return (
    <span className={`inline-flex min-w-[2.75rem] items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${OUTCOME_STYLE[shot.outcome]}`}>
      {shot.outcome === 'goal' && <BallIcon className="h-3.5 w-3.5" />}
      {shot.outcome === 'goal' ? 'Gol' : shot.outcome === 'on_target' ? 'Al arco' : 'Afuera'}
    </span>
  );
}

function Select({ id, label, value, onChange, options }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-ink-3">
      {label}
      <select id={id} className="select min-h-11" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

export function ShotsPanel({ shots, match, compact = false }) {
  const [side, setSide] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [period, setPeriod] = useState('all');
  const [selected, setSelected] = useState(null);
  if (!shots.length) {
    return <p className="py-6 text-center text-sm text-ink-3">Sin tiros todavía, o el partido se grabó antes de medirlos uno por uno.</p>;
  }
  const periods = [...new Set(shots.map(s => s.period).filter(Boolean))];
  const visible = shots.filter(s => (side === 'all' || s.side === side)
    && (outcome === 'all' || s.outcome === outcome)
    && (period === 'all' || String(s.period) === period));
  const shown = compact ? visible.slice(-6) : visible;
  const detail = shots.find(s => s.index === selected) || null;
  const teamName = s => (s.side === 'home' ? match.home.name : match.away.name);
  return (
    <div className="space-y-3">
      {!compact && (
        <div className="space-y-3">
          <Tabs label="Equipo" value={side} onChange={setSide}
            tabs={[{ id: 'all', label: 'Todos' }, { id: 'home', label: match.home.name }, { id: 'away', label: match.away.name }]} />
          <div className="grid grid-cols-2 gap-3">
            <Select id="shot-outcome" label="Resultado" value={outcome} onChange={setOutcome}
              options={[['all', 'Todos'], ...Object.entries(SHOT_OUTCOMES)]} />
            <Select id="shot-period" label="Tiempo" value={period} onChange={setPeriod}
              options={[['all', 'Todo'], ...periods.map(p => [String(p), PERIODS[p]])]} />
          </div>
        </div>
      )}
      {shown.length === 0 && <p className="py-4 text-center text-sm text-ink-3">Ningún tiro con esos filtros.</p>}
      <ul className="divide-y divide-line/10">
        {shown.map(shot => (
          <li key={shot.index}>
            <button type="button" onClick={() => setSelected(shot.index === selected ? null : shot.index)} aria-pressed={shot.index === selected}
              className={`grid min-h-11 w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03] ${shot.index === selected ? 'bg-overlay' : ''}`}>
              <span className="num font-display text-sm font-semibold text-ink-2">{shot.minute}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{shot.name}{shot.penalty ? ' (penal)' : ''}</span>
                <span className="flex items-center gap-1.5 truncate text-xs text-ink-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${shot.side === 'home' ? 'bg-accent' : 'bg-ink-3'}`} aria-hidden="true" />
                  {teamName(shot)}
                </span>
              </span>
              <OutcomeMark shot={shot} />
            </button>
          </li>
        ))}
      </ul>
      {detail && (
        <dl className="well grid grid-cols-2 gap-3 p-3 text-sm sm:grid-cols-4" aria-live="polite">
          <div><dt className="text-xs text-ink-3">Jugador</dt><dd className="font-semibold text-ink">{detail.name}</dd></div>
          <div><dt className="text-xs text-ink-3">Minuto</dt><dd className="num font-semibold text-ink">{detail.minute}</dd></div>
          <div><dt className="text-xs text-ink-3">Resultado</dt><dd className="font-semibold text-ink">{detail.outcomeLabel}</dd></div>
          <div><dt className="text-xs text-ink-3">Tipo</dt><dd className="font-semibold text-ink">{detail.penalty ? 'Penal' : 'En juego'}</dd></div>
        </dl>
      )}
      <p className="text-xs text-ink-3">
        Sin mapa de tiros ni goles esperados (xG): el juego no expone desde dónde se pateó. «Afuera» incluye los tiros bloqueados.
      </p>
    </div>
  );
}
