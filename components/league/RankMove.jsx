import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

/* Puestos que gana o pierde un club en la tabla en vivo (utils/liveTable.js `move`): flecha y número, verde si sube,
   rojo si baja. Color y forma dicen lo mismo, así que no depende solo del color. */

export function RankMove({ move, className = '' }) {
  if (!move) return null;
  const up = move > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-px text-xs font-bold leading-none ${up ? 'text-success-soft' : 'text-danger-soft'} ${className}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      <span className="num" aria-hidden="true">{Math.abs(move)}</span>
      <span className="sr-only">{up ? 'sube' : 'baja'} {Math.abs(move)} {Math.abs(move) === 1 ? 'puesto' : 'puestos'}</span>
    </span>
  );
}

/** Punto rojo de «jugando ahora» en una fila, con su texto para lectores de pantalla. Quieto: el que late es el del
    partido (docs/DESIGN_SYSTEM.md, un solo punto que late por pantalla). */
export function LiveDot({ pendingShootout = false }) {
  const label = pendingShootout ? 'jugando, empata y define por penales' : 'jugando ahora';
  return (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full bg-danger" title={pendingShootout ? 'Jugando: empate, define por penales' : 'Jugando ahora'} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  );
}

export default RankMove;
