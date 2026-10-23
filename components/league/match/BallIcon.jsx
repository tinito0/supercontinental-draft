import React, { useId } from 'react';

/* Pelota de fútbol clásica (blanca con pentágonos negros) para marcar goles. SVG propio: el emoji ⚽ cambia según el
   sistema y a 14px no se lee; esta se ve igual en todos lados. Decorativa: el texto del gol va aparte. */

// Pentágono central y los cinco parches del borde, en la dirección de cada vértice (como en una pelota real).
const CENTER = '12,7.6 16.18,10.64 14.59,15.56 9.41,15.56 7.82,10.64';
const VERTICES = [[12, 7.6], [16.18, 10.64], [14.59, 15.56], [9.41, 15.56], [7.82, 10.64]];
const PATCHES = [[12, 0.6], [22.84, 8.48], [18.7, 21.22], [5.3, 21.22], [1.16, 8.48]];

export function BallIcon({ className = 'h-4 w-4' }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}><circle cx="12" cy="12" r="10.6" /></clipPath>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#0b0f19" strokeWidth="1.2" />
      <g clipPath={`url(#${clipId})`} fill="#0b0f19" stroke="#0b0f19" strokeWidth="1" strokeLinejoin="round">
        <polygon points={CENTER} />
        {VERTICES.map(([x, y], index) => (
          <line key={index} x1={x} y1={y} x2={PATCHES[index][0]} y2={PATCHES[index][1]} />
        ))}
        {PATCHES.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="3.4" />)}
      </g>
    </svg>
  );
}

export default BallIcon;
