import React, { useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { DEFAULT_PHOTO_FRAME, MAX_PHOTO_ZOOM, cleanPhotoFrame, photoFrameStyle } from '../../utils/leagueContent.js';

/* Encuadre de la foto del estadio: se arrastra para elegir qué parte se ve y se acerca con el zoom. Dos vistas con el
   mismo encuadre, porque la cabecera del club (components/league/club/ClubHero.jsx) es ancha en computadora y casi
   cuadrada en el celular. Las vistas llevan el mismo oscurecido que la cabecera (landing.css .club-hero--photo). */

const KEY_STEP = 2;
const KEY_STEP_LARGE = 10;
const ARROWS = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', -1], ArrowDown: ['y', 1] };

// Pixels the visible photo moves per 1% of focal point: the object-position shift (the cover overflow, zoomed) plus
// the shift of the zoom origin.
function pixelsPerPercent(box, natural, zoom) {
  if (!natural) return { x: 0, y: 0 };
  const cover = Math.max(box.width / natural.width, box.height / natural.height);
  const overflowX = natural.width * cover - box.width;
  const overflowY = natural.height * cover - box.height;
  return {
    x: (overflowX * zoom + (zoom - 1) * box.width) / 100,
    y: (overflowY * zoom + (zoom - 1) * box.height) / 100,
  };
}

function FrameView({ url, frame, onChange, onError, label, className }) {
  const [natural, setNatural] = useState(null);
  const drag = useRef(null);

  const handlePointerDown = event => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    drag.current = { startX: event.clientX, startY: event.clientY, frame, rate: pixelsPerPercent(box, natural, frame.zoom) };
  };
  const handlePointerMove = event => {
    const start = drag.current;
    if (!start) return;
    // Dragging right shows more of the left side, so the focal point moves the other way.
    const shift = (delta, rate) => (rate > 0 ? delta / rate : 0);
    onChange(cleanPhotoFrame({
      ...start.frame,
      x: start.frame.x - shift(event.clientX - start.startX, start.rate.x),
      y: start.frame.y - shift(event.clientY - start.startY, start.rate.y),
    }));
  };
  const handlePointerEnd = () => { drag.current = null; };
  const handleKeyDown = event => {
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    const [axis, sign] = arrow;
    onChange(cleanPhotoFrame({ ...frame, [axis]: frame[axis] + sign * (event.shiftKey ? KEY_STEP_LARGE : KEY_STEP) }));
  };

  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</figcaption>
      <div role="group" tabIndex={0} aria-label={`Encuadre de la foto en ${label.toLowerCase()}. Arrastrá o usá las flechas para mover.`}
        className={`club-hero--photo relative isolate cursor-grab touch-none select-none overflow-hidden rounded-xl border border-line/[0.12] active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}>
        <img src={url} alt="" draggable={false} referrerPolicy="no-referrer" style={photoFrameStyle(frame)}
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
          onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={onError} />
      </div>
    </figure>
  );
}

/**
 * @param {{ url: string, frame: { x: number, y: number, zoom: number }, onChange: (frame: object) => void, onError: () => void }} props
 */
export function PhotoFramer({ url, frame, onChange, onError }) {
  const current = cleanPhotoFrame(frame);
  const isCentered = JSON.stringify(current) === JSON.stringify(cleanPhotoFrame(DEFAULT_PHOTO_FRAME));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
        <FrameView url={url} frame={current} onChange={onChange} onError={onError} label="Computadora" className="aspect-[7/2]" />
        <FrameView url={url} frame={current} onChange={onChange} onError={onError} label="Celular" className="aspect-square w-40 sm:w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-h-11 flex-1 items-center gap-3 text-sm text-ink-2 sm:max-w-sm">
          <span className="shrink-0">Zoom</span>
          <input type="range" min={1} max={MAX_PHOTO_ZOOM} step={0.05} value={current.zoom}
            onChange={event => onChange(cleanPhotoFrame({ ...current, zoom: event.target.value }))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-overlay accent-[rgb(var(--c-accent))]" />
          <span className="num w-10 shrink-0 text-right text-ink">×{current.zoom.toLocaleString('es-AR')}</span>
        </label>
        <button type="button" className="btn btn-secondary min-h-11" disabled={isCentered} onClick={() => onChange({ ...DEFAULT_PHOTO_FRAME })}>
          <Crosshair className="h-4 w-4" aria-hidden="true" /> Centrar
        </button>
      </div>
      <p className="text-sm text-ink-2">Arrastrá la foto para elegir qué parte se ve. El nombre del club va abajo, sobre la parte más oscura.</p>
    </div>
  );
}

export default PhotoFramer;
