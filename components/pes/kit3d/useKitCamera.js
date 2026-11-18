import { useCallback, useEffect, useRef, useState } from 'react';

// Camera of the 3D kit viewer, like a model viewer: left drag turns, right (or middle, or Shift + left) drag moves,
// the wheel zooms towards the pointer, two fingers pan and pinch. Preset views (front, back, side, collar) glide
// there (ease-out, ~320 ms). A turn released while still moving coasts to a stop, and auto-turn spins the kit
// slowly; both, like the glide, are skipped with reduced motion. `intercept` lets the lettering editor take a left
// drag that starts on the name or a number.

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

const COAST_FRICTION = 0.995; // share of the turn speed kept per millisecond after release
const COAST_STOP = 2e-5; // rad/ms: slower than this the coast stops
const COAST_MAX_IDLE_MS = 80; // a finger held still this long before lifting does not coast
const AUTO_TURN = 0.00035; // rad/ms, one turn in ~18 s

/** Turn speed (rad/ms) after dt ms of coasting; 0 once it is too slow to see. */
export function decayVelocity(v, dt) {
  const next = v * COAST_FRICTION ** dt;
  return Math.abs(next) < COAST_STOP ? 0 : next;
}

/**
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @param {{ viewRef: React.MutableRefObject<object>, fitRef: React.MutableRefObject<object>, draw: () => void,
 *   intercept?: { down: (e: PointerEvent) => boolean, move: (e: PointerEvent) => void, up: (e: PointerEvent) => void,
 *   wheel?: (e: WheelEvent) => boolean, hover?: (e: PointerEvent) => void } }} o
 * @returns {{ glideTo: (target: object, id?: string) => void, active: string|null, autoTurn: boolean,
 *   setAutoTurn: (on: boolean) => void }}
 *   active: id of the preset view on screen, null once the camera was moved by hand.
 */
export function useKitCamera(canvasRef, { viewRef, fitRef, draw, intercept }) {
  const live = useRef({ draw, intercept });
  live.current = { draw, intercept };
  const anim = useRef(null);
  // coast after a turn and auto-turn share one animation loop
  const spin = useRef({ raf: 0, last: 0, velocity: 0, auto: false, dragging: false });
  const [active, setActive] = useState('front');
  const [autoTurn, setAutoTurnState] = useState(false);

  const stopGlide = () => { if (anim.current) cancelAnimationFrame(anim.current); anim.current = null; };

  const spinStep = useCallback(now => {
    const s = spin.current;
    s.raf = 0;
    const dt = s.last ? Math.min(64, now - s.last) : 16;
    s.last = now;
    if (!s.dragging && !anim.current) {
      if (s.velocity) { viewRef.current.yaw += s.velocity * dt; s.velocity = decayVelocity(s.velocity, dt); }
      if (s.auto) viewRef.current.yaw += AUTO_TURN * dt;
      live.current.draw();
    }
    if (s.velocity || s.auto) s.raf = requestAnimationFrame(spinStep);
    else s.last = 0;
  }, [viewRef]);
  const startSpin = useCallback(() => {
    if (!spin.current.raf) spin.current.raf = requestAnimationFrame(spinStep);
  }, [spinStep]);

  const setAutoTurn = useCallback(on => {
    spin.current.auto = Boolean(on) && !prefersReducedMotion();
    setAutoTurnState(spin.current.auto);
    if (spin.current.auto) { setActive(null); startSpin(); }
  }, [startSpin]);

  useEffect(() => () => cancelAnimationFrame(spin.current.raf), []);

  const glideTo = (target, id = null) => {
    stopGlide();
    // a chosen view stays on screen: it stops a coast and auto-turn
    spin.current.velocity = 0;
    if (spin.current.auto) { spin.current.auto = false; setAutoTurnState(false); }
    setActive(id);
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

    const S = spin.current;
    const manual = () => { stopGlide(); setActive(null); };
    const startPinch = () => {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      mode = 'pinch';
    };
    const down = e => {
      if (e.button === 1) e.preventDefault(); // middle button pans; without this Windows starts autoscroll
      stopGlide();
      S.velocity = 0;
      S.dragging = true;
      c.focus({ preventScroll: true });
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture(e.pointerId);
      if (pointers.size >= 2) {
        // Second finger: pinch and pan replace whatever the first finger was doing.
        if (mode === 'letter') live.current.intercept?.up(e);
        manual();
        startPinch();
        return;
      }
      const wantsPan = e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey);
      if (!wantsPan && e.button === 0 && live.current.intercept?.down(e)) { mode = 'letter'; return; }
      manual();
      mode = wantsPan ? 'pan' : 'turn';
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
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
      const now = performance.now(), dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (mode === 'pan') panBy(dx, dy);
      else {
        const turn = dx * 0.011;
        // smoothed turn speed, used for the coast when the button or finger is released
        S.velocity = 0.7 * S.velocity + 0.3 * (turn / Math.max(1, now - last.t));
        V.yaw += turn; V.pitch = clamp(V.pitch + dy * 0.008, -1.2, 1.2);
      }
      last = { x: e.clientX, y: e.clientY, t: now };
      redraw();
    };
    const up = e => {
      if (!pointers.delete(e.pointerId)) return;
      if (mode === 'letter') live.current.intercept?.up(e);
      if (pointers.size >= 2) { startPinch(); return; } // 3 → 2 fingers: pinch again from where they are
      if (pointers.size === 1) {
        if (mode === 'pinch') { const [p] = [...pointers.values()]; mode = 'turn'; last = { ...p, t: performance.now() }; S.velocity = 0; }
        return;
      }
      // coast only after a turn that was still moving when released
      const coasts = mode === 'turn' && last && performance.now() - last.t <= COAST_MAX_IDLE_MS && !prefersReducedMotion();
      if (!coasts) S.velocity = 0;
      mode = null; last = null; pinch = null; delete c.dataset.drag;
      S.dragging = false;
      if (S.velocity || S.auto) startSpin();
    };
    const wheel = e => {
      e.preventDefault();
      if (live.current.intercept?.wheel?.(e)) return;
      manual();
      zoomAt(1 + Math.sign(e.deltaY) * 0.1, e.clientX, e.clientY);
    };
    const key = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // page zoom (Ctrl +/−/0) and history (Alt+arrows) stay the browser's
      const s = e.shiftKey ? 0.3 : 0.12;
      const act = {
        ArrowLeft: () => { V.yaw -= s; }, ArrowRight: () => { V.yaw += s; },
        ArrowUp: () => { V.pitch = Math.min(1.2, V.pitch + s * 0.6); }, ArrowDown: () => { V.pitch = Math.max(-1.2, V.pitch - s * 0.6); },
        '+': () => setDist(dist() * 0.9), '=': () => setDist(dist() * 0.9), '-': () => setDist(dist() * 1.1),
      }[e.key];
      if (e.key === '0') { e.preventDefault(); glideTo(DEFAULT_VIEW, 'front'); return; }
      if (act) { e.preventDefault(); manual(); act(); redraw(); }
    };
    const menu = e => e.preventDefault();
    const reset = () => glideTo(DEFAULT_VIEW, 'front');
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
  }, [canvasRef, viewRef, fitRef, startSpin]);

  return { glideTo, active, autoTurn, setAutoTurn };
}
