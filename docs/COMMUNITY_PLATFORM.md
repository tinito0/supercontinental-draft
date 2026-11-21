# Comunidad: predicciones, manager de la fecha y encuestas (diseño)

Votos y predicciones del público, alimentados por los datos en vivo del colector (bridge → `match-feed` →
`live_matches`). Lo mismo alimenta el OBS. Requisito previo: las reglas de `docs/SECURITY_AUDIT.md`, ya desplegadas.

## Decisiones del usuario (2026-10-22)

| Tema | Decisión |
|---|---|
| Identidad | Sin cuenta (anónimo) |
| Predicción | Local, empate o visitante (el empate se sumó el 2026-10-22, a pedido) |
| Encuesta de la copa | «¿Quién gana la Copa de Oro / de Plata?»: la abre y la cierra el admin con los equipos que elige |
| Manager de la fecha | Reemplaza al MVP de cada partido (2026-11-20): el público elige al manager que mejor manejó su equipo en el PES en la fecha. Suma para el Manager del torneo |
| Orden | La comunidad va antes de conectar las reglas 2/1/0 y de importar partidos del colector |
| OBS y página | Funcionan con los datos en tiempo real del bridge |

## De dónde salen los datos

- **Partido en curso:** `live_matches/{matchKey}`, escrito por el bridge cada ~3 s. Trae estado (live/finished),
  reloj, marcador, goles, tarjetas, cambios y alineaciones (titulares y los que entraron).
- **Partido programado:** el que el admin pone «Al aire» en el overlay (`broadcast/overlay.matchId`, un partido del
  fixture). Todo se juega en una sola PC, así que el partido en vivo **es** el partido al aire. Así se vinculan el
  fixture y el juego mientras no exista la tabla de equipos del juego a equipos del torneo (Draft → PES).

## Ventanas, controladas por el servidor

| Qué | Abre | Cierra |
|---|---|---|
| Predicción (quién gana) | Cuando el admin pone el partido al aire | Al minuto 1 del partido en vivo (la función lo ve en `live_matches`) |
| Manager de la fecha | Cuando todos los partidos de la fecha tienen resultado | 24 h después del `finishedAt` del último partido del juego de la fecha; si algún resultado se cargó a mano, 24 h desde el primer voto (`openedAt`) |

Los candidatos son los clubes que jugaron la fecha (sus nombres en el torneo). La votación de la fecha vive en
`public/data/manager_votes/{fecha-n}`.

## Función `community-vote` (Supabase, igual que `match-feed`)

- **Pedido:** `POST { kind: 'prediction' | 'manager' | 'cup', matchId | roundId | pollId, choice, deviceId }`, sin login.
- **Validaciones:**
  - la ventana está abierta, según el estado en vivo leído en el servidor;
  - la opción es válida (`home`/`draw`/`away`, un club que jugó la fecha o una opción de la encuesta);
  - el `deviceId` es aleatorio, generado y guardado en el navegador.
- **Un voto por navegador y partido:** una boleta `community_ballots/{kind}_{partido}_{hash(deviceId)}`, creada en
  una transacción; si ya existe, el voto se rechaza.
- **Tope por conexión:** máximo N votos por IP y partido. La IP se guarda solo como `hash(ip + sal secreta)`; contempla
  casas o bares con varios votantes.
- **Totales:** `public/data/community/{partido}` (lectura pública, escritura solo de la función) con
  `prediction: { home, away, closed }` y `mvp: { votes: { playerId: n }, closesAt, winner }`.
- **Aceptado:** sin cuenta, alguien puede votar de nuevo con otro navegador. El tope por IP lo limita.

## Página pública `/en-vivo` (el QR apunta acá)

Una URL fija que siempre muestra el partido actual o el próximo, ideal para el QR del stream:

- **Antes:** los dos equipos y la predicción (botones Local / Visitante y después los porcentajes).
- **Durante:**
  - marcador y reloj en vivo;
  - goles con autor y asistencia, tarjetas y cambios;
  - (sin votación de jugadores: el manager se vota al terminar la fecha).
- **Después:** resultado final, cómo terminó la predicción y las estadísticas del partido.
- **Al terminar la fecha:** la votación del manager de la fecha con el resultado de cada club, 24 h; después el ganador.
  Debajo, el Manager del torneo (fechas ganadas).

## OBS con datos en vivo

- **Previa:** equipos del partido al aire y el porcentaje de la predicción.
- **Durante el partido:** solo el popup. Aparece **solo**, sin el admin:
  - al entretiempo, con «Votá en la web»;
  - al final del partido, con lo mismo.

  El admin puede apagar el automático.
- **Final:** resultado, goleadores y mejor valoración del juego, tomados de `live_matches`, sin cargarlos a mano.
- **Tabla y copas:** como hoy, desde el torneo.

## Etapas

1. **C1:**
   - función `community-vote`;
   - docs `community` y `community_ballots`;
   - reglas y tests (unitarios y del emulador).
2. **C2:** página `/en-vivo` en la web de la liga.
3. **C3:** OBS automático: popup en el entretiempo y al final, y escenas previa y final con datos en vivo.
4. **C4:** Manager del torneo, que suma las fechas ganadas (antes: Jugador del Torneo con los MVP).

Cada etapa que toca producción (función, reglas, hosting) se despliega solo con OK.

## Estado (2026-10-22)

C1 y C2 están programadas y probadas. No están desplegadas.

**Función:** `supabase/functions/community-vote` (lógica en `_shared/communityVote.js`).
- Predicción por partido del fixture al aire: `public/data/predictions/{matchId}`.
- Manager de la fecha: `public/data/manager_votes/{fecha-n}` (antes `mvp_votes/{matchKey}`, que ya no se usa).
- Boletas `community_ballots` y contadores por IP `community_ip`, guardados como hashes y solo legibles por el admin.

**Cierre de la predicción:** `match-feed` la cierra al recibir el partido en vivo (`predictionClosure`) y la vincula con
ese partido del juego (`liveMatchKey`).

**Página `/en-vivo`:** `screens/league/LeagueLiveScreen.jsx`. El popup «vota» del overlay y de Macro Deck lleva ahí.

**Tests:**
- Unitarios: `tests/communityVote.test.js` y `tests/communityView.test.js`.
- Emulador (`npm run test:rules`): `tests/rules/communityVote.test.js`. Cubre un voto por navegador, tope por IP,
  ventanas, candidatos y que nadie escribe los totales.

**Para activarla:**
1. Secret `COMMUNITY_SALT`: 32 caracteres o más, al azar.
2. `npx supabase functions deploy community-vote --no-verify-jwt`, y volver a desplegar `match-feed`.
3. Desplegar las reglas.
4. Desplegar el hosting.

`COMMUNITY_ALLOWED_ORIGINS` es opcional; por defecto acepta la web de producción y `localhost`.

## C3 y extras (2026-10-22): programado y probado, sin desplegar

**OBS automático, desde `match-feed`** (`_shared/overlayControl.js` `liveOverlayUpdate`; solo escribe lo que cambia):
- `liveMatchKey` en el overlay: el partido que el bridge sube en vivo. Lo usan las escenas Previa (predicción),
  Entretiempo y Final (marcador del juego, goleadores y mejor valoración).
- Popup «Votá en la web», 45 s:
  - en el entretiempo: el reloj del segundo tiempo en 45:00 (si se saltea, sale al arrancar el segundo tiempo);
  - al final.
  - Los partidos viejos que el bridge reenvía no lo disparan.
- **Tarjetas de la comunidad**, 20 s, del lado izquierdo:
  - la predicción, al arrancar un partido nuevo;
  - (la tarjeta del MVP desde el minuto 70 se sacó: el manager se vota cuando termina la fecha).
  - Sin votos no aparecen.
- **Llave «Automático»** (Admin → Overlay, o Macro Deck `toggle auto`): `autoPopup: false` apaga el popup y las
  tarjetas automáticas.

**Tarjetas a mano** (Admin → Overlay, Macro Deck `card`): `manager` (manager de la última fecha, top 3 con porcentaje), `prediction` (local, empate,
visitante y cuál va ganando) y `cup` (la encuesta abierta, primero Oro).

**Encuesta de la copa:**
- Datos: `public/data/polls/{copa-oro|copa-plata}`.
- **Admin:** Admin → Overlay → «¿Quién gana la copa?». Los equipos sugeridos son la primera ronda de esa copa; si no
  está armada, toda la tabla. Con votos, las opciones quedan fijas.
- **Voto:** en `/en-vivo`, a través de `community-vote`.
- **Seguridad:** igual que los otros votos, con boleta por navegador y tope por IP.

**Para activarlo:**
- además de lo de C1/C2, volver a desplegar `match-feed`, `overlay-control` y `community-vote`;
- desplegar las reglas (`polls`);
- desplegar el hosting.

## Control del admin (2026-10-23)

**Dónde:** Administración → Comunidad (`components/admin/CommunityAdminSection.jsx`). Las escrituras pasan por
`services/communityAdminService.js`.

**Cerrar y reabrir:**
- **Predicción y manager de la fecha:** «Cerrar ahora» / «Reabrir» escribe `closedAt` en `predictions/{matchId}` o en
  `manager_votes/{fecha-n}`. `community-vote` rechaza votos mientras exista ese campo. Cerrada a mano igual muestra
  los resultados en `/en-vivo`.
- **Encuestas de copa:** se abren y cierran con `open`, como antes.

**Reiniciar votos** (predicción, manager de la fecha y cada encuesta), siempre con confirmación:
1. Pone `votes: {}` y `total: 0`, y suma 1 a `resetCount`, con `mergeFields` para que no queden conteos viejos.
2. Borra las boletas y los topes por IP de esa votación (`community_ballots` y `community_ip`, buscados por prefijo
   de id). Lo permite el catch-all de admin en las reglas.

**El navegador:**
- Recuerda el voto junto con la ronda (`{ choice, round }`). Si `resetCount` cambió, lo olvida y se puede volver a
  votar.
- Los votos guardados antes de esta versión, como texto plano, cuentan como ronda 0.

**Tests:** `tests/communityService.test.js` y «castVote: manager de la fecha» en `tests/communityVoteWindows.test.js`.
