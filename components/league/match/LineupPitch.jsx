import React from 'react';
import { ArrowDown } from 'lucide-react';

/* Las dos formaciones del saque inicial en una cancha (utils/matchAnalysis.js pitchLayout). Horizontal desde sm
   (el local ataca a la derecha); vertical en el teléfono (el local abajo, atacando hacia arriba). Coordenadas en %
   de la cancha: x = largo (0 arco local … 100 arco visitante), y = ancho (0 arriba). */

const STATUS_TEXT = {
  differs: 'Formación sin confirmar: el plan guardado no coincide con el XI que salió a la cancha.',
  unknown: 'La formación aparece cuando se lee el XI inicial.',
  missing: 'Sin formación: el equipo no tiene plan en el archivo de guardado.',
};

/** De dónde sale lo dibujado: leído del juego, o el plan guardado que coincide con el XI. */
function sourceNote(layout) {
  const statuses = [layout.home.status, layout.away.status];
  if (statuses.every(s => s === 'live')) {
    return 'Formación del saque inicial leída del juego. Los cambios durante el partido están en Táctica.';
  }
  if (statuses.includes('live')) {
    return 'Formación del saque inicial leída del juego o, si no se pudo leer, el plan guardado del equipo cuando coincide puesto por puesto con el XI que salió a la cancha.';
  }
  return 'Formación del saque inicial según el plan guardado de cada equipo, mostrada solo si coincide puesto por puesto con el XI que salió a la cancha (partido grabado antes de leer la formación del juego).';
}

const lastName = name => String(name || '').split(' ').filter(Boolean).at(-1) || '?';
// The arquero (profundidad 3) and the wide players (lateral 8 / 92) would be cut off at the edge: the drawing
// keeps a margin. Only the drawing, the data stay as the game gives them.
const EDGE = 6;
const inset = value => EDGE + (value * (100 - 2 * EDGE)) / 100;

function Marker({ player, side, vertical }) {
  const style = vertical
    ? { left: `${inset(player.y)}%`, top: `${inset(100 - player.x)}%` }
    : { left: `${inset(player.x)}%`, top: `${inset(player.y)}%` };
  const label = `${player.name}${player.number != null ? `, dorsal ${player.number}` : ''}, ${player.role}${player.subbedOff ? `, salió ${player.subbedOff}` : ''}`;
  return (
    <li className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={style} aria-label={label}>
      <span className={`relative grid h-7 w-7 place-items-center rounded-full text-xs font-bold shadow-md sm:h-8 sm:w-8 ${side === 'home' ? 'bg-accent text-on-accent' : 'bg-ink-3 text-canvas'}`}>
        <span className="num">{player.number ?? player.role}</span>
        {player.subbedOff && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-surface" title={`Salió ${player.subbedOff}`}>
            <ArrowDown className="h-3 w-3 text-danger-soft" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="mt-0.5 max-w-full truncate rounded bg-canvas/70 px-1 text-[10px] leading-tight text-ink sm:text-[11px]">{lastName(player.name)}</span>
    </li>
  );
}

function PitchLines({ vertical }) {
  // Cancha de 105 × 68: áreas, círculo central y la línea media.
  const view = vertical ? '0 0 68 105' : '0 0 105 68';
  const t = vertical ? (x, y) => [y, 105 - x] : (x, y) => [x, y];
  const rect = (x, y, w, h) => {
    const [ax, ay] = t(x, y);
    const [bx, by] = t(x + w, y + h);
    return <rect x={Math.min(ax, bx)} y={Math.min(ay, by)} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} />;
  };
  const [cx, cy] = t(52.5, 34);
  const [m1x, m1y] = t(52.5, 0);
  const [m2x, m2y] = t(52.5, 68);
  return (
    <svg viewBox={view} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <g fill="none" className="stroke-line/25" strokeWidth="0.35">
        {rect(0.5, 0.5, 104, 67)}
        {rect(0.5, 13.85, 16.5, 40.3)}
        {rect(88, 13.85, 16.5, 40.3)}
        {rect(0.5, 24.85, 5.5, 18.3)}
        {rect(99, 24.85, 5.5, 18.3)}
        <line x1={m1x} y1={m1y} x2={m2x} y2={m2y} />
        <circle cx={cx} cy={cy} r="9.15" />
      </g>
    </svg>
  );
}

function SideNotice({ side, status, vertical }) {
  if (status === 'matches' || status === 'live') return null;
  const place = vertical
    ? (side === 'home' ? 'bottom-0 inset-x-0 h-1/2' : 'top-0 inset-x-0 h-1/2')
    : (side === 'home' ? 'left-0 inset-y-0 w-1/2' : 'right-0 inset-y-0 w-1/2');
  return (
    <p className={`absolute ${place} grid place-items-center p-4 text-center text-xs text-ink-3`}>
      {STATUS_TEXT[status] || STATUS_TEXT.missing}
    </p>
  );
}

function Pitch({ layout, vertical }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-raised ${vertical ? 'mx-auto aspect-[68/105] max-w-sm' : 'aspect-[105/68]'}`}>
      <PitchLines vertical={vertical} />
      {['home', 'away'].map(side => (
        <React.Fragment key={side}>
          <SideNotice side={side} status={layout[side].status} vertical={vertical} />
          <ul aria-label={side === 'home' ? 'Local' : 'Visitante'}>
            {layout[side].players.map(player => <Marker key={player.id} player={player} side={side} vertical={vertical} />)}
          </ul>
        </React.Fragment>
      ))}
    </div>
  );
}

export function LineupPitch({ layout, match }) {
  return (
    <section className="panel p-3 sm:p-4" aria-label="Formaciones del saque inicial">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold">
        <span className="flex min-w-0 items-center gap-2 text-ink"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" /><span className="truncate">{match.home.name}</span></span>
        <span className="flex min-w-0 items-center gap-2 text-ink"><span className="truncate">{match.away.name}</span><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink-3" aria-hidden="true" /></span>
      </div>
      <div className="hidden sm:block"><Pitch layout={layout} vertical={false} /></div>
      <div className="sm:hidden"><Pitch layout={layout} vertical /></div>
      <p className="mt-3 text-xs text-ink-3">{sourceNote(layout)}</p>
    </section>
  );
}
