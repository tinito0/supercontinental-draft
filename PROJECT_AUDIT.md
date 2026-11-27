# Auditoría integral: Supercontinental League (SCL Draft)

Fecha: 2026-11-27. Estado auditado: árbol de trabajo de `master` (incluye los cambios sin commitear del momento).
Tipo: solo análisis. No se modificó código, configuración ni datos. Este archivo es el único creado.

---

## 0. Cómo leer este documento

**Método.** Un coordinador (Opus 5.5) repartió la auditoría en 11 subagentes (Haiku), uno por área. Cada uno leyó el código por su cuenta y sin ejecutar la app. El coordinador contrastó los informes, eliminó duplicados y volvió a verificar en el código los hallazgos más graves o dudosos. Para las interfaces se aplicaron Anti-Slop (modo AFTER, elegido en la sesión) e Impeccable. Las reglas citadas como `R-XX` son de `.claude/skills/antislop/`. "DS" es `docs/DESIGN_SYSTEM.md`.

**Estado de cada hallazgo:**

| Etiqueta | Significado |
| --- | --- |
| **VERIFICADO** | El coordinador lo comprobó en el código durante la consolidación. |
| **COMPROBADO** | El subagente lo comprobó leyendo el código y el coordinador no lo volvió a revisar. |
| **SOSPECHA** | Es una inferencia o depende del runtime (render, datos reales, secrets en producción). Hay que confirmarlo antes de actuar. |

**Severidad:**

| Nivel | Criterio |
| --- | --- |
| CRÍTICO | Pérdida de datos o brecha de seguridad explotable en producción. |
| ALTO | Bug real con impacto en usuarios o en la integridad del juego, o deuda que bloquea el trabajo diario. |
| MEDIO | Problema de mantenibilidad, consistencia o UX con un costo concreto. |
| BAJO | Detalle de pulido o de higiene. |

**Límites.**
- No se renderizó la app. Todo lo de 360 px, contraste medido y animación sale del código y es SOSPECHA mientras no se mida.
- No se ejecutaron `npm run test:rules` ni `npm audit`.
- `npm test` sí se ejecutó (ver §5.3).
- Los subagentes corrieron con Haiku, como se pidió. Por eso el coordinador re-verificó los hallazgos ALTO y descartó uno falso (§6).

---

## 1. Resumen ejecutivo

**No hay hallazgos CRÍTICOS comprobados.** La seguridad del mercado está bien resuelta: el dinero y la propiedad de jugadores se escriben en el servidor, y las reglas bloquean al navegador. Tampoco hay secretos en git y `vendor/` está ignorado. Los riesgos de la auditoría de seguridad anterior (S1, S2, S3, S7) están cerrados en el código.

El estado real tiene tres problemas de fondo que se repiten en casi todas las secciones:

1. **"Error se ve como vacío".** Cuando falla una lectura de Firestore, muchas pantallas muestran un estado vacío, un esqueleto que no termina o un número falso. No muestran un error.
   - Lo peor: Finanzas puede mostrar el presupuesto completo como disponible si no cargan los contratos (FIN-2).
   - Mismo patrón en Rivales (esqueleto infinito), en Scouting («no mandaste ningún ojeador») y en Admin («no hay equipos registrados»).
   - Es el hallazgo transversal más importante (T-1).
2. **Reglas de juego que solo viven en el cliente.** Tres casos:
   - El reglamento de plantel (banco ≥ 73, plantel ≥ 21, 7 locales) no lo valida ni `firestore.rules` ni la función `market` (REG-1).
   - El scouting se resuelve en el navegador del mánager, que puede escribir sus propios resultados (SCO-2, SCO-3).
   - El editor PES no tiene control de concurrencia entre administradores (PES-2, PES-3).
3. **Cambios del usuario que se pierden sin aviso.** Pasa en tres lugares:
   - La Pizarra descarta en silencio la alineación al cerrar si el banco no cumple (PIZ-1).
   - Admin pierde borradores al cambiar de pestaña (ADM-8).
   - El editor PES reaplica borradores locales encima de cambios remotos (PES-3).

A esto se suma una deuda estructural conocida y medida:
- `App()` en `app.jsx` es una sola función de unas 2.043 líneas, con 51 `useState` y 25 `useEffect`.
- Cuatro componentes superan las 800 líneas.
- `npm test` no da verde en local: 3 timeouts en tests con archivos reales.
- No hay cobertura configurada.

En diseño, el sistema existe y en buena parte se cumple: `components/ui`, foco visible, `prefers-reduced-motion`, `Tabs` accesible. Pero hay deriva:
- tamaños de texto sueltos (`text-[11px]` ~40 veces);
- colores hex fuera de tokens;
- dos grises distintos entre la liga y el draft;
- colores de gráficos que no coinciden con los chips de posición;
- vocabulario inestable («Táctica» nombra tres cosas distintas).

**Las cinco acciones con mejor relación impacto/esfuerzo:**
1. Distinguir error de vacío en Finanzas, Rivales, Scouting y Admin (T-1).
2. Bloquear Exportar en el editor PES si hay operaciones que no se reaplicaron (PES-4).
3. Avisar antes de descartar la alineación en la Pizarra (PIZ-1).
4. Mostrar el reembolso al liberar un jugador (PLA-2).
5. Completar la lista del reseteo de temporada (ADM-4).

Cada una es un cambio chico. El detalle está en §7 y §8.

---

## 2. Arquitectura actual

**Stack.** React + Vite, JS/JSX sin tipos ni linter, Tailwind. Usa los servicios de Firebase y Supabase de la tabla, Vercel como hosting (deploy por push a `master`) y Vitest para tests.

| Servicio | Qué provee |
| --- | --- |
| Firebase | Auth (email + Google) y Firestore con caché persistente multi-pestaña. |
| Supabase | Edge Functions `market`, `match-feed`, `league-media`, `community-vote`, `overlay-control`, y Storage para texturas PES y medios de la liga. |

**Dos sitios en una página.** `main.jsx` decide antes de montar:
- `/` es el sitio público de la liga (`screens/league/`).
- `/draft` es la app del draft (`app.jsx`, con `BrowserRouter basename="/draft"`).

Un único `ErrorBoundary` envuelve todo (`main.jsx:86-101`).

**Draft.** No usa `<Route>`.
- La pestaña activa sale de `location.pathname` con los mapas `pathToTab`/`tabToPath` (`app.jsx:235-290`).
- Los modales son rutas `/modal/<nombre>`.
- Hay 19 pantallas y modales `React.lazy`.
- `App()` concentra routing, 4 `onSnapshot` propios (`app.jsx:921, 945, 1234, 1412`), lógica de mercado y cableado de modales. El resto de los datos llega por `hooks/useFirebaseData.js` y `hooks/useLeagueData.js`.

**Flujo de datos del mercado.**

```
UI (CartModal / PlayerModal / TransferProposalModal)
  → services/marketService.js  (token de Firebase)
  → Supabase Edge Function "market"  (verifica JWT, precios de _shared/catalog.json)
  → Firestore REST con cuenta de servicio  (player_locks, teams, transfers, offers)
  → onSnapshot en el cliente  → useBudget (mismo budget.js que el servidor)
```

`player_locks` es el único registro de propiedad. `teams/{uid}.budget` es el presupuesto base autoritativo. Las reglas rechazan desde el navegador las escrituras a locks, budget, whitelist, approved y ofertas en `accepted`.

**Colecciones** (rutas armadas como strings; el grafo no las conecta):
- `artifacts/${APP_ID}/public/data/{teams, player_locks, offers, manager_chat, transfers, news, tournament, broadcast, league_content, live_matches, match_lines, config, locks, shared_formations, suggestions}`
- `artifacts/${APP_ID}/users/{uid}/{cart, profile, scout_searches, …}`
- `artifacts/${APP_ID}/presence/{uid}`
- `pes_roles/{uid}`
- `pes_workspaces/{id}/{ops, exports, meta, kit_textures}`

**Editor PES.** Motor puro en `pes/` (`core → formats/pes2021 → operations.js`, `kits/`, `draftTransfer.js`), sin React ni Firebase. La copia de trabajo tiene tres capas:
1. Fuentes originales en IndexedDB por SHA-256, nunca modificadas.
2. Operaciones compartidas en Firestore como JSON en texto.
3. Borradores locales en IndexedDB.

`applyOperations` es atómico por lote con rollback. Exportar reconstruye, vuelve a leer y compara. El manifest declara `gameTested: false`. Los permisos se chequean tres veces (`pes/permissions.js`, `firestore.rules`, `supabase/storage-policies.sql`), con un test de sincronía.

**Puntos únicos de falla.**
- La función `market` vive en un proyecto Supabase gratuito que se pausa tras 7 días sin uso, y no hay monitoreo (ARQ-7).
- El `ErrorBoundary` global hace que un error de render tumbe todo el draft (ARQ-8).

---

## 3. Mapa de la estructura

Archivos versionados por carpeta (`git ls-files`), medidos el 2026-11-27:

```
/                     main.jsx, app.jsx (2.338 líneas), index.html, index.css, landing.css,
                      firestore.rules, vercel.json, firebase.json, vite.config.js
├─ components/  224   UI: modales de feature en la raíz; ui/ (primitivas), admin/ (+obs/),
│                     formation/, league/, landing/, tournament/, broadcast/, marketplace/, pes/
├─ screens/      21   pantallas del draft y league/ (sitio público)
├─ hooks/        29   useAuth, useFirebaseData, useLeagueData, useBudget, useSquadSync, usePesWorkspace…
├─ services/     14   firebase, supabase, marketService, transferService, draftTeamsService…
├─ utils/        70   helpers puros: constants, formationStates, pitchGeometry, squadRules, scoutEngine…
├─ config/        3   firebaseCore
├─ pes/          42   motor PES 2021 (puro)
├─ supabase/     26   Edge Functions + _shared (no puede importar de fuera) + storage-policies.sql
├─ pes-collector/36   puente local juego→OBS/match-feed (Node)
├─ scripts/      23   build del catálogo, compactado de jugadores, claims PES, main.py
├─ tests/       173   Vitest (pes/, league/, rules/, ui/, pesCollector/…)
├─ docs/         21   ARCHITECTURE, PES_ENGINE, DESIGN_SYSTEM, guías y 6 auditorías previas
├─ anti-slop/     7   auditorías y reportes antislop previos (001–005)
├─ public/   43.747   43.701 son fotos de jugadores (fotos_jugadores/*.webp) + jugadores.json
├─ Propuestas/   25   PDFs y plantillas de equipos (incluye un PDF con el UID del admin, SEG-7)
├─ qa-overhaul/   7   harness de QA visual con mocks (fuera del build)
├─ functions/     1   solo data/canonical-players.json (59,8 MB, sin referencias; EST-1)
├─ content/       1   reglamento-temporada-3.json
├─ graphify-out/  7   grafo de conocimiento
├─ .claude/     187   skills y agentes del entorno de desarrollo
└─ vendor/        0   ignorado por git (archivos del juego); correcto
```

---

## 4. Hallazgos transversales (consolidados)

Estos patrones aparecen en varias áreas. Conviene arreglarlos una sola vez, con un patrón común, en lugar de pantalla por pantalla.

| ID | Sev. | Patrón | Dónde aparece | Recomendación |
| --- | --- | --- | --- | --- |
| **T-1** | **ALTO** | **Error de lectura que se ve como vacío, como un esqueleto infinito o como un número falso.** Los listeners solo marcan "cargado" en el éxito y `handleError` solo avisa con un toast. | FIN-2, FIN-12, RIV-1, RIV-3, SCO-5, ADM-1 | Exponer `{ data, status: 'loading' \| 'ready' \| 'error', retry }` desde `useFirebaseData` y los hooks de sección. Renderizar `<Alert tone="danger">` con «Reintentar» y no mostrar cifras hasta `ready`. `GeneralAdminSection.jsx:174` ya tiene el patrón correcto. R-27. |
| **T-2** | **ALTO** | **Reglas de juego validadas solo en el cliente.** | REG-1 (plantel/banco/locales), SCO-2/SCO-3 (scouting), PES-2 (concurrencia) | Mover la validación al servidor, igual que `market`. Ver cada hallazgo. |
| **T-3** | **ALTO** | **Cambios del usuario perdidos sin aviso.** | PIZ-1, ADM-8, PES-3 | Un patrón de guardia `isDirty`: confirmar al cerrar o cambiar de vista, y avisar siempre cuando un guardado queda bloqueado. |
| T-4 | MEDIO | **La propiedad del plantel se lee de más de una fuente.** El carrito o el roster público se usan en vez de `player_locks`, y cada vista cuenta distinto. | PLA-5, RIV-3, REG-5, REG-10 | Toda vista de plantel sale de `player_locks`. Los huérfanos se muestran como aviso, no como jugadores. |
| T-5 | MEDIO | **El lock no guarda el precio pagado** (`supabase/functions/_shared/market.js:129`, VERIFICADO). Saldo, reembolso e «Invertido» usan el precio actual del catálogo. | FIN-9, RIV-4 | Guardar `price` en el lock al fichar, con fallback al catálogo para los locks viejos. |
| T-6 | MEDIO | **Deriva de tokens visuales.** | UX-1, UX-2, UX-3, UX-4, FIN-6, FIN-10, RIV-8, ADM-11 | Escala `fontSize` en `tailwind.config.js` y colores a `--c-*`. Quitar `backdrop-blur`. |
| T-7 | MEDIO | **Vocabulario inestable.** | PIZ-7, PLA-9, ADM-15, SCO-11, REG-8 | Un glosario corto en el DS y etiquetas centralizadas (`utils/squadRules.js` para reglas). |
| T-8 | MEDIO | **Objetivos táctiles por debajo de 44 px.** | PES-1, PIZ-6 | `.btn-sm` y botones de ícono a `min-h-11` en `pointer: coarse` (hoy `index.css:541-543` no los cubre). R-03. |
| T-9 | MEDIO | **La pestaña activa no está en la URL ni enlazada por ARIA.** | PLA-6, ADM-10 | `setSearchParams({ tab }, { replace: true })` y `tabPanelProps` de `components/ui/Tabs.jsx`. |

---

## 5. Hallazgos por área

### 5.1 Estructura y organización

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| EST-1 | MEDIO | VERIFICADO | `public/jugadores.json` = `scripts/jugadores.json` (mismo blob `5f6802f…`, 59,8 MB); `public/jugadores_exportados.csv` = `scripts/jugadores_exportados.csv` (blob `a5b606d…`); `functions/data/canonical-players.json` (59,8 MB, otro blob) | El catálogo de jugadores existe en tres copias. Git deduplica las dos idénticas, así que el costo no está en el repo. El costo es la ambigüedad: los scripts leen `scripts/jugadores.json` y la app `public/jugadores.json`, y si una se regenera sin la otra, divergen sin aviso. `canonical-players.json` no lo referencia ningún archivo (`git grep` vacío). La ruta canónica no está en CLAUDE.md. | Una sola copia fuente: que los scripts escriban `public/` o que un paso de build copie. Borrar `functions/data/` si se confirma que no se usa. Documentar la ruta en CLAUDE.md. |
| EST-2 | MEDIO | VERIFICADO | `app.jsx` (2.338), `components/FormationModal.jsx` (1.015), `components/PlayerModal.jsx` (984), `components/ScoutAssignmentsPanel.jsx` (819) | Cuatro archivos sobre el techo de 800 líneas. Los siguientes en tamaño: `CartModal.jsx` 699, `_shared/market.js` 641, `TournamentModal.jsx` 611, `TeamsAdminSection.jsx` 588. Ver CAL-2…CAL-5. | Extraer antes de agregar nada nuevo a estos archivos. |
| EST-3 | MEDIO | COMPROBADO | `docs/` (6 auditorías + `calibration/` con 5 PNG), `anti-slop/` (5 auditorías + 2 reportes), `README.md` | Hay 11 auditorías históricas y ningún índice de qué sigue abierto. `README.md` está desactualizado (CLAUDE.md lo admite). | Un `docs/STATUS.md` con los hallazgos abiertos y un enlace a cada auditoría. Archivar las cerradas en `docs/archive/`. Reescribir o recortar el README. |
| EST-4 | MEDIO | COMPROBADO | `Propuestas/` (20+ archivos: zip de 6,2 MB, docx, 12 PDF) | Material comercial versionado en el repo del producto, con nombres que tienen espacios, ™ y comillas. Uno de los PDF contiene el UID del admin (SEG-7). | Sacarlo a almacenamiento privado. Si se queda, normalizar los nombres. |
| EST-5 | MEDIO | VERIFICADO | `qa-overhaul/` (7 archivos) | Prototipo de QA sin ningún script, workflow ni import que lo use. Duplica los nombres de `hooks/useLeagueData.js` y `config/firebase.js` con stubs, lo que confunde búsquedas y el grafo. | Borrarlo, o documentarlo en CLAUDE.md junto al harness de QA visual si sigue en uso. |
| EST-6 | MEDIO | VERIFICADO | `AGENTS.md:4-6` vs `.gitignore:19` (`.agents/`) | `AGENTS.md` apunta a `.agents/skills/antislop/…`, pero `.agents/` está ignorado (solo 1 archivo versionado). En un clon limpio esas rutas no existen. CLAUDE.md usa `.claude/skills/`: hay dos fuentes para la misma regla. | Una sola ruta, o versionar `.agents/`. |
| EST-7 | MEDIO | VERIFICADO | `tests/` (113 de 173 archivos sueltos en la raíz) | CLAUDE.md dice que `tests/` refleja la estructura de los fuentes, pero solo lo hacen `pes/`, `pesCollector/`, `league/`, `rules/` y `ui/`. | Mover a carpetas espejo (`tests/utils`, `tests/components`, `tests/hooks`) o corregir CLAUDE.md. |
| EST-8 | MEDIO | VERIFICADO | `.git_private/` en la raíz (~211 MB en disco) | Parece un segundo directorio git de respaldo. Está excluido solo en `.git/info/exclude`, no en `.gitignore`: en otro clon o máquina aparecería como no rastreado. | Moverlo fuera del proyecto. |
| EST-9 | BAJO | VERIFICADO | `docs/ARCHITECTURE.md:117, 124-125`, `CLAUDE.md` | Cifras viejas: "≈2.600" y "~2.900" líneas para `app.jsx` (son 2.338) y "≈1.070" para `FormationModal` (son 1.015). `screens/LandingPage.jsx` figura como "un poco más de 800" y tiene 145. | Corregirlas, o borrar las cifras y dejar solo "más de 800". |
| EST-10 | BAJO | SOSPECHA | `utils/youthDraft.js` y `supabase/functions/_shared/youthDraft.js` | Dos archivos con el mismo nombre y contenido distinto. Es probablemente deliberado (`_shared` no puede importar de afuera), pero `tests/youthDraft.test.js` solo prueba la copia del servidor. No hay test de equivalencia, como sí lo hay para `marketConstants`. | Test de deriva entre ambas copias, o que la app importe la de `_shared`. |
| EST-11 | BAJO | COMPROBADO | `.claude/skills/impeccable/scripts/live-browser.js` (13.925 líneas), `font-index.json` (1,1 MB); `.claude/` con 187 archivos | Herramientas de terceros versionadas. Inflan las métricas de JS y las búsquedas. | Decidir si se regeneran con `npx` en vez de versionarlas. |
| EST-12 | BAJO | COMPROBADO | `content/` (1 JSON), `functions/` (1 dato), `pes/` + `components/pes/` + `pes-collector/` | Carpetas de primer nivel con un solo archivo, y tres áreas "PES" sin una frontera documentada. | Mover `content/` a `scripts/data/`. Documentar qué va en cada área PES. |
| EST-13 | BAJO | COMPROBADO | `pes-collector/bridge/setup.mjs`, `pes-collector/tools/{formationPlan,probe-diff,summarize}.mjs` | Herramientas sin referencias. Pueden estar obsoletas. | Revisar y borrar o documentar. |
| EST-14 | BAJO | COMPROBADO | `public/fotos_jugadores` (43.701 archivos, ~147 MB) | Explica el deploy de ~290 MB y el límite de Vercel. Es una decisión documentada. | Si el plan Hobby vuelve a llenarse, servir las fotos desde un bucket (Supabase `league-media` o CDN). |
| EST-15 | BAJO | COMPROBADO | todo el repo | Nombres de archivos y docs mezclan español e inglés (`AUDITORIA-*`, `GUIA_ADMIN_LIGA`, ids `'My Team'` con etiquetas en español). | Código en inglés y documentación de operación en español, con un patrón de nombre fijo. |

Comprobado sin hallazgo:
- `vendor/` y `firestore-debug.log` están ignorados (el log por `*.log`).
- No hay archivos sin rastrear fuera de lo ignorado.
- No hay código huérfano en `utils/`, `hooks/`, `services/` ni `components/`.

### 5.2 Arquitectura

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| ARQ-1 | ALTO | VERIFICADO | `app.jsx:293-2336` | `App()` es una sola función: 51 `useState`, 25 `useEffect`, 51 `useCallback`/`useMemo` y 4 `onSnapshot` propios. Cualquier cambio de estado re-renderiza el árbol y tiene el mayor radio de impacto del repo. | Extraer por dominio: `useTournamentDoc`, `useBroadcastDoc`, `useOffers`, `useManagerChat`, `useNotifications`, y un componente de contenido por pestaña. Empezar por los 4 `onSnapshot`. |
| ARQ-2 | MEDIO | VERIFICADO | `firestore.rules:15-21, 537-540`; `supabase/functions/_shared/marketConstants.js:4`; `utils/constants.js:382-384`; `scripts/sync-pes-claims.mjs:22` | "Admin" se define en 5 lugares: UID literal, claim `admin` y claim `pes_role == 'super_admin'`. El claim `super_admin` del editor PES cuenta como admin total y, por el catch-all, da escritura sobre todo Firestore. Está documentado como intencional, pero cambiar de admin exige editar y desplegar reglas, funciones y scripts a la vez. | Claim `admin` como única fuente de verdad, y retirar el UID literal. Si `super_admin` no debe tocar el mercado, separarlo de `isAdmin()`. Agregar un test de deriva entre las listas. |
| ARQ-3 | MEDIO | VERIFICADO | `firestore.rules:63-64` | `teams` tiene `allow read: if true`, así que cualquiera sin sesión lee `budget`, `inWhitelist` y `approved` de todos los clubes. Rivales no muestra el presupuesto del rival (VERIFICADO en `TeamsModal.jsx`), así que la UI no lo considera público. | Decidir si el presupuesto es público. Si no lo es, moverlo a un documento con lectura restringida o publicar una proyección sin esos campos. |
| ARQ-4 | MEDIO | COMPROBADO | `hooks/useFirebaseData.js:88,107`; `hooks/useLeagueData.js:76,272` | Listeners sin `limit()` sobre colecciones completas (`player_locks`, `teams`, `league_content`). `teams` se escucha en dos hooks. El documento de torneo quizá dos veces (`app.jsx:921` y `useLeagueData.js:138`, SOSPECHA). | Una sola suscripción por colección compartida (contexto o store) y consultas acotadas por pantalla. |
| ARQ-5 | MEDIO | COMPROBADO | `app.jsx`, `hooks/*`, `screens/TeamScreen.jsx:114`, `services/*` | Rutas `artifacts/${APP_ID}/public/data/...` escritas como string en muchos archivos. Renombrar una colección exige buscar a mano, y el grafo no ve el acoplamiento. | `publicCol(name)` y `userCol(uid, name)` en `utils/constants.js`, más un test que falle ante una ruta literal fuera de ese módulo. |
| ARQ-6 | BAJO | COMPROBADO | `supabase/functions/market/index.ts:19-34` | Con `MARKET_ALLOWED_ORIGINS` vacío, CORS responde `*`. El riesgo real es bajo porque se exige token en la cabecera. El estado del secret en producción es SOSPECHA. | Fallar cerrado si la lista está vacía. |
| ARQ-7 | MEDIO | COMPROBADO | `docs/MARKET_FUNCTION.md`, `services/marketService.js` | El mercado depende de un proyecto Supabase que se pausa por inactividad, sin health check. El usuario solo ve «No se pudo contactar al servidor del mercado». | Un cron de GitHub Actions que llame a la función, y un mensaje específico en la app. |
| ARQ-8 | MEDIO | COMPROBADO | `main.jsx:86-101` | Un único `ErrorBoundary`: un error de render en un modal vacía todo el draft. | Un boundary por pestaña y por modal lazy, con «Reintentar». |
| ARQ-9 | MEDIO | SOSPECHA | `firestore.rules:32,70` vs `utils/constants.js` | El presupuesto por defecto (`200000000`) está literal en las reglas. El test de deriva compara `marketConstants.js` con `constants.js`, pero no compara las reglas. | Un test que lea `firestore.rules` y compare, como `tests/pes/rulesSync.test.js`. |
| ARQ-10 | BAJO | SOSPECHA | `package.json` | Posibles dependencias sin uso: `html2canvas` solo aparece en un comentario y en `index.html`, y `@opentelemetry/api` no aparece en ningún import. | Correr `npx knip` y quitar lo confirmado. |

### 5.3 Calidad del código

Resultado de `npm test`, ejecutado en esta auditoría:

```
 Test Files  3 failed | 162 passed (165)
      Tests  3 failed | 1518 passed (1521)
   Duration  275.09s
```

Los 3 fallos son timeouts en tests que usan archivos reales del juego o grabaciones:
- `tests/pes/kits.test.js` (180 s)
- `tests/pes/sourceArchive.test.js` (180 s)
- `tests/seasonStats.test.js` (30 s)

En CI esos archivos no existen y los tests se saltean, así que el fallo es local.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| CAL-1 | MEDIO | COMPROBADO | ver arriba | La suite local no da verde, tarda 4,6 min y lanza 165 workers. Una suite roja de forma crónica deja de usarse como señal. | Marcar los tests con archivos reales como integración (`npm run test:real`) y sacarlos de `npm test`. Probar `maxWorkers` o `isolate: false`. |
| CAL-2 | ALTO | VERIFICADO | `app.jsx:293` | Ver ARQ-1. Es la principal deuda del repo. | — |
| CAL-3 | MEDIO | COMPROBADO | `components/FormationModal.jsx:35-1014` | Cuerpo del memo de 980 líneas. `handleSaveLineup` (`:268`) tiene 94 líneas. | `useFormationAutosave`, `useFormationShare` y un componente `PitchView` (también resuelve PIZ-2). |
| CAL-4 | MEDIO | COMPROBADO | `components/PlayerModal.jsx:375, 481` | Cuerpo de 608 líneas. `renderActionButton` tiene 244. `RadarChart` y `PosicionHeatmap` conviven en el mismo archivo. | Extraer los tres a componentes propios. |
| CAL-5 | MEDIO | COMPROBADO | `components/ScoutAssignmentsPanel.jsx:149, 276` | 819 líneas. El tutorial guiado (126 líneas) está dentro. | Separar el tutorial, el formulario y la lista. |
| CAL-6 | MEDIO | COMPROBADO | `utils/helpers.js:3, 9-32`; `components/landing/PlatformDemo.jsx:25`; `PlayerMarquee.jsx:26`; varios `formatDate` locales | Cuatro formateadores de precio. Uno duplica su nombre con otra implementación. El dinero usa `'es-ES'` y el resto `'es-AR'`. Ver también FIN-5. | Un `utils/format.js` con `formatMoney`, `formatDate`, `formatTime` y una sola constante `APP_LOCALE = 'es-AR'`. |
| CAL-7 | MEDIO | COMPROBADO | `vite.config.js`, `package.json` | No hay cobertura configurada, así que no se puede medir el 80% que pide la norma del proyecto. | `coverage` con provider `v8` y script `test:coverage`. Medir antes de fijar umbrales. |
| CAL-8 | MEDIO | COMPROBADO | `app.jsx:2294-2304` | Bloque duplicado de persistencia de notificaciones, con `catch {}` vacío y literales repetidos (`'dismissed_notif_ids'`, `-100`). | Una función `persistDismissedNotifIds()` y una constante. |
| CAL-9 | BAJO | COMPROBADO | 23 `catch` vacíos o solo con comentario | La mayoría son fallbacks legítimos de storage. `hooks/useOnlinePresence.js:124` silencia una escritura de Firestore. Los de `pes-collector/bridge/` son código de servidor. | Registrar el error en `useOnlinePresence` y en el bridge. Dejar el resto. |
| CAL-10 | BAJO | COMPROBADO | 92 exports sin uso textual (p. ej. `getSimilarPlayers`, `nextOfferExpiry`, `TournamentField`) | Código muerto probable. | Confirmar con `knip` y borrar. |
| CAL-11 | BAJO | SOSPECHA | `ScoutAssignmentsPanel.jsx:337`, `tournament/tournamentEngine.js:151-152`, `FiltrosModal.jsx:188` | `.sort()` o `.splice()` en el lugar sobre arrays que podrían venir de props o estado. | `[...x].sort()` donde el origen no sea local. |
| CAL-12 | BAJO | COMPROBADO | `app.jsx` y otros | Hay `setTimeout` con literales sueltos, mientras `AUTOSAVE_DELAY_MS` sí tiene nombre. | Nombrar los límites. |

Positivo: no hay `console.log` en el código fuente ni marcadores TODO/FIXME reales.

### 5.4 Seguridad e integridad (área adicional)

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| SEG-1 | MEDIO | COMPROBADO | `firestore.rules:91-107` | El alta de `offers` no tiene `keys().hasOnly` ni tope de tamaño para `message`, nombres, logo e `history`. `history` crece sin límite en cada contraoferta. | `hasOnly`, `isShortText` y un tope de entradas en `history`. |
| SEG-2 | MEDIO | SOSPECHA | `firestore.rules:93-102` | La regla de alta de oferta no comprueba que el vendedor sea dueño del jugador. Puede que el servidor lo rechace al aceptar, pero no se verificó. Si no lo hace, se pueden retener fondos del comprador hasta 48 h por un jugador ajeno. | Confirmar en `_shared/market.js`. Si falta, validar `get(lockPath).data.lockedBy == targetTeamId` en el alta. |
| SEG-3 | MEDIO | COMPROBADO | `manager_chat`, `suggestions`, `shared_formations`, `offers`, función `market` | No hay límite de frecuencia en ninguna escritura del navegador. Solo `community-vote` lo tiene. | Contador por uid en `market` y cuota por usuario (o App Check) en las escrituras directas. |
| SEG-4 | MEDIO | COMPROBADO | `vercel.json:22`, `firebase.json:18` | La CSP sigue en `Report-Only` (S4 de la auditoría anterior). | Revisar los reportes y activarla. |
| SEG-5 | MEDIO | COMPROBADO | `firestore.rules:74-77, 204` | El dueño puede escribir cualquier campo de `teams/{uid}` fuera de la lista negra, sin tope de tamaño ni validación de URL en `logo`. `shared_formations.logoUrl` no exige `https://`. | Lista blanca de campos y validación de URL. |
| SEG-6 | BAJO | COMPROBADO | `supabase/storage-policies.sql:62` vs `firestore.rules:16-22` | Un admin por UID sin el claim `pes_role` puede escribir en Firestore pero no subir fuentes a Storage. Un rol revocado sigue valiendo en Storage hasta 1 h, mientras dure el JWT. | Documentar la ventana y forzar `refreshFirebaseClaims()` al cambiar roles. |
| SEG-7 | BAJO | COMPROBADO | `Propuestas/Plantillas EQUIPOS/Plantilla_PORTLAND_ROVERS_Tactico.pdf` | Un PDF versionado contiene el UID del admin. No es un secreto, pero si el repo es público lo expone. | Quitarlo de la rama, o del historial si el repo es público. |
| SEG-8 | BAJO | COMPROBADO | `match-feed`, `overlay-control` | El mismo `MATCH_FEED_TOKEN` escribe partidos y controla el overlay. Se compara en tiempo constante y exige 32 caracteres como mínimo, lo cual está bien. | Tokens separados si se sospecha de la PC del puente. |

Verificado sin hallazgos:
- No hay `.env`, claves ni cuentas de servicio en git.
- `vendor/` está ignorado.
- No hay `dangerouslySetInnerHTML` en la app.
- Las Edge Functions no filtran stack traces.

### 5.5 Administración

Alcance: `components/AdminModal.jsx`, `utils/adminTabs.js`, `components/admin/**`. Reglas tiene sección propia (§5.13).

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| ADM-1 | ALTO | COMPROBADO | `TeamsAdminSection.jsx:81-83, 368`; `SuggestionsAdminSection.jsx:50` | Si falla la carga, el admin lee «No hay equipos registrados todavía» o «Buzón vacío · 0 en total». Es parte de T-1. | `loadError` en estado y `Alert` con reintento, como en `GeneralAdminSection.jsx:174`. R-27. |
| ADM-2 | ALTO | COMPROBADO | `TeamsAdminSection.jsx:470-473` | El escudo no se puede subir con teclado: el `<input type="file" className="hidden">` es `display:none` y el `<label>` no es enfocable. | Usar `sr-only` y foco visible en el label, como `ClubKitsEditor.jsx:52`. R-32, R-39. |
| ADM-4 | ALTO | VERIFICADO | `GeneralAdminSection.jsx:102-103` vs `:298-305` | El reseteo de temporada borra el draft de promesas (grupo, orden y picks), pero la lista del modal de confirmación no lo menciona. El admin confirma una acción irreversible sin ver todo lo que se borra. | Agregar «Draft de promesas: grupo, orden y turnos» a la lista. Mejor todavía: generar la lista y las operaciones desde la misma estructura para que no vuelvan a divergir. |
| ADM-5 | ALTO | VERIFICADO (código) / SOSPECHA (escenario) | `TeamsAdminSection.jsx:301-306` | «Resetear franquicia» borra `player_locks/{franchisePlayerId}` sin comprobar `lockedBy === team.uid`. Si el id quedó viejo y el jugador ya es de otro club, libera el jugador de otro club. | Leer el lock y borrar solo si es del club, como hace `handleDeleteTeam` (`:257`). Mejor aún: hacerlo en la función `market`. |
| ADM-6 | MEDIO | COMPROBADO | `components/admin/commitBatchOperations.js:5-19` | Reseteo y borrado de equipo se comitean en lotes de 450, no atómicos. Si algo falla a mitad, queda un estado parcial y la UI no dice qué quedó. Reintentar funciona porque los borrados son idempotentes. | El mensaje de error debe decir que quedó a medias y que hay que volver a ejecutar, con el conteo restante. |
| ADM-7 | MEDIO | COMPROBADO | `TeamsAdminSection.jsx:224` | `{ merge: true }` sobre `manualStats` (mapa), contra la convención de CLAUDE.md. La línea siguiente usa `mergeFields`. Impacto bajo hoy. | `{ mergeFields: [...] }`. |
| ADM-8 | MEDIO | COMPROBADO | `AdminModal.jsx:64-67`; `obs/ObsSceneStudio.jsx:81, 99-103`; `LeagueContentAdminSection.jsx:89,141`; `TeamsAdminSection.jsx:146-149` | Cambiar de sección desmonta la activa y pierde el borrador: escena OBS, texto de la web pública o edición de equipo. `beforeunload` solo cubre cerrar la página. `isDirty` existe pero nada lo usa. Es parte de T-3. | Una guardia común: confirmar al cambiar de sección o cerrar si `isDirty`. |
| ADM-9 | MEDIO | COMPROBADO | `AdminModal.jsx:35-45`; `TournamentBroadcastAdminSection.jsx:9-13` | 9 pestañas planas con solapamientos. «Comunidad» tiene los votos, pero el popup de la comunidad vive en «Torneo y transmisión». «Plantillas» mezcla la exportación al PES con los PDF. | Sin rediseño: renombrar «Plantillas» a «Exportar (PES y PDF)», mover «Capa y popup» junto a lo que controla y renombrar «Torneo y transmisión» a «Transmisión». |
| ADM-10 | MEDIO | COMPROBADO | `AdminModal.jsx:70, 123-132` | `<Tabs>` sin `idPrefix` y panel sin `role="tabpanel"`. `Tabs.jsx` ya trae `tabPanelProps`. | `idPrefix="admin"` y `tabPanelProps`. Lo mismo en `TournamentBroadcastAdminSection`. |
| ADM-11 | MEDIO | COMPROBADO | `obs/ObsSceneStudio.jsx:228-230` | `backdrop-blur-sm`, que el DS prohíbe. Sigue abierto desde audit-005. | Fondo sólido `bg-surface`. |
| ADM-12 | MEDIO | COMPROBADO | `GeneralAdminSection.jsx:70-72` | `catch (e)` sin registrar el error y con el toast genérico «Error al guardar.». | `console.error(e)` y el mensaje con `e?.message`. |
| ADM-13 | MEDIO | SOSPECHA | `components/broadcast/OverlayErrorBoundary.jsx:32` | Un error de render de la capa OBS solo llega a la consola y el operador no lo ve. La lectura ya alerta (`ObsAirAlerts.jsx:60-63`). | Reportarlo en la barra de estado de OBS. |
| ADM-14 | MEDIO | SOSPECHA | `AdminModal.jsx:69-71` | 9 pestañas en 360 px: `Tabs` tiene scroll y degradado, pero no se midió si se descubren. | Medir con render antes de tocar. |
| ADM-15 | BAJO | COMPROBADO | `TeamsAdminSection.jsx:285-287, 313`; `ResetVotesButton.jsx:39`; `ClubTransferDialog.jsx:13` | Error de género: «el franquicia», «otro franquicia». Verbos destructivos mezclados (Resetear, Reiniciar, Borrar, Eliminar). «Manager» y «Mánager» conviven. | Corregir el género. «Eliminar» para datos irreversibles, «Reiniciar» para contadores, «Mánager» siempre. |
| ADM-16 | BAJO | COMPROBADO | `AdminModal.jsx:77,83,99,105`; `SuggestionsAdminSection.jsx:31` | `aria-label` sobre `div` sin rol en los estados de carga: el lector de pantalla lo ignora. | `role="status"` con texto visible. |
| ADM-17 | BAJO | COMPROBADO | `TeamsAdminSection.jsx:319-320, 469-510` | `field-label` sin `Field`, y spinners hechos a mano en lugar de `Spinner`. | Usar las primitivas en código nuevo. |
| ADM-18 | BAJO | SOSPECHA | `GeneralAdminSection.jsx:65-68` | `setDoc` sin merge sobre `config/market`: cualquier campo futuro se borraría en silencio. | `{ mergeFields: ['status', 'openTime'] }`. |

Bien resuelto:
- El reseteo pide escribir «RESETEAR» y queda bloqueado con el mercado abierto.
- La transferencia de club explica qué no se mueve.
- Eliminar equipo está en una zona de peligro con el conteo de afectados.

### 5.6 Editor de base de datos PES

**Funcionamiento.** El motor es una buena pieza de ingeniería: puro, por capas, con rollback por lote, verificación por relectura al exportar, campos `unverified`/`partial` de solo lectura y checksum WESYS validado. La UI tiene estados vacío, carga y error. No afirma compatibilidad con el juego, salvo la ambigüedad de PES-7.

El riesgo está en el **trabajo colaborativo**: varios administradores sobre un mismo espacio.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| PES-1 | ALTO | COMPROBADO | `index.css:263-268`; `components/pes/PesUi.jsx:50, 81` | `.btn-sm` mide 32 px y `.btn` 40 px. Guardar, Exportar, Validar y todos los descartes quedan por debajo de 44 px en táctil. Es parte de T-8. | `min-h-11` en el contexto del editor o en `PesUi`. R-03. |
| PES-2 | ALTO | COMPROBADO | `services/pesWorkspaceService.js:109-120`; `firestore.rules:483-487` | No hay control de concurrencia. El orden de las operaciones es `seq = Date.now() + i`, el reloj del cliente. Dos admins que editan el mismo campo: gana el reloj más adelantado, sin aviso. | Guardar el `before` esperado y rechazar o avisar si cambió. Usar un contador o `serverTimestamp` en lugar de `Date.now()`. |
| PES-3 | ALTO | COMPROBADO | `hooks/usePesWorkspace.js:105-112`; `pes/operations.js:140-146` | Al llegar un guardado remoto, los borradores locales se reaplican encima. `replayOperations` ignora `before`, así que se pisa el cambio ajeno sin avisar. Es parte de T-3. | Comparar el `before` de cada borrador con el valor actual y marcarlo «en conflicto» en «Sin guardar». |
| PES-4 | ALTO | VERIFICADO | `hooks/usePesWorkspace.js:311-322`; `PesChangesPanel.jsx:98` | Exportar solo exige `validation.passed` y que no haya borradores. Si una operación guardada no pudo reaplicarse, el ZIP sale sin ella y se rotula «Exportado y verificado». | Deshabilitar Exportar mientras `failures.length > 0`, o pedir confirmación con la lista de lo omitido. |
| PES-5 | MEDIO | COMPROBADO | `PesChangesPanel.jsx:88-89` vs `:132-136` | Descartar una fila del historial que es parte de un lote (`team.replace`) no avisa y deja el equipo a medias. En «Sin guardar» sí avisa. | Reutilizar la confirmación de lote. |
| PES-6 | MEDIO | COMPROBADO (copias) / SOSPECHA (impacto) | `pes/operations.js:95-104`; `hooks/usePesWorkspace.js:238-244` | Cada `applyOperations` copia el buffer completo de la tabla (~8,5 MB para Player.bin) y reescribe todos los borradores en IndexedDB. | Medir con un Player.bin real antes de tocar. Si pesa, copiar solo las tablas del lote o guardar diffs. |
| PES-7 | MEDIO | COMPROBADO | `PesChangesPanel.jsx:108`; `PesKitTextures.jsx:71, 201` | «Exportado y verificado» y «Generada y verificada» sugieren más de lo que se comprobó: la verificación es estructural (`gameTested: false`). | «Verificado estructuralmente», con el mismo matiz de la tarjeta de exportación. |
| PES-8 | MEDIO | COMPROBADO | `tests/pes/` | No hay tests de dos escritores, de reaplicación tras guardado remoto ni de exportación con fallos. | Tres tests de `session.restoreWorkingCopy` sin Firestore. Fixtures sintéticos: prueban la lógica, no la compatibilidad con el juego. |
| PES-9 | BAJO | COMPROBADO | `pes/formats/pes2021/binLayout.js:1-2` | La cabecera dice «GENERATED by tools/gen_layout (scratchpad)». El generador real es `pes/tools/gen_layout.cjs`. | Corregir la cabecera y agregar un test que regenere y compare. |
| PES-10 | BAJO | COMPROBADO | `hooks/usePesWorkspace.js:155-166` | Borrar un espacio deja archivos huérfanos en Supabase si falla el borrado remoto. | Guardar la lista pendiente para reintentar. |

### 5.7 Experiencia general (componentes compartidos, liga, draft)

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| UX-1 | MEDIO | COMPROBADO | ~40 `text-[11px]`; `text-[13px]` `LineupPitch.jsx`; `text-[15px]` `LeagueRulesScreen.jsx`; `text-[17px]`/`[22px]` `RuleBody.jsx`; `text-[28px]` `ui/Stat.jsx` | `tailwind.config.js` no define una escala de `fontSize`, así que cada archivo elige su tamaño. | Tokens `2xs` (11 px) y `display` (28 px) en la config, y reemplazar los `text-[Npx]`. |
| UX-2 | MEDIO | COMPROBADO | `app.jsx` (14 hex), `league/match/BallIcon.jsx` (4), `tournament/LeagueTableView.jsx` (3), `tournament/StatsView.jsx` (1) | Colores literales fuera de `--c-*`. `broadcast.css` tiene excepción documentada. | Pasarlos a tokens, empezando por `app.jsx`. |
| UX-3 | MEDIO | COMPROBADO | `obs/ObsSceneStudio.jsx:230`; `pes/PesKit3DViewer.jsx:358, 361` | `backdrop-filter`, que el DS prohíbe. En el header de la liga ya está resuelto. | Fondo sólido. |
| UX-4 | MEDIO | COMPROBADO | `landing.css:73-75` | La liga redefine `--c-ink-2`/`--c-ink-3` con otros valores que el DS. El mismo `SiteChrome` muestra grises distintos según el sitio. | Subir el `ink-3` global y quitar el override, o documentar la excepción en el DS. |
| UX-5 | MEDIO | COMPROBADO | `landing.css:45`; `PlayerMarquee.jsx:46` | La marquesina gira en bucle infinito y el DS dice «Nothing else loops». Hay botón de pausa, así que el F-14 anterior está parcialmente resuelto. | Detenerla tras una vuelta o documentar la excepción. |
| UX-6 | MEDIO | SOSPECHA | `FeaturedMatch.jsx:155`, `FixtureRow.jsx:46`, `MatchParts.jsx:23`, `StandingsTable.jsx:84` | Puede haber dos puntos «en vivo» pulsando a la vez en el home. El DS pide uno por pantalla. | Verificar con un partido en vivo y dejar uno solo pulsando. |
| UX-7 | MEDIO | SOSPECHA | `screens/league/LeagueLiveScreen.jsx:~329` | Tras votar no hay anuncio `role="status"` de «voto registrado». | Texto visible con `role="status"`. |
| UX-8 | BAJO | COMPROBADO | `landing.css:30-31` | Duraciones de 400 y 450 ms fuera de la escala 120/180/220 del DS. | `var(--dur-base)` o documentar la excepción. |
| UX-9 | BAJO | SOSPECHA | `marketplace/YouthDraftPanel.jsx:77` | Raya larga (—) en texto visible. R-02. | Coma o punto. |
| UX-10 | BAJO | SOSPECHA | 9 `<button>` sin `type` | Lo prohíben R-39 y el DS. | Completar `type="button"`. |

Resuelto desde auditorías anteriores (verificado en código por el subagente):
- menú móvil con Escape, foco y alto máximo;
- navegación de escritorio a partir de `xl`;
- `Tabs` con `aria-controls`, Home y End;
- `Button` que no pierde el foco al cargar;
- marcador en vivo con `aria-live`;
- sin texto de 9 a 10 px en la landing.

Hay `prefers-reduced-motion` en todas las hojas con animación y `focus-visible` global (`index.css:177`).

### 5.8 Pizarra táctica

Alcance: `FormationModal.jsx`, `components/formation/**`, `Pitch.jsx`, `utils/formationStates.js`, `FormationViewScreen.jsx`.

Bien resuelto:
- Arrastre por puntero con umbral, `touch-action` acotado y alternativa por teclado (flechas, con Shift para paso grande).
- `mergeFields` en los guardados.
- Protección contra el eco del propio guardado.
- Estados inmutables.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| PIZ-1 | ALTO | VERIFICADO | `FormationModal.jsx:292-298, 470-475` | Si el banco no cumple, el guardado se bloquea. En la ruta del autoguardado y del flush al cerrar no hay toast (`if (!isLineupObject)`), solo el indicador `blocked`, que desaparece con la pizarra. El mánager cierra creyendo que guardó y la alineación se pierde. Es parte de T-3. | Al cerrar con cambios bloqueados: confirmar («Tu banco promedia 71: este once no se va a guardar») o mantener el borrador. En el autoguardado bloqueado, mostrar siempre el motivo. |
| PIZ-2 | MEDIO | COMPROBADO | `FormationModal.jsx:925-967, 48` | El campo se monta dos veces: escritorio siempre y móvil con `mobileTab === 'pitch'`, el valor por defecto. Quedan dos `Pitch`, dos `TacticalStateBar` con `role="tablist"` y doble re-render. `pitchRef` nunca se lee. | Un solo `PitchView` con layout responsive. Borrar `pitchRef`. |
| PIZ-3 | MEDIO | COMPROBADO | `FormationModal.jsx:398, 821` | Con el plantel vacío dice «Todos tus jugadores están en la cancha.», que es falso, y no ofrece cómo seguir. | Distinguir por `cart.length`: «Todavía no tenés jugadores» con un botón al Mercado. DS principio 7. |
| PIZ-4 | MEDIO | COMPROBADO | `TacticalStateBar.jsx:50-52`; `formationStates.js:159-176, 218-220` | «Restablecer», «Copiar de Inicio» y cambiar de formación borran posiciones sin confirmar ni deshacer, y se autoguardan a los 700 ms. | Confirmar cuando se borran posiciones, o snapshot de un nivel con toast «Deshacer». |
| PIZ-5 | MEDIO | COMPROBADO | `FormationModal.jsx:671-674, 698, 896, 31, 350-357` | Hay un botón primario «Guardar alineación» y a la vez el encabezado dice «Guardado automático». En los 700 ms previos no hay estado «sin guardar». Un error de guardado desaparece a los 6 s sin reintento. | «Cambios sin guardar» desde la primera edición. «Guardar ahora» secundario, visible solo con cambios pendientes. Aviso persistente si falla. |
| PIZ-6 | MEDIO | COMPROBADO | `AdvancedInstructionsPanel.jsx:58-63` | «Cambiar» y «Quitar» miden ~22 px, y la regla `pointer: coarse` no los cubre. Es parte de T-8. | `btn btn-icon btn-sm` o `min-h-11 min-w-11`. R-03. |
| PIZ-7 | MEDIO | COMPROBADO | `FormationModal.jsx:877, 917, 934, 1005`; `landing/rules.js:28`; `TeamScreen.jsx:411`; `LineupPitch.jsx:21` | «Táctica» nombra la página, una subpestaña (sliders de estrategia) y el modal. En otras pantallas aparece como «Pizarra», «Plan de juego» o «plan guardado». COPY-7 de audit-005 sigue abierto. | Subpestaña → «Estrategia». Un solo término para el tablero en todo el producto. |
| PIZ-8 | MEDIO | COMPROBADO | `FormationModal.jsx:665-687` | En escritorio, dos botones a todo el ancho (Guardar y Compartir) encabezan el panel y compiten con el campo, que es el contenido principal. | «Compartir» al encabezado. El guardado como estado, no como CTA. |
| PIZ-9 | MEDIO | SOSPECHA | `FormationModal.jsx:846`; `Pitch.jsx:19-20` | En 360×640 el campo (~336×448) más las barras puede dejar la última línea fuera de la pantalla. | Medir en un dispositivo. |
| PIZ-10 | MEDIO | COMPROBADO | `FormationModal.jsx:557-569`; `FormationViewScreen.jsx:47` | Cada «Compartir» crea un documento público nuevo (`addDoc`, `isPublic: true`) y no hay forma de revocarlo desde la UI. La instantánea sale de la memoria, no del último guardado. | Un documento por equipo con `set`, y un botón «Dejar de compartir». |
| PIZ-11 | MEDIO | COMPROBADO | `Pitch.jsx:96-106` | Mover un marcador con el teclado no anuncia la nueva posición. | `aria-live` con la posición o el rol resultante. |
| PIZ-12 | BAJO | COMPROBADO | `FormationModal.jsx:163-177, 256-260, 367-380` | `pendingAutoSaveRef.current = true` dentro de los updaters de `setState`: frágil en StrictMode. | Marcar el pendiente fuera del updater. |
| PIZ-13 | BAJO | COMPROBADO | `StrategyPanels.jsx` | Mezcla voseo («Configurá») y tuteo («Configura», «Coloca»). | Voseo siempre. |
| PIZ-14 | BAJO | COMPROBADO | `screens/FormationViewScreen.jsx` | No usa `<Page>`/`<PageHeader>` ni `components/ui`, y la vista pública solo muestra el estado «Inicio». | Primitivas del DS. Documentar o mostrar los estados con y sin pelota. |

### 5.9 Scouting

Alcance: `components/ScoutAssignmentsPanel.jsx`, `utils/scoutEngine.js`. El propósito está bien explicado en el encabezado. Los problemas están en la resolución de búsquedas y en la jerarquía.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| SCO-1 | ALTO | VERIFICADO | `ScoutAssignmentsPanel.jsx:372-378` | `buildResultsAsync` se espera con `await` antes del `try`, y `resolvingRef` no se libera. Si el cálculo falla, la búsqueda queda en «buscando» para siempre, sin error ni reintento. | Mover el cálculo dentro del `try`, liberar en un `finally` y hacer `reject` en `buildResultsAsync`. |
| SCO-2 | MEDIO | VERIFICADO | `firestore.rules:416-417`; `ScoutAssignmentsPanel.jsx:381-391` | La regla genérica `users/{uid}/{collectionId}` deja al dueño escribir `scout_searches`, así que el mánager puede fijar `status: 'done'`, `results` y `resolvesAtMs`. Impacto acotado: solo obtiene información antes o falsa; no gana jugadores ni dinero. Es parte de T-2. | Resolver en el servidor (función o cron) y excluir `scout_searches` de la escritura del cliente, con su test de reglas. |
| SCO-3 | MEDIO | COMPROBADO | `ScoutAssignmentsPanel.jsx:346-408`; `app.jsx:1931` | La resolución vive en el panel y solo corre con la pestaña abierta. «Volvé en 4 h» no se cumple si el mánager no entra, y la notificación «Scout listo» llega tarde. | El mismo resolutor de SCO-2. Como mínimo, montarlo a nivel de app. |
| SCO-4 | MEDIO | COMPROBADO | `ScoutAssignmentsPanel.jsx:50-53, 638-639, 654-659` | El paso «Presupuesto» del tutorial resalta el campo País: `data-scout-target` está en el elemento equivocado. | Mover el atributo al campo de Presupuesto y probar los 8 pasos. |
| SCO-5 | MEDIO | COMPROBADO | `ScoutAssignmentsPanel.jsx:339-342, 746-749` | Si falla la lectura, muestra «Todavía no mandaste ningún ojeador» y el cupo 0/5. Es parte de T-1. | `Alert` con reintento. |
| SCO-6 | MEDIO | COMPROBADO | `ScoutAssignmentsPanel.jsx:556-590` | Grupo con `role="radio"` sin navegación por flechas ni roving `tabIndex`. | Reutilizar la lógica de `Tabs.jsx:43-48` o usar radios nativos. R-32, R-39. |
| SCO-7 | MEDIO | COMPROBADO | `ScoutAssignmentsPanel.jsx:546-813` | Formulario de 14 campos arriba y búsquedas abajo. En móvil, para ver el resultado de lo que se envió hay que bajar unos 1000 px. | Búsquedas activas y cupo arriba, o dos pestañas: «Nueva búsqueda» y «Mis búsquedas». |
| SCO-8 | MEDIO | SOSPECHA | `ScoutAssignmentsPanel.jsx:769-808`; `scoutEngine.js:58, 81` | Los resultados se calculan horas después y no indican si el jugador ya fue fichado ni su precio vigente. | Cruzar `resultIds` con `playerLocks` al mostrar: «Ya fichado» y precio actual. |
| SCO-9 | MEDIO | COMPROBADO | `ScoutAssignmentsPanel.jsx:334-337` | Las búsquedas `done` no se archivan y cada una guarda los jugadores completos, así que la lista crece sin paginar. | Mostrar las últimas N y archivar las vistas. |
| SCO-10 | BAJO | COMPROBADO | `ScoutAssignmentsPanel.jsx:374, 384` | Dos campos de tiempo (`resolvesAt` y `resolvesAtMs`). Con dos pestañas abiertas el cálculo se hace dos veces. | Un solo campo. Calcular después de ganar la transacción. |
| SCO-11 | BAJO | COMPROBADO | `ScoutAssignmentsPanel.jsx:399, 414, 495, 499, 500, 503, 542, 733` | «Busqueda» sin tilde, «Scout» y «ojeador» mezclados, el límite 5 escrito a mano en lugar de `MONTHLY_SEARCH_LIMIT`, y un código de error que nunca se lanza. | Corregir y usar la constante. |

### 5.10 Rivales

Alcance: `components/TeamsModal.jsx` (pestaña «Rivales») y `screens/TeamScreen.jsx` (ficha `/team/:id`).

Bien resuelto:
- La pertenencia se lee de `player_locks` (`TeamsModal.jsx:90-93`).
- Esqueleto con `role="status"` y estados vacío y filtrado-vacío con acción.
- Filas de 44 px en táctil.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| RIV-1 | ALTO | COMPROBADO | `hooks/useFirebaseData.js:97, 113-116`; `TeamsModal.jsx:221-224` | Si falla la suscripción, `isTeamsLoaded` nunca pasa a `true` y el esqueleto queda para siempre. Es parte de T-1. | Error expuesto desde el hook y `Alert` con reintento. |
| RIV-2 | MEDIO | COMPROBADO | `TeamsModal.jsx:304-305`; `screens/TeamScreen.jsx` | La ficha del club rival no permite abrir jugadores ni hacer ofertas: solo se puede desde la lista desplegable. «Invertido» es gasto, no presupuesto, y el presupuesto del rival no está en ningún lado (ver ARQ-3). | Jugadores clicables en `TeamScreen`, con la misma ficha y el mismo flujo de oferta. Decidir si el presupuesto rival es visible y decirlo. |
| RIV-3 | MEDIO | COMPROBADO | `screens/TeamScreen.jsx:172-198`; `utils/squadSync.js:59` | Si falla la lectura de `player_locks`, el plantel se arma con `lineup` y `roster` y se muestra como completo, sin aviso. El roster público puede estar desactualizado. Es parte de T-1 y T-4. | Aviso «No pudimos verificar el plantel» con reintento. Pertenencia solo desde los locks. |
| RIV-4 | MEDIO | SOSPECHA | `TeamsModal.jsx:101, 262` | «Invertido» suma el precio actual del catálogo, no lo pagado. Es parte de T-5. | Usar el precio del lock cuando exista. Mientras tanto, rotular «Valor de mercado». |
| RIV-5 | BAJO | COMPROBADO | `TeamsModal.jsx:162` | `isAllExpanded` cuenta ids ya ocultos por el filtro, así que puede decir «Plegar todo» sin nada desplegado. | Contar solo los visibles. |
| RIV-6 | BAJO | COMPROBADO | `TeamsModal.jsx:244-245` | El `aria-label` del encabezado reemplaza lo que se ve (nombre, jugadores, invertido, media). | `aria-labelledby` o quitar el `aria-label`. R-39. |
| RIV-7 | BAJO | COMPROBADO | `TeamsModal.jsx:25-37, 238, 282` | Dos mapas de posiciones: el filtro y la agrupación no coinciden, y una posición desconocida cae en DEF pero desaparece al filtrar por DEF. | Una sola fuente. |
| RIV-8 | BAJO | COMPROBADO | `TeamsModal.jsx:196, 305` | `bg-white/10` y `bg-white/[0.03]` en lugar de tokens. Es parte de T-6. | Tokens `--c-*`. |

### 5.11 Plantel

Alcance: `components/CartModal.jsx` (pestaña Plantel), `app.jsx:1552-1577`, `hooks/useSquadSync.js`.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| PLA-1 | MEDIO | COMPROBADO (orden) / SOSPECHA (px) | `CartModal.jsx:656-659, 676-679` | El balance de 4 cifras, la barra y las 3 reglas van antes de la barra de pestañas en todas las pestañas. En 360 px la lista empieza unos 450 px más abajo. | Pestañas arriba. Reglas solo en Plantel y balance solo en Finanzas. DS principio 5, R-03. |
| PLA-2 | MEDIO | VERIFICADO | `app.jsx:1559-1564`; `landing/rules.js:13` | Liberar pide confirmación sin decir cuánto se recupera ni cómo queda el saldo, aunque la landing promete «recuperás todo lo que pagaste». Aceptar una oferta sí muestra el precio. | `amount` y `details: ['Recuperás $X', 'Disponible: $A → $B']` en `confirmAction`. |
| PLA-3 | MEDIO | COMPROBADO | `CartModal.jsx:66-70`; `app.jsx:1554-1556` | Con el mercado cerrado, la X de liberar sigue activa y el error aparece después del clic. | `disabled` con el motivo visible. R-26. |
| PLA-4 | MEDIO | COMPROBADO | `app.jsx:1552-1577` | No hay guarda por fila mientras se libera: un segundo clic reabre la confirmación y el servidor responde con error. | Conjunto de `playerId` en curso y X deshabilitada. |
| PLA-5 | MEDIO | COMPROBADO | `app.jsx:1083-1089`; `CartModal.jsx:284-288, 511`; `_shared/budget.js:25-28` | `ownedCart` conserva filas del carrito sin lock (huérfanas). Cuentan para el número de la pestaña, las reglas y la media, pero no para el presupuesto. Es parte de T-4. | Plantel desde `ownedLockEntries`. Huérfanos como aviso. |
| PLA-6 | MEDIO | COMPROBADO | `CartModal.jsx:258` | La pestaña activa no está en la URL: «Atrás» y los enlaces no restauran Historial ni Finanzas. Es parte de T-9. | `setSearchParams({ tab }, { replace: true })`. |
| PLA-7 | MEDIO | SOSPECHA | `CartModal.jsx:511-515` | Cinco pestañas (Plantel, Recibidas, Enviadas, Historial, Finanzas) no entran en 360 px y Finanzas queda fuera de la vista. | Agrupar las ofertas en una pestaña con subsecciones. |
| PLA-8 | BAJO | COMPROBADO | `CartModal.jsx:546` | El estado vacío dice «Explorá el mercado» como texto, sin botón. | Botón «Ir al mercado». |
| PLA-9 | BAJO | COMPROBADO | `CartModal.jsx:648, 668, 690` | «Plantel y finanzas» en el título y «Finanzas y plantilla» en el `aria-label`. | Un solo nombre. |
| PLA-10 | BAJO | SOSPECHA | `CartModal.jsx:617` | `grid-cols-3 gap-6` sin breakpoint: unos 93 px por columna en 360 px. | `grid-cols-1 sm:grid-cols-3`. |

### 5.12 Finanzas

Alcance: `CartModal.jsx` (pestaña Finanzas), `hooks/useBudget.js`, `TopHeader.jsx`.

Bien resuelto: el saldo usa el mismo `budget.js` que el servidor, y el libro de movimientos usa el `sellerNet` guardado.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| FIN-2 | ALTO | COMPROBADO | `hooks/useFirebaseData.js:23, 31, 96`; `_shared/budget.js:25-28`; `TopHeader.jsx:105` | `playerLocks` arranca en `{}`. Si el listener falla, el gasto da 0 y «Disponible» muestra el presupuesto completo en Finanzas y en la cabecera, mientras el plantel muestra jugadores. El servidor rechaza las compras, así que no se pierde plata, pero la pantalla miente sobre el dinero. Es parte de T-1. | No mostrar la cifra hasta que carguen los locks. Con error, `Alert` «No pudimos cargar tus contratos». |
| FIN-1 | MEDIO | COMPROBADO | `CartModal.jsx:527-534` | Las cuatro `Stat` son `size="sm"`: «Disponible», la cifra principal, pesa lo mismo que «Presupuesto». La barra mide 6 px. | «Disponible» en `size="lg"` y el resto en una línea secundaria. DS principio 4. |
| FIN-3 | MEDIO | COMPROBADO | `TopHeader.jsx:14, 105`; `CartModal.jsx:530`; `DESIGN_SYSTEM.md:38, 243` | El saldo aparece dos veces y el DS dice que va solo en la cabecera. Finanzas sí lo necesita como ancla. | Decisión del dueño del DS: escribir la excepción o quitar el saldo de la cabecera en esa ruta. |
| FIN-4 | MEDIO | COMPROBADO | `TopHeader.jsx:17`; `CartModal.jsx:502-503, 597, 610` | El mismo número tiene dos semáforos: verde por encima del 50 % en la cabecera, y azul o amarillo por debajo del 20 % en Finanzas. El balance positivo va en acento y las ventas en verde. | Un helper `budgetTone(pct)` compartido. Colores semánticos solo con significado. |
| FIN-5 | MEDIO | COMPROBADO | `utils/helpers.js:9-32`; `app.jsx:2321` | Formatos de dinero distintos: «$200,00M», «200.000.000», «$3,2M» con `toFixed`, sin manejo de negativos. Ver CAL-6. | Un formateador de saldo para la cabecera, Finanzas y las alertas. |
| FIN-6 | MEDIO | COMPROBADO | `CartModal.jsx:436` vs `index.css:663-683` | La dona usa `#eab308 #3b82f6 #22c55e #ef4444`, distintos de los colores de los chips de posición del resto de la app. | Reutilizar los colores de `getPosColorClass`. DS principio 6. |
| FIN-7 | MEDIO | COMPROBADO | `CartModal.jsx:623-634` | Los gráficos tienen nombre accesible, pero las cifras solo están en el tooltip, que no existe en táctil. | Cifra en la leyenda («Porteros · 3») o una `dl` debajo. |
| FIN-9 | MEDIO | VERIFICADO | `_shared/market.js:129` | El lock no guarda el precio: si se regenera el catálogo con precios nuevos, cambian el saldo de todos y el reembolso al liberar. Es parte de T-5. | `price` en el lock al fichar. |
| FIN-10 | BAJO | COMPROBADO | `CartModal.jsx:456, 474-479` | Etiquetas de país cortadas a 10 caracteres, y ejes con hex y `rgba` literales. | Tokens. Mostrar el nombre completo en la leyenda. |
| FIN-11 | BAJO | SOSPECHA | `CartModal.jsx:410-416, 592` | «Movimientos de la temporada», pero se usa todo `offerHistory`. | Filtrar por temporada o cambiar el texto. |
| FIN-12 | BAJO | SOSPECHA | `hooks/useBudget.js:48`; `CartModal.jsx:502` | Sin perfil cargado, el saldo es 0 y se pinta en rojo, sin estado de carga. Es parte de T-1. | Estado de carga. |

### 5.13 Reglas (Administración)

Alcance: Admin → Reglas (`components/admin/SquadRulesAdminSection.jsx`), `utils/squadRules.js`, cumplimiento en las reglas y en `market`.

Aclaración importante: la pestaña **no es un editor**. Es un tablero de cumplimiento de solo lectura. Los umbrales son constantes de código.

| ID | Sev. | Estado | Ubicación | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- |
| REG-1 | ALTO | VERIFICADO (reglas) / COMPROBADO (función) | `FormationModal.jsx:292-296`; `firestore.rules:74-76`; `supabase/functions/` | Banco ≥ 73, plantel ≥ 21 y 7 locales solo se validan en el navegador. El dueño puede escribir `lineup` directamente con el SDK, y `market` deja liberar jugadores por debajo de 21. Mitigación actual: el tablero de Reglas muestra quién incumple. Es parte de T-2. | Llevar `checkBench` y `evaluateSquadRules` a `supabase/functions/_shared/squadRules.js` con test de deriva. Validar el banco en un `saveLineup` del servidor, y plantel y locales en un control de cierre de fecha (no por acción, porque la regla es una fecha límite). |
| REG-2 | MEDIO | COMPROBADO | `utils/squadRules.js:5-8` | `SQUAD_MIN_PLAYERS`, `BENCH_MIN_AVG_OVR`, `LOCAL_MIN_PLAYERS` y `STARTERS_COUNT` no están en `marketConstants.js` ni en el test de deriva. | Incluirlas al hacer REG-1. |
| REG-3 | MEDIO | COMPROBADO | `SquadRulesAdminSection.jsx` | El nombre «Reglas» sugiere que se pueden editar, y no se puede. | Si los umbrales son del dev: renombrar a «Cumplimiento». Si el admin debe editarlos: guardarlos en `config` con validación y una vista previa de «N clubes dejarían de cumplir» (los datos ya están en `buildTeamRuleRows`). |
| REG-4 | MEDIO | COMPROBADO | `SquadRulesAdminSection.jsx:80-103`; `utils/squadRules.js:98` | En móvil, un club sin país aparece «En regla» porque la regla de locales no se mide (`applies: false`). El encabezado lo cuenta como en regla. En escritorio dice «Club sin país cargado»: las dos vistas no coinciden. | Estado «Sin medir» y conteo «N en regla · M sin medir». |
| REG-5 | MEDIO | COMPROBADO (código) / SOSPECHA (disparador) | `utils/squadRules.js:121-122`; `CartModal.jsx:284-287` | Se descartan los locks cuyo jugador no está en el catálogo: el tablero muestra «Faltan N» falsos y un número distinto al de Mi Equipo. Es parte de T-4. | Contar el lock y marcar «N jugadores sin ficha». |
| REG-6 | MEDIO | SOSPECHA | `components/landing/rules.js`; `utils/leagueContent.js:9` | Hay dos fuentes del reglamento público. Si un admin escribe «73» o «21» en un capítulo editable, la web puede contradecir el código. | Generar las cifras desde las constantes o no escribirlas en los capítulos. |
| REG-7 | BAJO | COMPROBADO | `SquadRulesAdminSection.jsx` (cabecera) | El texto omite que la regla del banco solo aplica con 21 jugadores y el once completo. | «Con 21 jugadores o más y el once completo, la táctica no guarda un banco por debajo de 73.» |
| REG-8 | BAJO | COMPROBADO | `SquadRulesAdminSection.jsx:9-13`; `TeamsModal.jsx:14`; `utils/squadRules.js:76-96` | Tres juegos de etiquetas para las mismas reglas. Es parte de T-7. | Una tabla de etiquetas en `squadRules.js`. |
| REG-9 | BAJO | SOSPECHA | `SquadRulesAdminSection.jsx`; `FormationModal.jsx` | El tablero lee `teams.lineup` (copia pública) y Mi Equipo lee el carrito: pueden mostrar bancos distintos. | Misma fuente, o un test que compare ambas. |

Bien resuelto: estados vacío, carga y error, tabla con scroll y vista de lista en móvil, y el texto público sincronizado hoy con las constantes.

---

## 6. Hallazgos descartados o corregidos en la consolidación

| Origen | Afirmación del subagente | Resultado |
| --- | --- | --- |
| ADM-3 (Admin) | «La frase de la zona de peligro del reseteo está cortada en "…formaciones compartidas y"». | **Falso.** `GeneralAdminSection.jsx:249` termina en «…formaciones compartidas y transferencias. Conserva…». El subagente leyó una salida truncada. Descartado. |
| ARQ-3 (Arquitectura) | «Presupuesto público: ALTO». | **Bajado a MEDIO.** Es verificable, pero Rivales no muestra el presupuesto y en una liga privada es una decisión de producto más que una brecha. |
| SCO-2 (Scouting) | «El cliente forja resultados: ALTO». | **Bajado a MEDIO.** Confirmado en las reglas, pero solo da información adelantada o falsa al propio mánager. No le da jugadores ni dinero. |
| CAL-1 (Calidad) | «Suite roja: ALTO». | **Bajado a MEDIO.** Los 3 fallos son timeouts en tests con archivos reales que no existen en CI. Es un problema de la señal local, no un bug del producto. |
| PLA-1, FIN-1, PLA-2 | Marcados ALTO. | **Bajados a MEDIO.** Son problemas reales de jerarquía y de información, pero sin pérdida de datos ni error funcional. |
| ARQ-12 / CAL | «`app.jsx` 2.337 líneas». | Confirmado: 2.338. Las cifras de los docs están viejas (EST-3). |
| CAL-10 (TODO) | Único TODO detectado. | Es la palabra «TODO el plantel» en un texto en español. No es un hallazgo. |
| EST-1 (Estructura) | «Datasets duplicados: ~78 MB extra en git, ALTO». | **Corregido y bajado a MEDIO.** Los pares tienen el mismo blob, y git guarda un blob una sola vez. El problema real es la divergencia entre copias, no el tamaño. |
| EST (Estructura) | «`firestore-debug.log` en el árbol». | Está ignorado por `*.log`. No es un hallazgo. |

---

## 7. Priorización (impacto × esfuerzo)

Esfuerzo: **S** = menos de medio día · **M** = 1 a 3 días · **L** = una semana o más.

| Prioridad | Hallazgos | Impacto | Esfuerzo | Por qué en este orden |
| --- | --- | --- | --- | --- |
| **P0: ya** | ADM-4, PES-4, PIZ-1, PLA-2, SCO-1, ADM-15 (género) | Alto | S | Cambios de pocas líneas que evitan pérdidas de datos, decisiones a ciegas o estados trabados. |
| **P1: próximo sprint** | T-1 (FIN-2, RIV-1, RIV-3, SCO-5, ADM-1, FIN-12), ADM-5, ADM-2, PES-1/PIZ-6 (T-8), PES-7 | Alto | M | Un solo patrón de `status`/`error` en los hooks resuelve seis pantallas. ADM-5 puede liberar el jugador de otro club. |
| **P2: integridad del juego** | REG-1/REG-2, T-5 (FIN-9, RIV-4), SCO-2/SCO-3, PES-2/PES-3/PES-8, SEG-1, SEG-2 | Alto | M–L | Llevar al servidor lo que hoy confía en el cliente. Requiere decisiones de diseño (cuándo se valida el plantel, qué pasa con los locks viejos, modelo de conflictos PES). |
| **P3: consistencia UX** | T-3 resto (ADM-8, PIZ-4, PIZ-5), PIZ-2/3/7/8/10, PLA-1/3/4/5/6/7, FIN-1/3/4/5/6/7, SCO-4/6/7/8, RIV-2, REG-3/4/5, ADM-9/10, T-6, T-7, UX-1…UX-7 | Medio | M | Mejora clara para los mánagers. Hay que hacerlo pantalla por pantalla con render y medición a 360 px. |
| **P4: deuda estructural** | ARQ-1/CAL-2, CAL-3/4/5, ARQ-4/5/8, CAL-1, CAL-6, CAL-7, EST-1, EST-3, EST-5…EST-8 | Medio (alto a largo plazo) | L | No cambia lo que ve el usuario, pero reduce el riesgo de cada cambio futuro. Conviene ir extrayendo mientras se tocan las pantallas de P1–P3. |
| **P5: higiene** | ARQ-6/7/9/10, SEG-3…SEG-8, CAL-8…CAL-12, EST-3…EST-7, todos los BAJO restantes | Bajo | S–M | Se pueden hacer de a uno, como parte de otros cambios. |

---

## 8. Roadmap propuesto

**Fase 0: correcciones inmediatas (1 a 2 días).**
- Completar la lista del reseteo (ADM-4).
- Bloquear la exportación PES con fallos (PES-4).
- Avisar o confirmar al cerrar la Pizarra con el guardado bloqueado (PIZ-1).
- Mostrar el reembolso al liberar (PLA-2).
- `try`/`finally` en la resolución del Scouting (SCO-1).
- Corregir el género de «la franquicia» (ADM-15).
- Corregir «verificado» por «verificado estructuralmente» (PES-7).
- Sacar los tests con archivos reales de `npm test` (CAL-1) para recuperar una suite verde como señal.

**Fase 1: estados honestos (1 semana).**
- Agregar `status` y `retry` a `useFirebaseData` y a los hooks de sección.
- Aplicarlo en Finanzas, cabecera, Rivales, ficha de club, Scouting y Admin (T-1).
- Validar el dueño en «Resetear franquicia» (ADM-5).
- Llevar los objetivos táctiles a 44 px (T-8).
- Hacer accesible la subida del escudo (ADM-2).
- Agregar un `ErrorBoundary` por pestaña y por modal (ARQ-8).

**Fase 2: integridad en el servidor (2 a 3 semanas).** Antes de programar hay que tomar tres decisiones:
1. ¿Se valida el plantel por acción o al cierre de cada fecha?
2. ¿El presupuesto de los rivales es público?
3. ¿El editor PES avisa los conflictos o los bloquea?

Trabajo:
- `squadRules` compartido y validado en `market` o en un control de cierre (REG-1, REG-2).
- `price` en el lock con fallback (T-5).
- Resolución del Scouting en el servidor y reglas cerradas (SCO-2, SCO-3).
- `before` esperado y contador en las operaciones PES, más los tests de conflicto (PES-2, PES-3, PES-8).
- Límites de tamaño y lista blanca en `offers` y `teams` (SEG-1, SEG-5), y verificar SEG-2.
- Health check del mercado (ARQ-7).

**Fase 3: consistencia de producto y diseño (2 a 3 semanas, con render).**
- Glosario en el DS y etiquetas centralizadas (T-7).
- Escala tipográfica y tokens de color (T-6, UX-1…UX-4, FIN-6).
- Guardia `isDirty` común (T-3).
- Pestañas en la URL y con ARIA (T-9).
- Jerarquía de Plantel/Finanzas (PLA-1, FIN-1, FIN-3, FIN-4).
- Pizarra: un solo `PitchView`, estado vacío, confirmación con deshacer, modelo de guardado y compartir revocable (PIZ-2…PIZ-10).
- Scouting: búsquedas arriba, radios accesibles y «Ya fichado» (SCO-4…SCO-9).
- Rivales: ficha de club con acciones (RIV-2).
- Reglas: decidir entre editor y tablero, y el estado «Sin medir» (REG-3, REG-4).
- Admin: renombrar pestañas (ADM-9).

Cada pantalla se cierra con capturas a 360 px y 1280 px, y una pasada de Anti-Slop e Impeccable sobre el resultado.

**Fase 4: deuda estructural (continuo).**
- Ir vaciando `App()` por dominio, empezando por los 4 `onSnapshot` (ARQ-1).
- Dividir `FormationModal`, `PlayerModal` y `ScoutAssignmentsPanel` (CAL-3…CAL-5).
- Helpers de rutas de colección con test (ARQ-5).
- Suscripciones compartidas (ARQ-4).
- `utils/format.js` (CAL-6).
- Cobertura con `v8` (CAL-7).
- `knip` para el código y las dependencias muertas (CAL-10, ARQ-10).
- `docs/STATUS.md` como índice único de hallazgos abiertos (EST-3).
- Una sola copia del catálogo de jugadores, y sacar del repo `qa-overhaul/`, `Propuestas/` y `.git_private/` (EST-1, EST-4, EST-5, EST-8).

Regla práctica para esta fase: toda pantalla que se toque en las fases 1 a 3 sale con al menos un bloque extraído de su archivo gigante.

---

## 9. Qué falta para cerrar esta auditoría

- **Render real a 360 px y 1280 px** de Pizarra, Plantel/Finanzas, Scouting, Admin y editor PES. Confirma o descarta PIZ-9, PLA-7, PLA-10, ADM-14, UX-6 y los contrastes.
- **`npm run test:rules`** (requiere Java 21) y **`npm audit --omit=dev`**.
- Confirmar en producción los secrets `MARKET_ALLOWED_ORIGINS`, `MATCH_FEED_TOKEN` y `COMMUNITY_SALT` (ARQ-6, SEG-8).
- Confirmar en `_shared/market.js` si aceptar o contraofertar comprueba el lock del vendedor (SEG-2).
- Medir memoria del editor PES con un Player.bin real (PES-6).
