import React, { useEffect, useRef, useState } from 'react';
import { Check, Eye, Undo2 } from 'lucide-react';
import { Button } from '../PesUi.jsx';
import { KitGL, lightState, sharedThumbRenderer } from './kitRenderer.js';
import { collarModel, fitParts } from '../../../pes/kits/kitModels.js';

const THUMB = 72;
const FRAME_BUDGET_MS = 12;

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
    const R = sharedThumbRenderer(THUMB * 2);
    if (!R) { setThumbError('No se pudieron dibujar las miniaturas (WebGL no disponible).'); return undefined; }
    setThumbError(null);
    const off = R.gl.canvas;
    const L = lightState(scene.light);
    KitGL.setTex(R, 0, texture);
    KitGL.setTex(R, 4, L.env.canvas);
    const full = fitParts(baseParts);
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
        KitGL.upload(R, [...baseParts, { k: 'collar', m }]);
        const focus = fitParts([{ k: 'collar', m }]);
        KitGL.draw(R, {
          fit: { ...full, center: focus.center }, yaw: full.yaw0 + 0.35, pitch: 0.42, dist: full.radius * 0.95, fov: 40,
          panX: 0, panY: 0, ortho: false, bg: false, bump: 1, nrm: false, glossK: 1, debug: 0, defSpec: 0.3, defRough: 0.6, L,
          textured: scene.textured, colors: scene.colors,
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

  if (!collars.length) return <p className="text-[11px] text-ink-3">Los modelos 3D no tienen cuellos para este kit.</p>;
  return (
    <div className="space-y-2">
      <div role="listbox" aria-label="Cuellos disponibles" className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
        {collars.map(n => (
          <button key={n} type="button" role="option" aria-selected={n === current} title={`Cuello ${n}${n === saved ? ' (guardado)' : ''}`}
            onClick={() => onPreview(n === saved ? null : n)}
            className={`relative rounded-lg border p-0.5 transition-colors ${n === current ? 'border-accent bg-accent/10' : 'border-line/[0.12] hover:border-line/30'}`}>
            <canvas ref={el => { if (el) thumbs.current.set(n, el); else thumbs.current.delete(n); }} width={THUMB * 2} height={THUMB * 2} className="w-full aspect-square rounded-md bg-canvas" />
            <span className="absolute bottom-1 left-1 num text-[10px] font-semibold text-ink bg-black/55 rounded px-1">{n}</span>
            {n === saved && <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-success-soft" aria-label="guardado" />}
          </button>
        ))}
      </div>
      {preview != null && preview !== saved && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] text-ink-2"><Eye className="w-3.5 h-3.5" />Viendo el cuello {preview} (sin guardar).</p>
          {onUse && (
            <>
              <label className="flex items-center gap-2"><input type="checkbox" checked={winter} onChange={e => setWinter(e.target.checked)} />También como cuello de invierno (WinterCollar)</label>
              <Button variant="primary" disabled={busy} onClick={use}><Check className="w-3.5 h-3.5" />{busy ? 'Guardando…' : `Usar el cuello ${preview}`}</Button>
            </>
          )}
          <Button onClick={() => onPreview(null)}><Undo2 className="w-3.5 h-3.5" />Volver al guardado{saved ? ` (${saved})` : ''}</Button>
          {!onUse && <p className="text-[11px] text-ink-3">Solo lectura: podés ver los cuellos pero no cambiar el config.txt.</p>}
        </div>
      )}
      {thumbError && <p className="text-[11px] text-warning-soft">{thumbError}</p>}
      {error && <p className="text-[11px] text-danger-soft" role="alert">{error.message}</p>}
    </div>
  );
}
