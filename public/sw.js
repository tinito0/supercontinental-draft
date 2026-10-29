// v2: catálogo compacto (jugadores.compact.json). Al activar se borra la caché v1 con el JSON de ~60 MB.
const CACHE_NAME = 'players-db-v2';
// v2: fotos en su propia caché con tope, y sin el HTML que el hosting devuelve (200) para una foto que no existe:
// la v1 lo guardaba como si fuera la foto. Al activar se borran las cachés anteriores.
const STATIC_CACHE = 'scl-static-v2';
const PHOTO_CACHE = 'scl-photos-v1';
// Topes: cada deploy agrega JS/CSS con hash nuevo y cada jugador visto una foto; sin tope crecían para siempre.
const MAX_STATIC_ENTRIES = 300;
const MAX_PHOTO_ENTRIES = 2500;

/** Deletes the oldest entries beyond maxEntries (cache.keys() keeps insertion order). */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)));
}

const isImage = response => (response.headers.get('Content-Type') || '').startsWith('image/');

// Assets to precache on install (excluding jugadores.json — it's too large for precache,
// we handle it with a CacheFirst runtime strategy)
const PRECACHE_URLS = [
  '/',
  '/paises.json',
  '/logo.webp',
  '/manifest.json',
];

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== STATIC_CACHE && key !== PHOTO_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: CacheFirst for jugadores.json, NetworkFirst for HTML, Cache for static
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept Firebase requests
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase.googleapis.com") ||
    url.includes("identitytoolkit.googleapis.com") ||
    url.includes("securetoken.googleapis.com") ||
    url.includes("firebaseapp.com/__/auth")
  ) {
    return; // Let browser handle it natively
  }

  const parsedUrl = new URL(url);

  // Catálogo de jugadores (compacto o el JSON original de respaldo) — CacheFirst, se actualiza en segundo plano
  if (parsedUrl.pathname.endsWith('/jugadores.compact.json') || parsedUrl.pathname.endsWith('/jugadores.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          // Serve from cache, but update in background (stale-while-revalidate)
          event.waitUntil(
            fetch(event.request).then(response => {
              if (response.ok) cache.put(event.request, response);
            }).catch(() => { /* offline — ignore */ })
          );
          return cached;
        }
        // Not in cache — fetch and cache it
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch (err) {
          // A cache miss must never look like a genuinely empty market.
          return new Response(JSON.stringify({ error: 'offline-cache-miss' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })
    );
    return;
  }

  // paises.json — CacheFirst
  if (parsedUrl.pathname.endsWith('/paises.json')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Fotos de jugadores — CacheFirst. Son assets estáticos que prácticamente nunca
  // cambian (a diferencia del HTML/JS de la app), así que no tiene sentido pedirle
  // red cada vez que una card vuelve a montarse al scrollear una lista virtualizada.
  // Antes usaban la estrategia genérica NetworkFirst de abajo — pedían red SIEMPRE,
  // el caché era solo un fallback si la red fallaba. Acá se invierte: primero
  // caché, y solo se pide red si no está.
  // También se cachea el 404 cuando la foto directamente no existe en el servidor
  // (jugador sin foto subida) — sin esto, cada remount de esa card reintentaba el
  // fetch completo de nuevo, contribuyendo a inflar el conteo de requests.
  if (parsedUrl.pathname.includes('/fotos_jugadores/')) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const fetched = await fetch(event.request);
          // A missing photo comes back as the app's index.html with a 200 (the hosting rewrite): that is a 404
          // for the <img>, not a photo to keep.
          const response = fetched.ok && !isImage(fetched)
            ? new Response(null, { status: 404, statusText: 'Not Found (no photo)' })
            : fetched;
          // Se cachea tanto la foto real como el 404 (no existe): para ESE jugador no va a cambiar.
          if (response.ok || response.status === 404) {
            cache.put(event.request, response.clone());
            event.waitUntil(trimCache(PHOTO_CACHE, MAX_PHOTO_ENTRIES));
          }
          return response;
        } catch (err) {
          // Sin red y sin caché — no hay nada que devolver, se deja que el <img>
          // del lado del cliente maneje el error (ya tiene onError para eso).
          return new Response(null, { status: 404, statusText: 'Not Found (offline)' });
        }
      })
    );
    return;
  }

  // Navigation requests — NetworkFirst (for SPA routing)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // All other requests — NetworkFirst with cache fallback
  event.respondWith(
    fetch(event.request).then(response => {
      // Cache successful GET responses for static assets
      if (response.ok && event.request.method === 'GET' && parsedUrl.origin === self.location.origin) {
        const clone = response.clone();
        event.waitUntil(
          caches.open(STATIC_CACHE)
            .then(cache => cache.put(event.request, clone))
            .then(() => trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES))
        );
      }
      return response;
    }).catch(() =>
      // caches.match() puede resolver `undefined` si nunca se cacheó (ej. una foto
      // de jugador que directamente no existe, 404 real) — un ServiceWorker NO puede
      // devolver `undefined` en respondWith(), eso es justo el "unexpected error" que
      // tira el browser. Con este fallback, un fetch fallido y sin caché se resuelve
      // como un 404 real (silencioso), en vez de reintentar fetch completo cada vez
      // que la card vuelve a montarse al scrollear.
      caches.match(event.request).then(cached => cached || new Response(null, { status: 404, statusText: 'Not Found (offline/no-cache)' }))
    )
  );
});
