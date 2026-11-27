// Scroll behaviour that respects prefers-reduced-motion. A JS `behavior: 'smooth'` overrides the CSS
// `scroll-behavior: auto` of the reduced-motion block in index.css, so each call has to ask.
// Safe without a browser (SSR, Vitest node env): falls back to 'auto'.
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/** 'auto' when the user asks for reduced motion, 'smooth' otherwise (and 'smooth' when it cannot be told). */
export function scrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
