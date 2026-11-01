# Guía de administración: mercado, equipos y torneo

Para Santino y para las sesiones de código. Cómo actualizar el mercado de jugadores, sumar un equipo, cambiar el
manager de un club, editar o eliminar un club, cargar los partidos del torneo. Cada paso sale del código actual (revisado el 2026-10-30); si algo
cambia, actualizá esta guía en el mismo commit.

Antes de cualquier cosa: **un push a `master` publica la web** (Vercel). Probá en una rama, mergeá cuando esté listo.

---

## 1. Actualizar el mercado de jugadores

El mercado es `public/jugadores.json` (27 072 jugadores hoy). Sale de un CSV exportado del juego y lo usan tres
lugares, que tienen que quedar iguales:

| Qué | Archivo | Quién lo lee |
|---|---|---|
| Mercado de la app | `public/jugadores.json` (+ `jugadores.compact.json`, se genera solo en `dev`/`build`) | la web |
| Catálogo de precios del servidor | `supabase/functions/_shared/catalog.json` | la función `market` (fichar, liberar, aceptar ofertas) |
| Base del juego | Player.bin en el editor PES | Draft → PES (los ids tienen que coincidir) |

### Antes de empezar: los precios mueven los presupuestos

El presupuesto disponible de cada club es `presupuesto base − precio actual de cada jugador que tiene − ofertas
abiertas` (`supabase/functions/_shared/budget.js`). El precio sale **del catálogo vigente**, no del precio que pagó.
Si regenerás el mercado con la temporada en curso y un jugador sube de precio, **todos los clubes que lo tienen
pierden esa plata al instante**; si baja, la ganan. Liberar a un jugador devuelve su precio actual.

Por eso: actualizá el mercado **entre temporadas** (después del reinicio de temporada en Administración → General),
o con el mercado cerrado y avisando a los managers. Si es a mitad de temporada, compará antes los precios de los
jugadores fichados (`player_locks`) entre el catálogo viejo y el nuevo.

### Pasos

1. **Exportá la base del juego a CSV** con la aplicación que usás para eso. Guardalo como
   `scripts/jugadores_exportados.csv` (pisá el anterior). Tiene que ser la misma base que vas a cargar en el editor
   PES; si no, Draft → PES avisa ids desconocidos.
   - `[completar: nombre de la herramienta y cómo exportar]`
2. **(Opcional) Excluí jugadores** que no tienen que aparecer: `scripts/lista_jugadores.txt` (uno por línea) o la
   lista `LISTA_EXCLUSION_NOMBRES` en `scripts/main.py` (nombres en minúscula y sin tildes).
3. **Generá el mercado** desde la carpeta `scripts` (lee el CSV de esa carpeta):
   ```bash
   cd scripts
   pip install pandas numpy        # la primera vez
   python main.py                  # escribe scripts/jugadores.json, public/jugadores.json y scripts/paises.json
   ```
   Calcula OVR, posición y precio (fórmula T3: `ancla(OVR) × edad × posición × meta_posición`, ver comentarios en
   `main.py`). Si querés revisar presupuestos sugeridos, todavía dentro de `scripts`: `python calculate_budgets.py`
   → `team_budgets.md`.
4. **Regenerá el catálogo del servidor** desde la raíz del repo:
   ```bash
   cd ..
   node scripts/build-market-catalog.mjs
   ```
5. **Corré los tests**: `npm test`. Los que suelen fallar después de un mercado nuevo:
   - `tests/marketFunction.test.js` → el catálogo no coincide: te salteaste el paso 4.
   - `tests/landingSampleData.test.js` → los jugadores de ejemplo de la portada cambiaron de OVR, precio o posición,
     o ya no existen. Actualizá `components/landing/sampleData.js` con los valores nuevos.
6. **Fotos de jugadores nuevos.** No hay script que las genere: cada foto es `public/fotos_jugadores/{Id}.webp`,
   cuadrada. Un jugador sin foto muestra sus iniciales (`utils/playerPlaceholder.js`), así que no rompe nada.
   `scripts/leyendas.py` solo limpia fotos huérfanas de una copia; leelo antes de usarlo.
7. **Publicá la función del mercado primero** (es la que cobra con los precios nuevos):
   ```bash
   npx supabase functions deploy market --no-verify-jwt --project-ref pcmhsucbtonnaikiatuy
   ```
   Necesitás `npx supabase login` la primera vez. Si el proyecto de Supabase estaba pausado (plan gratis, 7 días sin
   uso), reactivalo desde el dashboard antes.
   **Sin computadora** (desde el celular): mergeá a `master` y en GitHub → Actions → **deploy-market** → Run
   workflow. Corre los tests del mercado y publica (`.github/workflows/deploy-market.yml`). Necesita el secreto
   `SUPABASE_ACCESS_TOKEN` cargado una vez (ver «Publicar desde el celular» al final).
8. **Publicá la web**: commit en una rama, PR, merge a `master`. Vercel hace el build.
9. **Probá en la web**: buscá un jugador nuevo y uno que cambió de precio, y mirá que el presupuesto de un club
   conocido sea el que esperabas.

---

## 2. Sumar un equipo

Un equipo del draft **es una cuenta**: el id del club es el id de Firebase del manager. No se crea a mano.

1. **El manager entra** a `/draft` con su Gmail (botón de Google). La app le crea el club solo, con presupuesto
   `DEFAULT_BUDGET` (200 000 000, `utils/constants.js`) y `approved: false`. Ve la pantalla de espera
   (`PendingApprovalScreen`): todavía no puede fichar, ofertar ni usar el chat. La app no tiene registro con email:
   una cuenta de email y contraseña solo existe si la creás vos en la consola de Firebase (Authentication).
   (Hasta el 2026-10-30 un Gmail nuevo era rechazado; `hooks/useAuth.js` ahora lo deja entrar como pendiente.)
2. **Vos lo aprobás**: Administración → Equipos y usuarios → **Aprobar** en su tarjeta.
3. **Editás el club** (botón Editar): nombre, escudo (subís la imagen; se achica y se guarda en Firebase Storage,
   `team_logos/`), país y presupuesto (en pesos, sin puntos).
4. **(Opcional) Acceso anticipado**: «Dar acceso anticipado» le deja usar el mercado aunque esté cerrado o programado.
5. **Web pública**: la historia y la ficha del club se escriben en Administración → Web pública (documento
   `club-{id}`). Su página es `/equipos/{id}`.
6. **En el juego**: en el editor PES → Draft → PES, asignale el equipo del juego que va a reemplazar (se guarda en el
   `draftMap` del espacio de trabajo).

### Pasar de 12 a 14 equipos (o cualquier otro número)

**No alcanza con dar de alta cuentas.** La tabla de la liga tiene 12 lugares fijos en el código:

- `utils/tournamentModel.js` → `LEAGUE_SIZE = 12`
- `utils/competitionRules.js` → `LEAGUE_SIZE = 12` (y los cupos de copas, `GOLD_CUP_PLACES`; el cálculo de
  emparejamientos asume 12)
- `utils/bracketModel.js` → cuartos de 4 cruces y semis de 2

Es una tarea de código: hay que revisar reglas de competencia, copas, fixture y la vista de la tabla juntos.

---

## 3. Cambiar el manager de un club

Caso: alguien deja la liga y otra persona sigue con su club (nombre, plantel, historia).

El club está atado al id de la cuenta de Firebase, así que cambiar de manager es **mover el club de una cuenta a
otra**. Lo hace la herramienta «Cambiar manager» (acción `transferClub` de la función del mercado, solo admin).

### Pasos

1. **El manager nuevo entra** a `/draft` con su Gmail. Queda como equipo pendiente y vacío («Equipo xxxxx»). No lo
   apruebes.
2. **Vos**: Administración → Equipos y usuarios → en la tarjeta de ese equipo pendiente, **Pasarle un club** (solo
   aparece en equipos pendientes y sin jugadores).
3. Elegí el club que pasa a esa cuenta y, si querés, escribí el nombre del manager nuevo (va a la ficha del club, en
   «Mánager en la liga»). Confirmá: no se puede deshacer.
4. Listo. Si el manager nuevo tenía la app abierta en la pantalla de espera, entra al club solo, sin recargar.

### Qué pasa a la cuenta nueva

Perfil (formación, dorsales, tácticas, franquicia, favoritos), equipo (nombre, escudo, presupuesto), plantel
(`player_locks`), carrito, filtros guardados, scouting, ofertas, traspasos, la historia y ficha de la web
(`club-{id}` → `club-{id nuevo}`, su página pasa a `/equipos/{id nuevo}`), el overlay de transmisión si el club está
en el aire, las formaciones compartidas y la asignación en Draft → PES de cada espacio de trabajo. Todo en una sola
transacción: si algo falla, no cambia nada.

### Qué no pasa

- Los mensajes del chat y los votos de la comunidad: quedan a nombre del manager anterior.
- Lo personal: email, forma de entrar y permisos (admin, roles del editor PES). La cuenta nueva conserva los suyos.
- La tabla del torneo no hace falta tocarla: guarda el nombre del club, que no cambia.

### La cuenta anterior

Queda bloqueada para siempre: si vuelve a entrar ve «Tu club pasó a otro manager» y no se le crea un club nuevo
(`clubTransferredTo` en su perfil, `hooks/useAuth.js`). Si querés que vuelva a la liga con otro club, que entre con
otro Gmail.

### Cuándo se frena

- La cuenta nueva no está pendiente o ya tiene jugadores u ofertas.
- El club ya pasó a otra cuenta.
- **El club es de una cuenta de administrador** (por ejemplo, la tuya): quedaría bloqueada y perderías el acceso a
  Administración.
- Quien lo pide no es admin para el servidor: tu uid tiene que estar en `ADMIN_USER_IDS` o tener el claim `admin`.
  Ser admin solo por el perfil (`isAdmin`) alcanza para ver Administración, pero no para el servidor.

### Caso especial: un club con cuenta vieja de email

Si el manager de siempre tiene un club con email y contraseña y entra por primera vez con Google, ahora le aparece un
equipo pendiente vacío en lugar de su club. Usá esta misma herramienta: pasale su club a ese equipo pendiente.

---

## 4. Editar un club

Administración → Equipos y usuarios → **Editar**: nombre, escudo, país, presupuesto y estadísticas manuales.

- El presupuesto que vale es `teams/{id}.budget` (el formulario lo guarda ahí).
- La tabla del torneo y el overlay identifican a los clubes por nombre: al renombrar, el formulario los actualiza en
  la misma transacción y te dice dónde («También se renombró en el torneo y el overlay»).

## 5. Eliminar un club

Administración → Equipos y usuarios → Editar → **Eliminar equipo**. No se puede deshacer. Borra la ficha pública, el
perfil (formación, dorsales, franquicia) y el carrito; **sus jugadores vuelven al mercado** y sus ofertas abiertas se
cierran. La cuenta de Firebase del manager sigue existiendo: si vuelve a entrar, se le crea un club nuevo pendiente de
aprobación.

## 6. Nueva temporada

Administración → General → reinicio de temporada (`utils/seasonReset.js`): vacía planteles, ofertas, traspasos,
noticias, formaciones compartidas, carritos y scouting, y devuelve el cupo de jugador franquicia. Mantiene
presupuesto base, nombre, escudo y permisos. Es el mejor momento para actualizar el mercado (sección 1).

## 7. Publicar las funciones del servidor (sin Claude y sin computadora)

La web (Vercel) se publica sola con cada push a `master`. Las **funciones de Supabase** no: si un cambio toca sus
archivos, hay que publicarlas a mano. Cada una tiene su botón en GitHub y corre sus tests antes de publicar; si un
test falla, no publica nada.

| Si cambió algo de… | Archivos | Botón (GitHub → Actions → … → Run workflow, rama `master`) |
|---|---|---|
| Fichar, liberar, traspasos, comisión, presupuesto, franquicia, catálogo | `supabase/functions/_shared/market.js`, `budget.js`, `transferFee.js`, `franchise.js`, `marketConstants.js`, `catalog.json` | **deploy-market** |
| Votos del público (predicción, MVP, encuestas de copa) o la forma de las copas | `supabase/functions/_shared/communityVote.js` y `community-vote/index.ts` | **deploy-community-vote** |
| Colector de partidos en vivo, overlay | `match-feed`, `overlay-control` | sin botón todavía: `npx supabase functions deploy <nombre> --no-verify-jwt --project-ref pcmhsucbtonnaikiatuy` desde una computadora |

Paso a paso desde el celular:

1. Esperá a que el push a `master` termine en verde (Actions → **tests**).
2. Actions → elegí el workflow de la tabla → **Run workflow** → rama `master` → **Run workflow**.
3. Abrí la corrida: tiene que terminar con el tilde verde en «Deploy …». Si queda en rojo en el paso de tests, el
   cambio rompió algo y la función vieja sigue publicada (nada se cae).

Si la forma de las copas cambia (por ejemplo, la Copa de Plata de 2026-11-01: 1er Reducido → 2do Reducido como
semifinal → final, sin semis de Plata), además de `utils/bracketModel.js` hay que revisar `CUP_PATHS` en
`supabase/functions/_shared/communityVote.js` (las rondas que se pueden votar) y después publicar
**deploy-community-vote**.

## 8. Cargar los partidos del torneo

Torneo → **Centro de partidos**. Los resultados salen del juego: el colector sube cada partido terminado y vos lo
pasás al torneo. La carga a mano queda para cuando el colector no corrió.

**Arrancar la liga.** Con el torneo vacío, el Centro de partidos muestra **Sortear Fecha 1**. Ves los cruces antes
de aceptarlos; si cancelás, no queda nada y podés volver a sortear. Aceptado, se publica al tocar **Guardar** (hasta
ahí, **Cancelar** lo tira). Las fechas 2 a 4 se arman solas cuando termina la anterior.

**Importar un partido del juego.** Arriba de la lista aparece **Partidos del juego sin importar (N)** cuando hay
alguno pendiente (solo lo ve el admin):

1. Revisá adónde va («Va a: Fecha 2, Club A vs Club B» o un cruce de copa) y el resultado.
2. **Importar** → confirmar. Se guarda solo: tabla, fecha suiza y copas se recalculan como al guardar a mano.
3. La primera vez que aparece un equipo del juego te pregunta a qué club del torneo corresponde. Queda guardado.

No importa si estás en modo **Editar**: guardá o cancelá primero. Nunca pisa un resultado que ya esté cargado. El
historial completo de partidos del juego está en Administración → Torneo y transmisión.

**Partidos «Del juego».** Llevan esa marca al lado de la fecha (también en las llaves de Copa de Oro y Copa de
Plata). En **Editar** su marcador, equipos, penales, goleadores y estado quedan bloqueados; fecha, hora y jornada sí
se cambian. Si el juego registró algo mal, **Corregir a mano** (pide confirmación) lo desbloquea en esa edición.

**Cargar a mano** (el colector no corrió): en **Editar**, marcador y penales en la tarjeta; goleadores, asistencias
y MVP en el desplegable **Goleadores, asistencias y MVP a mano**. Estado **Finalizado** y **Guardar**.
**Agregar partido a mano** es para cuando el suizo no pudo armar una fecha (aparece un aviso amarillo). Si borraste
una fecha que el suizo ya había armado, al guardar no se vuelve a generar sola: usá **Rehacer Fecha N**.

---

## Para las sesiones de código

| Tarea | Dónde |
|---|---|
| Generar el mercado | `scripts/main.py` (fórmula de precio, mapeos de posición, estilo y aptitud) |
| Catálogo del servidor | `scripts/build-market-catalog.mjs` → `supabase/functions/_shared/catalog.json` |
| Presupuesto | `supabase/functions/_shared/budget.js` (lo comparten app y función) |
| Fichar, liberar, aceptar, migrar cuenta, cambiar manager (`transferClub`) | `supabase/functions/_shared/market.js` |
| Pantalla «Cambiar manager» | `components/admin/ClubTransferDialog.jsx` (desde `TeamsAdminSection.jsx`) |
| Alta y aprobación | `hooks/useAuth.js`, `components/admin/TeamsAdminSection.jsx`, `supabase/functions/_shared/membership.js` |
| Tamaño de la liga y copas | `utils/tournamentModel.js`, `utils/competitionRules.js`, `utils/bracketModel.js` (Copa de Plata: `CUP_DEFINITIONS` y `advanceCups`) |
| Reglas del plantel (banco ≥ 73, mínimo 21, 7 locales) | `utils/squadRules.js`; pizarra `components/formation/BenchRule.jsx`, Mi Equipo `components/SquadRulesStats.jsx`, Administración → Reglas `components/admin/SquadRulesAdminSection.jsx` |
| Comisión de traspasos (15 % sobre la prima) | `supabase/functions/_shared/transferFee.js` (app y función); después **deploy-market** |
| Draft → PES | `pes/draftTransfer.js`, `components/pes/PesDraftPanel.jsx`, `docs/PES_ENGINE.md` §4b |
| Centro de partidos e importación del colector | `components/tournament/MatchCenter.jsx`, `MatchCard.jsx` (copas), `FromGame.jsx` (bloqueo «Del juego»), `components/admin/CollectorImportAdmin.jsx` (`variant="inline"` en el torneo), `utils/collectorImport.js`; sorteo y «Rehacer Fecha N» en `components/TournamentModal.jsx` |
| Reglas de Firestore | `firestore.rules` (`npm run test:rules` + `firebase deploy --only firestore:rules`) |

Tests de «Cambiar manager»: `tests/clubTransfer.test.js` (Firestore en memoria, corre con `npm test`) y el bloque
`transferClub` de `tests/rules/marketFunction.test.js` (emulador, `npm run test:rules`). Después de cambiar
`market.js` hay que volver a publicar la función (sección 1, paso 7).

**GitHub Actions** (`.github/workflows/tests.yml`): cada push corre `npm test` y los tests del emulador, así no hace
falta Java en la computadora. Los fallos aparecen como anotaciones en la corrida (pestaña Actions o el PR).

---

## Publicar desde el celular (una sola vez)

1. En supabase.com → tu avatar → **Account** → **Access Tokens** → **Generate new token**. Ponele un nombre
   (por ejemplo «github-deploy») y copiá el token: se muestra una sola vez.
2. En GitHub → el repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   Nombre: `SUPABASE_ACCESS_TOKEN`. Valor: el token. Guardar.
3. Desde ahí, cada publicación es: **Actions** → **deploy-market** o **deploy-community-vote** → **Run workflow**
   (rama `master`). El mismo secreto sirve para las dos; la sección 7 dice cuál usar.

El token da acceso a tu cuenta de Supabase: no lo pegues en ningún otro lado. Si lo perdés o se filtra, borralo en
Access Tokens y generá otro.
