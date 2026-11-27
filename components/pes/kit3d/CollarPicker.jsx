import React, { useEffect, useRef, useState } from 'react';
import { Check, Eye, Undo2 } from 'lucide-react';
import { Button } from '../PesUi.jsx';
import { KitGL, lightState, sharedThumbRenderer } from './kitRenderer.js';
import { collarModel, fitParts, weldNormals } from '../../../pes/kits/kitModels.js';
import { buildOccluder, refineCollar } from '../../../pes/kits/kitRefine.js';

const THUMB = 96;
const RENDER_SCALE = 3; // thumbnails drawn at 3× their CSS size, sharp on high-density screens
const FRAME_BUDGET_MS = 12;
// Prepared thumbnail scenes per base shirt (the viewer keeps one base array per geometry): redrawing after a pick,
// a light change or a config edit reuses them instead of refining every collar again.
const preparedScenes = new WeakMap();

/**
 * Every collar model of the pack (limited to the kit's Collar range), drawn on the kit's own shirt. Picking one
 * previews it on the main viewer right away; "Usar" writes it to config.txt (Collar, optionally WinterCollar).
 * Adapted from PES Editor Rebuilt js/kitstudio.js (collar picker: thumbnails, preview, "Usar este cuello").
 * @param {{ pack: object, collars: number[], baseParts: {k: string, m: object}[], texture: HTMLCanvasElement|null,
 *   scene: object, saved: number|null, preview: number|null, onPreview: (n: number|null) => void,
 *   onUse?: (n: number, winter: boolean) => Promise<void> }} props
 */
export function CollarPicker({ pack, collars, baseParts, texture, scene, saved, preview, onPreview, onUse }) {
  const thumbs = useRef(new Map());
  const [winter, setWinter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [thumbError, setThumbError] = useState(null);
  const current = preview ?? saved;

  // Thumbnails: one offscreen WebGL context shared by the whole app (sharedThumbRenderer), a few collars per
  // frame so the page stays responsive. The context is never destroyed here: creating one per render made the
  // browser drop the main viewer's context ("WebGL context was lost").
  useEffect(() => {
    if (!pack || !baseParts.length || !collars.length) return undefined;
    const R = sharedThumbRenderer(THUMB * RENDER_SCALE);
    if (!R) { setThumbError('No se pudieron dibujar las miniaturas (WebGL no disponible).'); return undefined; }
    setThumbError(null);
    const off = R.gl.canvas;
    const L = lightState(scene.light);
    KitGL.setTex(R, 0, texture);
    KitGL.setTex(R, 4, L.env.canvas);
    const full = fitParts(baseParts);
    if (!preparedScenes.has(baseParts)) preparedScenes.set(baseParts, { occluder: null, scenes: new Map() });
    const cache = preparedScenes.get(baseParts);
    // Same preparation as the main viewer: contact shadows, smoothing and the lining marked as the inside of the
    // neck (kitRefine, against the shirt), normals welded to the shirt so the seam shows no line.
    const prepared = (n, m) => {
      if (!cache.scenes.has(n)) {
        cache.occluder ??= buildOccluder(baseParts.flatMap(p => p.m.meshes));
        const collar = refineCollar({ k: 'collar', m }, cache.occluder, full.radius);
        cache.scenes.set(n, { parts: weldNormals([...baseParts, collar]), focus: fitParts([collar]) });
      }
      return cache.scenes.get(n);
    };
    let i = 0, raf = 0, cancelled = false;
    const step = () => {
      if (cancelled) return;
      if (R.gl.isContextLost()) { setThumbError('Se perdió el contexto WebGL de las miniaturas; se vuelven a dibujar al cambiar de kit.'); return; }
      try { drawSome(); } catch (e) { setThumbError(`No se pudieron dibujar las miniaturas: ${e?.message || e}`); return; }
      if (i < collars.length) raf = requestAnimationFrame(step);
    };
    const drawSome = () => {
      const t0 = performance.now();
      while (i < collars.length && performance.now() - t0 < FRAME_BUDGET_MS) {
        const n = collars[i++];
        const m = collarModel(pack, n);
        const target = thumbs.current.get(n);
        if (!m || !target) continue;
        const { parts, focus } = prepared(n, m);
        KitGL.upload(R, parts);
        const fr = Math.max(focus.radius, full.radius * 0.18);
        KitGL.draw(R, {
          // Framed on the collar (the whole opening and the front panel in view), seen from the
          // front-left and slightly above.
          fit: { ...full, center: [focus.center[0], focus.center[1] + fr * 0.1, focus.center[2]] }, yaw: full.yaw0 + 0.3, pitch: 0.36,
          dist: fr * 4.6, fov: 36,
          panX: 0, panY: 0, ortho: false, bg: false, bump: 1, nrm: false, glossK: 1, debug: 0, defSpec: 0.3, defRough: 0.6, L,
          textured: scene.textured, colors: scene.colors, ao: 1,
        });
        const g = target.getContext('2d');
        g.clearRect(0, 0, target.width, target.height);
        g.drawImage(off, 0, 0, target.width, target.height);
      }
    };
    raf = requestAnimationFrame(step);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [pack, collars, baseParts, texture, scene]);

  const use = async () => {
    setBusy(true); setError(null);
    try { await onUse(current, winter); onPreview(null); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (!collars.length) return <p className="text-2xs text-ink-3">Los modelos 3D no tienen cuellos para este kit.</p>;
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Cuellos disponibles" className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
        {collars.map(n => (
          <button key={n} type="button" aria-pressed={n === current} aria-label={`Cuello ${n}${n === saved ? ', guardado' : ''}`} title={`Cuello ${n}${n === saved ? ' (guardado)' : ''}`}
            onClick={() => onPreview(n === saved ? null : n)}
            className={`relative rounded-lg border p-0.5 transition-[border-color,background-color,scale] duration-fast active:scale-[0.97] ${n === current ? 'border-accent bg-accent-deep' : 'border-line/[0.12] hover:border-line/30'}`}>
            <canvas ref={el => { if (el) thumbs.current.set(n, el); else thumbs.current.delete(n); }} width={THUMB * RENDER_SCALE} height={THUMB * RENDER_SCALE} className="w-full aspect-square rounded-md bg-canvas" />
            <span className="absolute bottom-1 left-1 num text-2xs font-semibold text-ink bg-canvas/85 rounded px-1">{n}</span>
            {n === saved && <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-success-soft" aria-label="guardado" />}
          </button>
        ))}
      </div>
      {preview != null && preview !== saved && (
        <div className="animate-in fade-in space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-ink-2" role="status"><Eye className="w-3.5 h-3.5" aria-hidden="true" />Viendo el cuello {preview} (sin guardar).</p>
          {onUse && (
            <>
              <label className="flex items-center gap-2 min-h-10 text-xs text-ink-2 cursor-pointer"><input type="checkbox" checked={winter} onChange={e => setWinter(e.target.checked)} className="w-4 h-4 accent-[rgb(var(--c-accent))]" />También como cuello de invierno (WinterCollar)</label>
              <Button variant="primary" disabled={busy} onClick={use}><Check className="w-4 h-4" aria-hidden="true" />{busy ? 'Guardando…' : `Usar el cuello ${preview}`}</Button>
            </>
          )}
          <Button onClick={() => onPreview(null)}><Undo2 className="w-4 h-4" aria-hidden="true" />Volver al guardado{saved ? ` (${saved})` : ''}</Button>
          {!onUse && <p className="text-2xs text-ink-3">Solo lectura: podés ver los cuellos pero no cambiar el config.txt.</p>}
        </div>
      )}
      {thumbError && <p className="text-2xs text-warning-soft">{thumbError}</p>}
      {error && <p className="text-2xs text-danger-soft" role="alert">{error.message}</p>}
    </div>
  );
}
