import React, { useEffect, useRef } from 'react';
import { PitchLines } from './LineupPitch.jsx';

/* Mapa de calor sobre la cancha (summary.heatmaps del colector, pes-collector/collector/pitchData.js): la grilla de
   cols × rows con cuántas veces el juego ubicó al jugador o al equipo en cada celda, siempre atacando hacia la
   derecha. Se dibuja como mancha difuminada (verde → amarillo → rojo, transparente donde no hubo nadie): cada celda
   suma un punto suave en un canvas en escala de grises y después cada píxel toma el color de su intensidad. */

const WIDTH = 630;
const HEIGHT = 408;
// Radio del punto de cada celda, en anchos de celda: une las celdas vecinas sin borrar las zonas.
const SPREAD = 2.2;
// Opacidad del centro de la celda más usada: bajo, para que las superposiciones sumen sin saturar.
const POINT_ALPHA = 0.35;
// Rampa: intensidad 0..1 → [r, g, b, alfa]. Lo poco frecuente queda verde y casi transparente.
const STOPS = [
  [0, [46, 125, 50, 0]],
  [0.15, [67, 160, 71, 110]],
  [0.45, [253, 216, 53, 190]],
  [0.7, [251, 140, 0, 215]],
  [1, [229, 57, 53, 235]],
];

function palette() {
  const table = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const upper = STOPS.findIndex(([at]) => at >= t);
    const [a, ca] = STOPS[Math.max(0, upper - 1)];
    const [b, cb] = STOPS[Math.max(upper, 0)];
    const k = b === a ? 0 : (t - a) / (b - a);
    for (let c = 0; c < 4; c += 1) table[i * 4 + c] = ca[c] + (cb[c] - ca[c]) * k;
  }
  return table;
}

const PALETTE = typeof Uint8ClampedArray === 'undefined' ? null : palette();

function draw(canvas, cells, cols, rows) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !PALETTE) return;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const max = Math.max(...cells);
  const cw = WIDTH / cols;
  const ch = HEIGHT / rows;
  const radius = cw * SPREAD;
  cells.forEach((value, index) => {
    if (value <= 0) return;
    const x = (index % cols) * cw + cw / 2;
    const y = Math.floor(index / cols) * ch + ch / 2;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${(value / max) * POINT_ALPHA})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const px = image.data;
  // La zona más usada llega al rojo, la menos queda verde: se escala al máximo acumulado de este mapa.
  let peak = 1;
  for (let i = 3; i < px.length; i += 4) peak = Math.max(peak, px[i]);
  for (let i = 0; i < px.length; i += 4) {
    const level = Math.min(255, Math.round((px[i + 3] * 255) / peak));
    px[i] = PALETTE[level * 4];
    px[i + 1] = PALETTE[level * 4 + 1];
    px[i + 2] = PALETTE[level * 4 + 2];
    px[i + 3] = PALETTE[level * 4 + 3];
  }
  ctx.putImageData(image, 0, 0);
}

export function Heatmap({ cells, cols, rows, label, className = '' }) {
  const canvasRef = useRef(null);
  const isValid = Array.isArray(cells) && cells.length === cols * rows && Math.max(...cells) > 0;
  useEffect(() => {
    if (isValid && canvasRef.current) draw(canvasRef.current, cells, cols, rows);
  }, [cells, cols, rows, isValid]);
  if (!isValid) return null;
  return (
    <figure className={`m-0 ${className}`}>
      <div className="relative aspect-[105/68] w-full overflow-hidden rounded-xl border border-line/15 bg-canvas">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="absolute inset-0 h-full w-full" role="img" aria-label={label} />
        <PitchLines vertical={false} className="stroke-ink/30" />
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-ink-3">
        <span>Arco propio</span>
        <span>Ataca hacia acá</span>
      </figcaption>
    </figure>
  );
}
