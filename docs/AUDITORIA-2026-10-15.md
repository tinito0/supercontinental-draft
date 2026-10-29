# Auditoría integral — Supercontinental Draft (15/10/2026)

Sigue a `docs/AUDITORIA-2026-10-14.md`. Desde esa auditoría, fichar y aceptar traspasos se mueven a la
Edge Function `market` de Supabase. Esta revisión vuelve a mirar lo que quedó pendiente y suma lo que la
anterior no cubrió: el editor PES, el editor de formación, la administración, el torneo y la infraestructura.

**Clasificación:**
- **CONFIRMADO**: se leyó el camino del código y está mal.
- **POTENCIAL**: hace falta probarlo en ejecución.

## 1. Qué se ejecutó

| Verificación | Antes | Después |
|---|---|---|
| `npm test` | 483/483 | **497/497** (14 nuevos) |
| `npm run test:rules` (emulador, Java 21) | — | **57/57** (3 nuevos) |
| `npm run build` | — | OK |
| Cabeceras del sitio publicado (`curl -I`) | ver §5 | — |

**No se hizo:**
- deploy;
- cambios en Firebase, Supabase o GitHub;
- pruebas en un navegador;
- pruebas en el juego.

El bundle publicado ya llama a la función (`callMarket`), así que el bug C1 casi seguro está en producción.

## 2. Corregido en esta sesión (C1 + C3 + C2)

### C1: los traspasos no llegaban al plantel del comprador (CRÍTICO, CONFIRMADO)

**La causa:** los dos efectos que sincronizaban el carrito y la plantilla pública estaban **después del
`return` final de `App`** en `app.jsx`, así que nunca se ejecutaban. HEAD tiene el mismo orden. Además,
`acceptOffer` en la función mueve el lock y `teams.roster`, pero no toca `users/*/cart`.

**Qué pasaba tras cada traspaso aceptado:**
- El comprador no veía al jugador en Plantel ni en Tácticas, y no figuraba en su exportación.
- El presupuesto del comprador aparecía inflado en el precio base del jugador, así que el servidor
  rechazaba fichajes que la app mostraba como posibles.
- El carrito del vendedor seguía teniendo al jugador, y la exportación PES del admin lo dejaba en el equipo
  del vendedor.
- La plantilla pública nunca se actualizaba al fichar ni al liberar.

**La corrección:**
- **`hooks/useSquadSync.js` + `utils/squadSync.js` (puro, con tests):** se llama antes de cualquier `return`
  de `App`.
  - Agrega al carrito los jugadores cuyo lock es del equipo.
  - Quita los que el lock asigna a otro equipo.
  - Copia `teams.budget` al perfil.
  - Reescribe `teams.roster` sólo si cambió.
  - No escribe nada hasta que carrito y locks llegan **del servidor**, no de la caché persistente
    (`isCartSynced` / `isLocksSynced` en `useFirebaseData`).
  - Los renglones del carrito **sin ningún lock** no se borran: datos viejos podrían tenerlos y la pérdida
    sería definitiva. Presupuesto y exportaciones ya los ignoran.
- **`handleAddToCart`** ya no escribe el carrito: lo crea la sincronización cuando llega el lock. Así no hay
  un instante con carrito sin lock.
- **Si el equipo tiene jugadores sin datos** (comprados, con el catálogo sin cargar), la app carga el
  catálogo aunque esté en Overview.
- **`acceptOffer`** borra la copia del carrito del vendedor dentro de la transacción.
- **Test de regresión:** `tests/appHooksReachable.test.js` falla si vuelve a haber un hook después del
  `return` de `App`. Con el `app.jsx` viejo falla.

### C3: las exportaciones confiaban en el carrito (CRÍTICO, CONFIRMADO)

Antes, `services/draftTeamsService.js` armaba el plantel con el carrito, que el dueño puede escribir
(`firestore.rules`, regla de `cart`). Con el SDK, un manager podía meter cualquier jugador en su carrito y
Draft → PES y los CSV se lo pasaban.

Ahora el plantel sale de **los locks del equipo**:
- el carrito sólo aporta los datos del jugador;
- lo que falta sale del catálogo, que se descarga sólo si hace falta;
- los renglones del carrito sin lock quedan afuera y aparecen como avisos en el plan de Draft → PES
  (`squadWarnings`).

Además, el control de "jugador en dos equipos" ahora compara equipos, no nombres.

### C2: ofertas con monto negativo saltaban el presupuesto (CRÍTICO, CONFIRMADO)

Las reglas aceptaban cualquier `offerAmount`, y el servidor y la app sumaban las ofertas pendientes con
`Number(...)`. Una oferta pendiente de −1e12 dejaba fichar sin límite.

**La corrección:**
- `firestore.rules` exige montos enteros positivos (`isMoney`) al crear, al contraofertar y al volver a
  ofertar.
- `supabase/functions/_shared/budget.js` cuenta como 0 cualquier monto no positivo o no numérico.

### Una sola cuenta de presupuesto para la app y el servidor (parte de H6)

`supabase/functions/_shared/budget.js` la usan `market.js` (`getCommittedFunds`) y `hooks/useBudget.js`
(`calculateBudget`). La cuenta:
- base = `teams/{uid}.budget`;
- menos el precio de catálogo de los locks propios no franquicia;
- menos las ofertas pendientes enviadas.

La app ya no usa el precio guardado en el carrito. Un test de paridad compara las dos cuentas con los mismos
locks y ofertas.

**Cambio de comportamiento:** un lock viejo sin `isFranchise` cuenta como franquicia si coincide con
`franchisePlayerId` del perfil, igual que ya hacía la app. Antes el servidor lo cobraba.

### Deploy (en este orden)

1. `npx supabase functions deploy market --no-verify-jwt --project-ref pcmhsucbtonnaikiatuy`
2. `npm run build && firebase deploy` (reglas y app juntas)

Después del deploy, cada comprador recupera sus jugadores la próxima vez que abre la app.

**Pendiente de decidir:** si en producción hay renglones de carrito sin lock (aparecen como avisos en
Draft → PES), hay que elegir entre crearles el lock o borrarlos.

## 3. Pendiente — Alta

| # | Hallazgo | Evidencia |
|---|---|---|
| H1 | **La vinculación con Google está rota.** `onLinked={() => setNeedsGoogleLinking(false)}` (`app.jsx`, LinkGoogleScreen) usa un setter que `useAuth` no devuelve: ReferenceError. El vínculo simple funciona, pero muestra "Ocurrió un error". La rama `credential-already-in-use` (`LinkGoogleScreen.jsx:82-152`) escribe lo que las reglas prohíben: perfil con presupuesto y franquicia, borrar el equipo, mover locks, ofertas y fichajes. El usuario queda logueado con Google y sin equipo. Si la pestaña muere a mitad de camino, `sessionStorage.isMigrating` deja a `useAuth` trabado. | CONFIRMADO |
| H2 | **La liga privada no se valida en el servidor.** Cualquier usuario autenticado puede crearse perfil y equipo (`firestore.rules`, teams/profile create). La app sólo saca a los usuarios de Google sin perfil, y a las cuentas de email nuevas les crea un equipo sola. La función sólo pide que existan los dos documentos. | CONFIRMADO en el código; la consola de Firebase no se revisó |
| H3 | **La función copia al lock y al feed datos de la oferta que escribe el navegador**: nombres, escudos, nombre, OVR, posición y país del jugador. Las reglas sólo congelan 4 campos. | CONFIRMADO |
| H4 | **El mercado "programado" abre unas 3 h antes en el servidor.** `openTime` se guarda como hora local sin zona (`GeneralAdminSection.jsx:28`). La app la lee en hora local y la función en UTC. | CONFIRMADO |
| H5 | **Huecos en el ciclo del mercado:** `acceptOffer` y crear ofertas ignoran el estado del mercado; liberar no cierra las ofertas abiertas (el dinero del comprador queda retenido); `CartModal` deja liberar al Jugador Franquicia y se pierde la ficha; borrar un equipo deja el perfil y las ofertas, y el equipo vuelve en el siguiente login. | CONFIRMADO |
| H6 | **Falta el precio en el lock.** El servidor cobra el precio de catálogo *actual*, así que regenerar `jugadores.json` cambia retroactivamente todos los presupuestos. Un equipo viejo sin `budget` cuenta como 0 al aceptar. | CONFIRMADO |
| H7 | **Borradores del editor PES:** `apply` usa `drafts` de un render viejo (`usePesWorkspace.js:235`); `saveDrafts` borra los borradores creados durante el guardado; se guardan borradores que fallan; un guardado parcial se duplica al reintentar; `seq` sale del reloj del cliente. | CONFIRMADO |
| H8 | **Archivos del editor PES:** cualquier rol PES puede leer el EDIT, que tiene un Steam ID (`supabase/storage-policies.sql:36-42`); el hash de una textura se puede ocupar con basura; quitar un rol no revoca el acceso a Storage hasta correr el script de claims. | CONFIRMADO |
| H9 | **El CSV de formación corre los titulares.** `utils/pesExport.js:276-290` junta los titulares y saltea los puestos vacíos o vendidos, mientras `Formation.csv` sigue los puestos 0–10: cada titular siguiente queda en otro rol y otras coordenadas. `draftTransfer` sí rellena los huecos. | CONFIRMADO |
| H10 | **`scripts/credenciales.txt` sigue versionado.** | CONFIRMADO |

## 4. Pendiente — Media y baja (resumen)

**Mercado y ofertas**
- La notificación de venta muestra un `counterAmount` viejo; debería usar `getOfferAmount`.
- Responder una contraoferta no controla los fondos.
- Al crear una oferta no se controla si ya hay otra igual ni de quién es el jugador.
- Aceptar no pide confirmación.
- El chat de ofertas acepta mensajes de cualquiera, sin límite de largo.
- Un doble toque en Fichar muestra "éxito" y después un error 409.
- Un admin que sólo tiene el flag en el perfil ve el mercado abierto, pero el servidor no lo reconoce como
  admin.
- Con Supabase pausado no se puede fichar ni aceptar, pero liberar sí devuelve el dinero.
- No hay límite de plantel.

**Shell**
- Rutas de modal muertas:
  - `/modal/tournament` sólo funciona para el admin;
  - "Sugerencias" en la pantalla de mantenimiento no hace nada;
  - `/modal/player` no se usa.
- Escape cierra la ruta aunque se cancele la confirmación de cambios sin guardar.
- Los atajos de una tecla funcionan dentro de los modales (WCAG 2.1.4).
- La búsqueda no tiene debounce real.
- En Overview no hay avisos de fichajes, porque el catálogo no está cargado.
- Las notificaciones viven sólo en memoria: lo que pasa estando offline se pierde.
- La consulta de ofertas no tiene límite.
- Los errores que aparecen después de la carga no se muestran.

**Administración**
- El reseteo de temporada deja `teams.roster` y no se puede reanudar si falla.
- Cambiar el estado del mercado no pide confirmación, y "cerrado" bloquea toda la app.
- En Sugerencias, un error de carga se ve como buzón vacío.

**Torneo**
- Un guardado parcial deja noticias sin publicar.
- El tope de 12 equipos descarta el 13.º sin avisar.
- Los equipos se identifican por nombre.
- Las ediciones manuales de pg/pp se pisan.
- Los goles no tienen mínimo ni etiqueta, y se puede elegir el mismo equipo local y visitante.

**Editor de formación**
- Los dorsales y la disponibilidad no se guardan solos, aunque la pantalla dice "Guardado automático".
- Nunca aplica cambios hechos desde otro dispositivo y pisa todo al guardar.
- Cada flecha del teclado es una escritura.
- Las tácticas son públicas.

**Vistas públicas**
- `TeamScreen` lee todos los locks y el catálogo entero.
- Su plantilla mezcla datos que escribe el dueño, que puede mostrar un OVR falso.
- `FormationViewScreen` reintenta para siempre.

**Paneles del editor PES**
- Sin confirmaciones al descartar, quitar roles o reemplazar fuentes.
- Si el campo de liga queda vacío, los Kit Managers pueden editar **todos** los equipos.
- El selector de color crea un borrador por cada paso del arrastre.
- Borrar un campo numérico guarda 0.
- El CSV no escapa `;`.

**Chat**
- Los mensajes de sólo GIF siempre fallan.
- El chat se puede leer sin iniciar sesión.

**Infraestructura (verificado en el sitio)**
- `/` y todas las rutas devuelven HTML con `max-age=3600`; sólo `/index.html` tiene no-cache, así que se
  puede usar la versión vieja hasta una hora después de un deploy.
- Una foto que no existe devuelve `index.html` con 200, y el service worker la guarda como foto.
- `vite:preloadError` recarga sin límite.
- El service worker cachea sin límite.
- No hay CSP. **HSTS sí está**: la auditoría anterior se equivocó en eso.
- `public/jugadores_exportados.csv` (19 MB) y `jugadores.json` (60 MB) están versionados y publicados.

**Accesibilidad**
- Unos 7 diálogos hechos a mano sin foco atrapado.
- `.btn` mide 40 px y `.btn-sm` 32 px.
- Contraste insuficiente en los toasts.
- Faltan labels en el login, la exportación y el torneo.
- Hay botones de ícono sin `aria-label`.

**Correcciones a la auditoría anterior:**
- La "sincronización que reescribía la plantilla en cada lock" nunca se ejecutó (era C1).
- HSTS existe.
- `placehold.co`, los íconos del manifest y `vendor-charts` ya estaban resueltos.
- Aceptar un traspaso ya cierra las demás ofertas por el jugador.

## 5. Funcionalidades nuevas propuestas (por valor y esfuerzo)

1. **Bandeja "desde tu última visita".** Guarda `lastSeenAt` en el perfil y arma las novedades con
   `offers.history` y `transfers`. No necesita servidor nuevo.
2. **Aprobación de nuevos managers.** El admin aprueba en `TeamsAdminSection`; las reglas y la función piden
   `approved`. Resuelve H2.
3. **Migración de cuenta en el servidor.** Una acción `migrateAccount` en la función. Resuelve H1.
4. **Reglas de plantel en `config/market`.** Máximo de jugadores y mínimo de arqueros, controlados por la
   función.
5. **Ofertas que vencen.** Una oferta con `expiresAt` deja de retener dinero al vencer.
6. **Libro de pases del club.** Los fichajes ya guardan precio, lo que recibe el vendedor y la comisión.
7. **Informe previo a la exportación.** Avisos por equipo antes de exportar, reusando `squadWarnings` y los
   avisos de `draftTransfer`.
8. **Cuenta regresiva del mercado.** La apertura programada se ve al momento, sin recargar.
9. **Resultados cargados por los managers**, con confirmación del rival. Conviene después de identificar los
   equipos del torneo por uid.

## 6. Hoja de ruta

**Fase 1 (integridad y seguridad):**
1. ~~C1/C3/C2~~ (hecho).
2. ~~H3, H4, H5~~ (hecho: liberar pasa al servidor y cierra ofertas; aceptar respeta el mercado; nombres desde
   los equipos; `openTime` como instante ISO; borrar un equipo borra el perfil y cierra sus ofertas).
3. ~~H1~~ (hecho: `onLinked` arreglado; la rama de migración muestra "pedile al administrador").
4. ~~H10~~ (cerrado: esas credenciales ya no se usan).
5. ~~No-cache para el HTML y guarda en `preloadError`~~ (hecho; las cabeceras se verifican después del deploy).
6. ~~H6~~ (descartado: el plantel se sigue cobrando al precio del catálogo vigente, igual en la app y en
   el servidor).

**Fase 2 (flujos existentes):**
- ~~H9~~ (hecho: titulares alineados a los puestos; nombres sin `;` en los CSV).
- ~~H7~~ (hecho: borradores desde `draftsRef`, guardar sólo lo capturado, sin borradores que fallan, id de
  operación = `clientId`).
- ~~H8~~ (hecho en parte: una textura con el hash ocupado por otro contenido ahora se detecta al subir. El EDIT
  sigue legible para los roles PES: los Kit Managers lo necesitan para los colores y el Admin del Draft para
  ver los equipos; el Steam ID es un identificador público).
- ~~Autoguardado de dorsales~~ (hecho: dorsales y disponibilidad se guardan solos, con debounce; las flechas
  del teclado son una escritura por ráfaga; lo pendiente se guarda al cerrar).
- ~~Torneo identificado por uid~~ (resuelto de otra forma: sólo el admin renombra clubes, y el renombrado se
  propaga al torneo y al overlay en el mismo batch; además, torneo y noticias en un batch y aviso en vez de
  descartar el 13.º club). Campo de liga del editor PES precargado y validado.
- Mercado cerrado como sólo lectura.
- Rutas de modal muertas y Escape.
- Reglas del chat de ofertas.
- Confirmaciones en el editor PES.

**Fase 3:** las funcionalidades de §5, en ese orden.

**Fase 4:**
- Seguir dividiendo `app.jsx`.
- ESLint mínimo (`rules-of-hooks`, `no-unreachable`).
- Índice liviano del catálogo para las vistas públicas.
- Arreglos del service worker.
- CSP.
- Pasada de accesibilidad.
- Código y archivos sueltos.
