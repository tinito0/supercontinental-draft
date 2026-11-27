import React from 'react';
import { formatDecimal } from '../../../utils/matchStats.js';

/* Mapa de tiros: la mitad de la cancha que ataca cada equipo (los dos atacando hacia arriba), un punto por tiro con
   posición conocida. Tamaño = xG; relleno = gol; local en azul. La posición es la última que el juego refrescó del
   pateador antes del tiro (pitchData.js): aproximada, unos metros. */

const LENGTH = 105;
const WIDTH = 68;
// Se dibuja desde la mitad de la cancha hasta el arco: 52,5 m de alto por 68 de ancho.
const HALF = LENGTH / 2;
// viewBox units: about 5 units is 22px on a 328px-wide phone pitch (the 44px target).
const HIT_RADIUS = 5;
const HIT_RING_WIDTH = 0.6;

function HalfPitch() {
  return (
    <g fill="none" className="stroke-line/30" strokeWidth="0.35">
      <rect x="0.5" y="0.5" width={WIDTH - 1} height={HALF - 0.5} />
      <rect x={WIDTH / 2 - 20.15} y="0.5" width="40.3" height="16.5" />
      <rect x={WIDTH / 2 - 9.15} y="0.5" width="18.3" height="5.5" />
      <path d={`M ${WIDTH / 2 - 9.15} ${HALF} A 9.15 9.15 0 0 1 ${WIDTH / 2 + 9.15} ${HALF}`} />
    </g>
  );
}

export function ShotMap({ shots, match, selected, onSelect }) {
  const placed = shots.filter(shot => shot.x != null && shot.y != null);
  if (!placed.length) return null;
  const describe = shot => `${shot.name}, ${shot.minute}, ${shot.outcomeLabel}, xG ${formatDecimal(shot.xg)}`;
  return (
    <figure className="m-0">
      <div className="lineup-pitch relative mx-auto aspect-[68/52.5] w-full max-w-md overflow-hidden rounded-xl">
        <svg viewBox={`0 0 ${WIDTH} ${HALF}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Mapa de tiros">
          <HalfPitch />
          {placed.map(shot => {
            // Atacando hacia la derecha (x 105 = arco rival) → arriba; y 0 = banda izquierda del que ataca.
            const cx = shot.y;
            const cy = LENGTH - shot.x;
            const r = 0.9 + 2.4 * Math.sqrt(shot.xg ?? 0.05);
            const isHome = shot.side === 'home';
            const isGoal = shot.outcome === 'goal';
            const y = Math.min(HALF - 0.8, Math.max(0.8, cy));
            return (
              <g key={shot.index}>
                <circle cx={cx} cy={y} r={r} aria-hidden="true" className={`pointer-events-none ${isHome ? 'stroke-accent' : 'stroke-ink-2'} ${isGoal ? (isHome ? 'fill-accent' : 'fill-ink-2') : 'fill-transparent'}`}
                  strokeWidth={selected === shot.index ? 0.9 : 0.5} />
                {/* Invisible hit area of about 44px at phone width; the focus ring is drawn on it. */}
                <circle cx={cx} cy={y} r={Math.max(r, HIT_RADIUS)} fill="transparent" role="button" tabIndex={0}
                  aria-label={describe(shot)} aria-pressed={selected === shot.index}
                  onClick={() => onSelect(shot.index === selected ? null : shot.index)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(shot.index === selected ? null : shot.index); } }}
                  className="cursor-pointer focus-visible:stroke-ink" strokeWidth={HIT_RING_WIDTH} />
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-accent" aria-hidden="true" />{match.home.name}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-ink-2" aria-hidden="true" />{match.away.name}</span>
        <span>Relleno = gol · tamaño = xG · posición aproximada</span>
      </figcaption>
    </figure>
  );
}
