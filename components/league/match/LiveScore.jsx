import React, { useRef } from 'react';

/* Marcador que cambia en vivo. Cuando un lado suma un gol, solo ese número entra de nuevo (.score-pop, «Number pop-in»
   de transitions.dev: 8 px desde abajo con 2 px de desenfoque, en --dur-move) y destella una vez; con movimiento
   reducido, solo el destello. Al abrir la página no
   se anima nada. Va con key={partido}: cambiar de partido no es un gol. docs/DESIGN_SYSTEM.md "Live values". */

function Digit({ value, initial }) {
  const changed = value !== initial;
  return <span key={value} className={`inline-block ${changed ? 'score-pop' : ''}`}>{value}</span>;
}

/**
 * @param {{ home: number, away: number, className?: string }} props
 */
export function LiveScore({ home, away, className = '' }) {
  const first = useRef({ home, away });
  return (
    <p className={`num font-display font-bold leading-none text-ink ${className}`}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{home} a {away}</span>
      <span aria-hidden="true">
        <Digit value={home} initial={first.current.home} />
        <span className="mx-1.5 text-ink-3">-</span>
        <Digit value={away} initial={first.current.away} />
      </span>
    </p>
  );
}

export default LiveScore;
