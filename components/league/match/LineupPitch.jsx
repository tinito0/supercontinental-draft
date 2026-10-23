import React, { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { CardMark } from './MatchParts.jsx';
import { BallIcon } from './BallIcon.jsx';

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

/** Foto del jugador (/fotos_jugadores/{Id}.webp, los ids del juego) o, si no hay, su dorsal en el color del equipo. */
function Miniface({ player, side }) {
  const [failed, setFailed] = useState(false);
  const ring = side === 'home' ? 'ring-accent' : 'ring-ink-2';
  if (failed || player.id == null) {
    return (
      <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ring-2 sm:h-12 sm:w-12 ${ring} ${side === 'home' ? 'bg-accent text-on-accent' : 'bg-ink-2 text-canvas'}`}>
        <span className="num">{player.number ?? player.role}</span>
      </span>
    );
  }
  return (
    <img src={`/fotos_jugadores/${player.id}.webp`} alt="" loading="lazy" decoding="async" width="48" height="48"
      onError={() => setFailed(true)}
      className={`h-10 w-10 rounded-full bg-white object-cover object-top ring-2 sm:h-12 sm:w-12 ${ring}`} />
  );
}

function Marker({ player, side, vertical }) {
  const style = vertical
    ? { left: `${inset(player.y)}%`, top: `${inset(100 - player.x)}%` }
    : { left: `${inset(player.x)}%`, top: `${inset(player.y)}%` };
  const extras = [
    player.goals ? `${player.goals} ${player.goals === 1 ? 'gol' : 'goles'}` : '',
    ...(player.cards || []).map(card => (card === 'red' ? 'tarjeta roja' : 'tarjeta amarilla')),
    player.subbedOff ? `salió ${player.subbedOff}` : '',
  ].filter(Boolean);
  const label = [`${player.name}${player.number != null ? `, dorsal ${player.number}` : ''}, ${player.role}`, ...extras].join(', ');
  return (
    <li className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={style} aria-label={label}>
      <span className="relative">
        <Miniface player={player} side={side} />
        {player.goals > 0 && (
          <span className="absolute -right-2.5 -top-1 flex items-center gap-0.5 rounded-full bg-canvas/85 py-0.5 pl-0.5 pr-1" aria-hidden="true">
            <BallIcon className="h-4 w-4" />
            {player.goals > 1 && <span className="num text-[11px] font-bold leading-none text-ink">{player.goals}</span>}
          </span>
        )}
        {player.cards?.length > 0 && (
          <span className="absolute -left-1.5 -top-1 flex gap-0.5" aria-hidden="true">
            {player.cards.map((card, index) => <CardMark key={index} type={card} />)}
          </span>
        )}
        {player.subbedOff && (
          <span className="absolute -bottom-1 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-surface" title={`Salió ${player.subbedOff}`} aria-hidden="true">
            <ArrowDown className="h-3.5 w-3.5 text-danger-soft" />
          </span>
        )}
      </span>
      <span className="mt-1 flex max-w-full items-baseline gap-1 rounded-md bg-canvas/80 px-1.5 py-0.5 text-xs font-semibold leading-tight text-ink sm:text-[13px]">
        {player.number != null && <span className="num text-accent-soft">{player.number}</span>}
        <span className="truncate">{lastName(player.name)}</span>
      </span>
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
    <p className={`absolute ${place} grid place-items-center p-4 text-center text-sm text-ink-2`}>
      {STATUS_TEXT[status] || STATUS_TEXT.missing}
    </p>
  );
}

function Pitch({ layout, vertical }) {
  return (
    <div className={`lineup-pitch relative w-full overflow-hidden rounded-xl ${vertical ? 'mx-auto aspect-[68/105] max-w-md' : 'aspect-[105/68]'}`}>
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
      <p className="mt-3 text-sm text-ink-2">{sourceNote(layout)}</p>
    </section>
  );
}
