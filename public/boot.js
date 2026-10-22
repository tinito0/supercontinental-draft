// Arranque fuera de index.html para que la Content-Security-Policy no necesite 'unsafe-inline' en scripts
// (docs/SECURITY_AUDIT.md, S4). Se carga sin defer en el <head>: el tema oscuro se aplica antes del primer pintado.
document.documentElement.classList.add('dark');

// Fuentes de OBS: fondo transparente desde el primer pintado, antes de que cargue React (main.jsx decide la escena
// con utils/obsScenes.resolveObsRequest; esta es la misma condición, simplificada).
(function () {
  var path = window.location.pathname.toLowerCase();
  if (path.indexOf('/draft/overlay') === 0 || /[?&]mode=obs(&|$)/.test(window.location.search)) {
    document.documentElement.classList.add('obs-source');
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}
