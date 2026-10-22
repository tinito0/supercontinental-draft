# Partidos de PES en vivo (puente local + función `match-feed`)

Los partidos que se juegan en la PC de la liga llegan a la web mientras se juegan. El juego no sabe nada de
internet: un módulo de Sider graba, un programa local resume y sube, una función del servidor valida y guarda.

```
PES 2021 + Sider ── scl_probe.lua ──▶ E:\eFootball PES 2021\scl_probe\<sesión>\events.ndjson   (solo lectura de memoria)
                                          │
          SCL Bridge (bandeja) ── bridge.mjs: resume cada partido (scl.match/1), guarda en _bridge\, sube
                                          │  POST + Authorization: Bearer MATCH_FEED_TOKEN
                                          ▼
                     Supabase Edge Function `match-feed` ── valida ──▶ Firestore
                                                artifacts/{APP_ID}/public/data/live_matches/{matchKey}
```

| Pieza | Archivo |
|---|---|
| Grabación en el juego | `pes-collector/sider/scl_probe.lua` (instalado en `E:\eFootball PES 2021\modules`) |
| Resumen de un partido | `pes-collector/collector/matchSummary.js`, `statKinds.js` |
| Puente (lectura, guardado, subida) | `pes-collector/bridge/bridge.mjs`, `bridgeCore.js`, `uploader.js` |
| Ícono en la bandeja | `pes-collector/bridge/tray.ps1`, acceso directo con `install-shortcut.ps1` |
| Configuración local | `pes-collector/bridge/setup.mjs` → `%APPDATA%\scl-bridge\config.json` |
| Función del servidor | `supabase/functions/match-feed/index.ts`, validación en `_shared/matchFeed.js` |
| Regla de Firestore | `firestore.rules` (`live_matches`: lectura pública, escritura solo admin) |
| Tests | `tests/pesCollector/*`, `tests/matchFeed.test.js`, `tests/rules/liveMatchRules.test.js` |

## Qué se guarda

Un documento por partido, clave `<inicio UTC>_<equipo local>-<equipo visitante>` (ids de Team.bin, los mismos de
Draft → PES): `status` (`live` / `finished` / `abandoned`), `score`, `clock`, ids y nombres de equipos, y el resumen
completo como texto JSON en `summaryJson` (goles con autor y asistencia, tarjetas, cambios, formaciones, stats por
jugador y por equipo). La posesión todavía no está (docs/PES_MATCH_DATA_RESEARCH.md). Nada de esto toca el torneo:
vincular un partido a un cruce y cargar el resultado es un paso aparte, con revisión del admin.

## Seguridad

- El token solo permite escribir `live_matches` a través de la función; no da acceso a Firestore ni a Supabase.
- Vive en dos lugares: `%APPDATA%\scl-bridge\config.json` (fuera del repo) y el secret `MATCH_FEED_TOKEN`. Nunca en
  el repo, en el código ni en el chat. Si se filtra: `node pes-collector/bridge/setup.mjs --new-token --set-secret`.
- La función rechaza tokens de menos de 32 caracteres, claves mal formadas, equipos que no coinciden con la clave,
  marcadores imposibles y resúmenes de más de 256 KB. Escribe con la misma cuenta de servicio que `market`.

## Puesta en marcha (una vez)

1. Instalar el ícono: `powershell -ExecutionPolicy Bypass -File pes-collector\bridge\install-shortcut.ps1`
   (crea "SCL Bridge" en el Escritorio). Sin config funciona en modo local: guarda pero no sube.
2. Token y config: `npx supabase login`, después `node pes-collector/bridge/setup.mjs --set-secret`.
3. Desplegar la función (sin verificación JWT: el puente no es un usuario de Supabase ni de Firebase):
   `npx supabase functions deploy match-feed --no-verify-jwt --project-ref pcmhsucbtonnaikiatuy`.
   Usa el secret `FIREBASE_SERVICE_ACCOUNT` que ya tiene `market`.
4. Reglas: `npm run test:rules`, después `firebase deploy --only firestore:rules`.

## Uso

Antes de jugar, doble clic en "SCL Bridge". El ícono junto al reloj indica el estado:

| Color | Significa |
|---|---|
| Gris | Esperando partido, o modo local (sin config) |
| Verde | Partido en vivo, subiéndose (cada ~3 s; goles y final al instante) |
| Azul | Subida en pausa (menú → Reanudar). Se sigue guardando en la PC |
| Amarillo | Sin conexión: los partidos quedan en cola y se reintenta solo (3 s → 60 s) |
| Rojo | Error de configuración (token rechazado, función no desplegada): ver el mensaje |

Menú: Estado, Abrir log, Abrir carpeta (`scl_probe\_bridge`), Pausar/Reanudar, Salir. Si el puente se cae, el
ícono lo reinicia; al salir del ícono el puente termina.

## Si algo falla

- **No sube y está en gris:** falta `%APPDATA%\scl-bridge\config.json` → paso 2.
- **Rojo "Token rechazado":** el token del config y el secret no coinciden → `setup.mjs --set-secret`.
- **Rojo "no está desplegada":** paso 3.
- **Amarillo mucho tiempo:** sin internet o Supabase caído; nada se pierde: `_bridge\matches\` guarda cada partido y
  `_bridge\outbox.json` recuerda qué se subió. Al volver la conexión (o al reabrir el ícono) se sube lo pendiente.
- **Un partido que no aparece:** el puente sigue solo la grabación más nueva. Para una vieja:
  `node pes-collector/bridge/bridge.mjs --once` no alcanza; usar `node pes-collector/tools/summarize.mjs <sesión>`.
- Log: `E:\eFootball PES 2021\scl_probe\_bridge\bridge.log` (rota a 1 MB).

## Que Supabase no se pause

El plan Free de Supabase pausa el proyecto si pasa 7 días sin actividad de base de datos (avisa por mail una semana
antes; se reanuda desde el dashboard hasta 90 días después). Este proyecto casi no consulta la base: Storage, Edge
Functions y `match-feed` escriben en Firestore. Para evitarlo:

- `supabase/migrations/20261021000000_keepalive.sql`: función `public.keepalive()` (`select now()`, no lee datos).
- `.github/workflows/supabase-keepalive.yml`: la llama cada 2 días (y a mano desde Actions → Run workflow).
  Secrets del repo: `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (la clave pública anon, nunca la de servicio).
- Una ejecución en rojo = el proyecto no respondió (540 = ya está pausado: reanudarlo en el dashboard).
- GitHub apaga los cron de un repo público después de 60 días sin commits: si pasa, reactivarlo en Actions.
- La alternativa sin mantenimiento es el plan Pro (no se pausa nunca).

## Macro Deck: botones para el overlay de OBS

Los botones de Macro Deck cambian el overlay de la web (escena, popup con QR, ticker) con el mismo token del bridge.
El camino es Macro Deck → `pes-collector/bridge/scl-obs.cmd` → `obs.mjs` → Edge Function `overlay-control` →
`public/data/broadcast/overlay` → OBS.

- **Desplegar una vez:**
  - `npx supabase functions deploy overlay-control --no-verify-jwt`;
  - usa los secrets `FIREBASE_SERVICE_ACCOUNT` y `MATCH_FEED_TOKEN`, los mismos que `match-feed`;
  - `OVERLAY_SITE_URL` es opcional: es la base de los enlaces del QR y por defecto vale `https://supercont-d62df.web.app`.
- **Crear un botón en Macro Deck 3:** acción integrada **HTTP → Send HTTP Request**:
  - método `POST`;
  - URL `https://pcmhsucbtonnaikiatuy.supabase.co/functions/v1/overlay-control`;
  - autenticación Bearer con el `token` de `%APPDATA%\scl-bridge\config.json`;
  - body JSON, por ejemplo `{"action":"scene","scene":"previa"}`,
    `{"action":"popup","preset":"tabla","seconds":30}`, `{"action":"popup","preset":"off"}` o
    `{"action":"toggle","target":"ticker","value":"off"}`.
  - tarjetas de la comunidad: `{"action":"card","kind":"mvp","seconds":20}` (también `prediction`, `cup` y `off`);
  - modo automático: `{"action":"toggle","target":"auto","value":"off"}`.

  La lista completa, con botones para copiar, está en Admin → Overlay → «Botones de Macro Deck 3».
- **Sin la acción HTTP** (Macro Deck 2): Windows Utils → Start application. Programa:
  `…\pes-collector\bridge\scl-obs.cmd`. Argumentos, por ejemplo:
  - `scene previa`: escenas `live`, `previa`, `descanso`, `final`, `tabla`, `bracket`, `repechaje`, `goleadores`;
  - `popup tabla 30`: popups `liga`, `tabla`, `equipos`, con segundos (0 = fijo) y posición opcional `right`, `left` o
    `center`;
  - `popup off`;
  - `card mvp 20`: tarjetas `mvp`, `prediction`, `cup` y `off`;
  - `toggle ticker off`: elementos `marcador`, `lower`, `ticker` y `auto`.
- **Necesita:** Node en el PATH y `%APPDATA%\scl-bridge\config.json`, creado por `setup.mjs`.
- **Si falla:** el resultado queda en `_bridge\obs.log`.
- **Mismas acciones desde la web:** Admin → Overlay, en «Escena en OBS» y en «Popup para la comunidad».
- **Escenas de OBS** (cámaras, fuentes): se siguen cambiando con el plugin OBS WebSocket de Macro Deck. La fuente de
  navegador del overlay va sin `?scene=` para que siga la escena elegida con estos botones.

## Registro de partidos (`/partidos`)

La web pública de la liga muestra todo lo que sube el bridge, estilo SofaScore:

- **`/partidos`:** lista de partidos, los en vivo primero y después por día.
- **`/partidos/:matchKey`:** encabezado con goleadores y pestañas Resumen (minuto a minuto), Estadísticas,
  Alineaciones y Jugadores. Se actualiza en vivo.
- **Lógica:** `utils/matchCenter.js`, que nunca inventa datos: la posesión no aparece porque todavía no se mide.
- **Nombres:**
  - el bridge (`pes-collector/bridge/nameIndex.js`) los agrega a cada resumen como `names`;
  - los saca de `Team.bin`/`Player.bin` del parche y del `EDIT00000000`, cuyos nombres de equipo ganan porque son los
    que muestra el juego;
  - por defecto usa las copias de `vendor/`; se cambia con `pesdbDir` y `editFile` en `config.json`;
  - sin esos archivos el bridge sigue funcionando y la página muestra «Equipo 101» o «Jugador 119700».
- **Equipo con nombre de la liga:** si el equipo del juego está asignado a un club (Draft → PES), la página usa el
  nombre y el escudo del club.
