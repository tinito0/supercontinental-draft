import { useEffect, useRef } from 'react';

// Camera of the 3D kit viewer, like a model viewer: left drag turns, right (or middle, or Shift + left) drag moves,
// the wheel zooms towards the pointer, two fingers pan and pinch. Preset views (front, back, collar) glide there
// (ease-out, ~320 ms; instant with reduced motion). `intercept` lets the lettering editor take a left drag that
// starts on the name or a number.

export const DEFAULT_VIEW = { yaw: 0, pitch: 0.1, dist: 0, panX: 0, panY: 0 };
const FOV = 48;
const tanHalf = Math.tan((FOV * Math.PI) / 360);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Distance used when the view has none yet (the framing of the whole kit). */
export const baseDistance = fit => (fit?.radius || 1) * 2.7;

/**
 * Pan offset that keeps the point under the cursor in place when the distance changes from d0 to d1.
 * ndc: cursor in normalized device coordinates (−1…1), aspect: width / height.
 */
export function zoomPan(view, ndc, aspect, d0, d1) {
  return {
    panX: view.panX + ndc[0] * tanHalf * aspect * (d0 - d1),
    panY: view.panY + ndc[1] * tanHalf * (d0 - d1),
  };
}

/** World units per CSS pixel at the target plane, for panning by dragging. */
export const panPerPixel = (dist, cssHeight) => (2 * dist * tanHalf) / Math.max(1, cssHeight);

/** Shortest turn from a to b (radians), so a glide to the back never spins the long way round. */
export const shortestYaw = (a, b) => a + ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

/**
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @param {{ viewRef: React.MutableRefObject<object>, fitRef: React.MutableRefObject<object>, draw: () => void,
 *   intercept?: { down: (e: PointerEvent) => boolean, move: (e: PointerEvent) => void, up: (e: PointerEvent) => void,
 *   wheel?: (e: WheelEvent) => boolean, hover?: (e: PointerEvent) => void } }} o
 * @returns {{ glideTo: (target: object) => void }}
 */
export function useKitCamera(canvasRef, { viewRef, fitRef, draw, intercept }) {
  const live = useRef({ draw, intercept });
  live.current = { draw, intercept };
  const anim = useRef(null);

  const stopGlide = () => { if (anim.current) cancelAnimationFrame(anim.current); anim.current = null; };

  const glideTo = target => {
    stopGlide();
    const V = viewRef.current, from = { ...V };
    const to = { ...DEFAULT_VIEW, ...target };
    to.yaw = shortestYaw(from.yaw, to.yaw);
    const d0 = from.dist || baseDistance(fitRef.current), d1 = to.dist || baseDistance(fitRef.current);
    if (prefersReducedMotion()) { Object.assign(V, to); live.current.draw(); return; }
    const start = performance.now(), ms = 320;
    const step = now => {
      const t = Math.min(1, (now - start) / ms), e = 1 - (1 - t) ** 3;
      V.yaw = from.yaw + (to.yaw - from.yaw) * e;
      V.pitch = from.pitch + (to.pitch - from.pitch) * e;
      V.dist = d0 + (d1 - d0) * e;
      V.panX = from.panX + (to.panX - from.panX) * e;
      V.panY = from.panY + (to.panY - from.panY) * e;
      live.current.draw();
      anim.current = t < 1 ? requestAnimationFrame(step) : null;
      if (t >= 1 && !target.dist) V.dist = 0;
    };
    anim.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return undefined;
    const V = viewRef.current;
    const pointers = new Map();
    let mode = null; // 'turn' | 'pan' | 'letter' | 'pinch'
    let last = null, pinch = null;
    const dist = () => V.dist || baseDistance(fitRef.current);
    const maxPan = () => (fitRef.current?.radius || 1) * 1.3;
    const setDist = d => { const r = fitRef.current?.radius || 1; V.dist = clamp(d, r * 0.2, r * 7); };
    const redraw = () => live.current.draw();
    const ndcOf = (x, y) => { const b = c.getBoundingClientRect(); return [((x - b.left) / b.width) * 2 - 1, 1 - ((y - b.top) / b.height) * 2]; };
    const zoomAt = (factor, x, y) => {
      const d0 = dist(); setDist(d0 * factor);
      const b = c.getBoundingClientRect();
      Object.assign(V, zoomPan(V, ndcOf(x, y), b.width / Math.max(1, b.height), d0, V.dist));
      V.panX = clamp(V.panX, -maxPan(), maxPan()); V.panY = clamp(V.panY, -maxPan(), maxPan());
      redraw();
    };
    const panBy = (dx, dy) => {
      const k = panPerPixel(dist(), c.getBoundingClientRect().height);
      V.panX = clamp(V.panX - dx * k, -maxPan(), maxPan());
      V.panY = clamp(V.panY + dy * k, -maxPan(), maxPan());
    };

    const down = e => {
      stopGlide();
      c.focus({ preventScroll: true });
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        // Second finger: pinch and pan replace whatever the first finger was doing.
        if (mode === 'letter') live.current.intercept?.up(e);
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        mode = 'pinch';
        return;
      }
      const wantsPan = e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey);
      if (!wantsPan && e.button === 0 && live.current.intercept?.down(e)) { mode = 'letter'; return; }
      mode = wantsPan ? 'pan' : 'turn';
      last = { x: e.clientX, y: e.clientY };
      c.dataset.drag = mode;
    };
    const move = e => {
      if (!pointers.has(e.pointerId)) { live.current.intercept?.hover?.(e); return; }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'letter') { live.current.intercept?.move(e); return; }
      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        panBy(mx - pinch.mx, my - pinch.my);
        if (pinch.d > 0 && d > 0) zoomAt(pinch.d / d, mx, my); else redraw();
        pinch = { d, mx, my };
        return;
      }
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      if (mode === 'pan') panBy(dx, dy);
      else { V.yaw += dx * 0.011; V.pitch = clamp(V.pitch + dy * 0.008, -1.2, 1.2); }
      redraw();
    };
    const up = e => {
      pointers.delete(e.pointerId);
      if (mode === 'letter') live.current.intercept?.up(e);
      if (pointers.size === 0) { mode = null; last = null; pinch = null; delete c.dataset.drag; }
      else if (mode === 'pinch' && pointers.size === 1) { const [p] = [...pointers.values()]; mode = 'turn'; last = { ...p }; }
    };
    const wheel = e => {
      e.preventDefault();
      stopGlide();
      if (live.current.intercept?.wheel?.(e)) return;
      zoomAt(1 + Math.sign(e.deltaY) * 0.1, e.clientX, e.clientY);
    };
    const key = e => {
      const s = e.shiftKey ? 0.3 : 0.12;
      const act = {
        ArrowLeft: () => { V.yaw -= s; }, ArrowRight: () => { V.yaw += s; },
        ArrowUp: () => { V.pitch = Math.min(1.2, V.pitch + s * 0.6); }, ArrowDown: () => { V.pitch = Math.max(-1.2, V.pitch - s * 0.6); },
        '+': () => setDist(dist() * 0.9), '=': () => setDist(dist() * 0.9), '-': () => setDist(dist() * 1.1),
      }[e.key];
      if (e.key === '0') { e.preventDefault(); glideTo(DEFAULT_VIEW); return; }
      if (act) { e.preventDefault(); stopGlide(); act(); redraw(); }
    };
    const menu = e => e.preventDefault();
    const reset = () => glideTo(DEFAULT_VIEW);
    const ro = new ResizeObserver(() => redraw());
    ro.observe(c);
    const listeners = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up],
      ['wheel', wheel, { passive: false }], ['keydown', key], ['dblclick', reset], ['contextmenu', menu]];
    for (const [type, fn, opt] of listeners) c.addEventListener(type, fn, opt);
    return () => {
      stopGlide();
      ro.disconnect();
      for (const [type, fn] of listeners) c.removeEventListener(type, fn);
    };
  }, [canvasRef, viewRef, fitRef]);

  return { glideTo };
}
