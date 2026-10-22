// Arranque fuera de index.html para que la Content-Security-Policy no necesite 'unsafe-inline' en scripts
// (docs/SECURITY_AUDIT.md, S4). Se carga sin defer en el <head>: el tema oscuro se aplica antes del primer pintado.
document.documentElement.classList.add('dark');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}
