import React, { useMemo, useState } from 'react';
import { Sliders, ArrowLeftRight, FileDown, FileSpreadsheet } from 'lucide-react';
import { Tabs } from '../ui/Tabs.jsx';
import { Button } from '../ui/Button.jsx';
import { Pitch } from '../Pitch.jsx';
import { FORMATIONS } from '../../utils/constants.js';
import { getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import {
  SAMPLE_PLAYERS, DEMO_LINEUPS, MARKET_SAMPLE, MARKET_FILTERS,
  DEMO_TOTAL_BUDGET, DEMO_SIGNED_AT_START, EXPORT_FILES,
} from './sampleData.js';

const TABS = [
  { id: 'pitch', label: 'Pizarra', icon: Sliders },
  { id: 'market', label: 'Mercado', icon: ArrowLeftRight },
  { id: 'export', label: 'Exportación', icon: FileDown },
];

const TAB_INTRO = {
  pitch: 'Definí el 11, la estrategia S1 y los lanzadores. Es lo que después se exporta al juego.',
  market: 'Los fichajes se validan en el servidor con los precios reales, y el jugador queda bloqueado al instante para el resto.',
  export: 'Un ZIP con los CSV de tu equipo, para importar con el editor EJOGC327.',
};

const formatPrice = price => `$${price.toFixed(2)}M`;

/* Pitch shows only the last word of a name; a no-break space keeps "Van Dijk" or "De Bruyne" whole. */
const pitchName = name => name.replace(/ /g, ' ');

function PitchPanel() {
  const [formationKey, setFormationKey] = useState('4-3-3');
  const { lineup, tactics } = DEMO_LINEUPS[formationKey];
  const formation = FORMATIONS[formationKey];

  const slots = useMemo(() => lineup.map((key, i) => {
    const p = SAMPLE_PLAYERS[key];
    return { playerId: p.id, name: pitchName(p.short), ovr: p.ovr, pos: formation.layout[i].pos };
  }), [lineup, formation]);

  const strategy = [
    ['Estilo de ataque', tactics.attackStyle],
    ['Construcción', tactics.buildup],
    ['Zona de ataque', tactics.attackArea],
    ['Línea defensiva', tactics.defLine],
    ['Presión', tactics.pressure],
  ];
  const takers = [
    ['Tiros libres', tactics.freekicks],
    ['Penales', tactics.penalties],
    ['Córners', tactics.corners],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10">
      <div>
        <div role="group" aria-label="Formación" className="mb-3 flex flex-wrap gap-2">
          {Object.keys(DEMO_LINEUPS).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={formationKey === key}
              onClick={() => setFormationKey(key)}
              className={`btn btn-sm num min-h-11 sm:min-h-8 ${formationKey === key ? 'btn-primary' : 'btn-secondary'}`}
            >
              {key}
            </button>
          ))}
        </div>
        <Pitch formation={formation} lineup={{}} cart={[]} isReadOnly readOnlySlots={slots} />
      </div>

      <div className="space-y-6">
        <TacticList title="Estrategia S1 (ejemplo)" rows={strategy} />
        <TacticList title="Lanzadores" rows={takers} />
      </div>
    </div>
  );
}

function TacticList({ title, rows }) {
  return (
    <section>
      <h4 className="section-title mb-2">{title}</h4>
      <dl className="divide-y divide-line/10 border-t border-line/10">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-sm text-ink-3">{label}</dt>
            <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MarketPanel() {
  const [filterId, setFilterId] = useState('ALL');
  const [signed, setSigned] = useState(DEMO_SIGNED_AT_START);

  // Derived from the signed list so the budget can never drift from it.
  const budget = useMemo(() => DEMO_TOTAL_BUDGET - MARKET_SAMPLE
    .filter(p => signed.includes(p.id))
    .reduce((sum, p) => sum + p.price, 0), [signed]);

  const filter = MARKET_FILTERS.find(f => f.id === filterId);
  const visible = filter.positions ? MARKET_SAMPLE.filter(p => filter.positions.includes(p.pos)) : MARKET_SAMPLE;

  const toggle = player => {
    setSigned(prev => (prev.includes(player.id) ? prev.filter(id => id !== player.id) : [...prev, player.id]));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-ink-3">Presupuesto restante (ejemplo)</p>
          <p className="font-display num text-3xl font-bold text-ink" aria-live="polite">{formatPrice(budget)}</p>
        </div>
        <div role="group" aria-label="Filtrar por puesto" className="flex flex-wrap gap-2">
          {MARKET_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filterId === f.id}
              onClick={() => setFilterId(f.id)}
              className={`btn btn-sm min-h-11 sm:min-h-8 ${filterId === f.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-line/10 border-y border-line/10">
        {visible.map(p => {
          const isSigned = signed.includes(p.id);
          const canAfford = budget >= p.price;
          return (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <img
                src={`/fotos_jugadores/${p.id}.webp`}
                alt=""
                width="44"
                height="44"
                loading="lazy"
                decoding="async"
                className="h-11 w-11 shrink-0 rounded-lg bg-raised object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{p.card}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`${getPosColorClass(p.pos)} rounded px-1.5 py-0.5 text-[11px] font-bold`}>{p.pos}</span>
                  <span className={`${getStatAndOvrColorClass(p.ovr)} num rounded px-1.5 py-0.5 text-[11px] font-bold`}>{p.ovr}</span>
                </div>
              </div>
              <span className="font-display num text-lg font-semibold text-ink">{formatPrice(p.price)}</span>
              <Button
                size="sm"
                variant={isSigned ? 'danger' : 'primary'}
                onClick={() => toggle(p)}
                disabled={!isSigned && !canAfford}
                title={!isSigned && !canAfford ? 'No alcanza el presupuesto' : undefined}
                className="min-h-11 w-20 sm:min-h-8"
              >
                {isSigned ? 'Liberar' : 'Fichar'}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExportPanel() {
  return (
    <div>
      <ul className="grid gap-x-8 sm:grid-cols-2">
        {EXPORT_FILES.map(f => (
          <li key={f.name} className="flex gap-3 border-t border-line/10 py-3">
            <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-accent-soft" aria-hidden="true" />
            <div>
              <p className="font-mono text-sm font-semibold text-ink">{f.name}</p>
              <p className="text-sm text-ink-3">{f.desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-2">La exportación se hace desde tu equipo, dentro de la plataforma.</p>
    </div>
  );
}

const PANELS = { pitch: PitchPanel, market: MarketPanel, export: ExportPanel };

/** Working sample of the three tools a manager uses. Nothing here reads or writes real data. */
export function PlatformDemo() {
  const [tab, setTab] = useState('pitch');
  const Panel = PANELS[tab];
  return (
    <div className="panel p-4 sm:p-6">
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Herramientas de la plataforma" size="lg" />
      <div role="tabpanel" aria-label={TABS.find(t => t.id === tab).label} className="mt-5">
        <p className="mb-5 max-w-[65ch] text-ink-2">{TAB_INTRO[tab]}</p>
        <Panel />
      </div>
    </div>
  );
}

export default PlatformDemo;
