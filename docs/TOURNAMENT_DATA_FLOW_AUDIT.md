# Torneo: cómo funciona hoy y qué falta para el colector de PES

Revisión de solo lectura (2026-10-21) del código del torneo, antes de conectarle los partidos que sube el colector
(docs/MATCH_FEED.md). Nada de esto cambió la app; las reglas nuevas están en `utils/competitionRules.js` sin usar.

## 1. Cómo funciona hoy

| Qué | Dónde |
|---|---|
| Datos | Un solo documento: `artifacts/{APP_ID}/public/data/tournament/official` (lectura pública, escritura admin) |
| Editor | `components/TournamentModal.jsx` (solo admin, edición local → botón Guardar) |
| Guardado | `app.jsx` `handleUpdateTournament`: batch con el torneo (`mergeFields`) + una noticia por resultado nuevo o corregido (`getMatchesWithNewResults`) |
| Tabla y goleadores | `components/tournament/tournamentEngine.js` `buildAutomaticTournamentReport`, al guardar |
| Orden de la tabla | `TournamentModal.jsx` `sortLeague`: puntos → diferencia → goles a favor |
| Partidos | `matches[]`: `{ id, round, homeTeam, awayTeam, homeScore, awayScore, date, mvp, homeGoals, awayGoals, homeAssists, awayAssists, homeConfirmed, awayConfirmed, status: scheduled/completed }` |
| Copas | `bracket.{quarters[4], semis[2], final}` (Oro) y `bracket.repechaje.{r1[4], r2[2], semis[2], final}` (Plata), cada cruce `{ teamA, teamB, scoreA, scoreB }`; estructura en `utils/bracketModel.js` |
| Vistas públicas y OBS | `/torneo`, `?mode=obs&view=…` leen el mismo documento |

Fuente de verdad: el documento `tournament/official`. Los equipos se identifican **por nombre** (texto), igual que
goleadores y asistentes ("Haaland x2, Foden"); no hay ids de equipo ni de jugador en el torneo.

## 2. Hallazgos

| # | Gravedad | Hallazgo |
|---|---|---|
| T1 | **Alta** | **Empates de liga**: el motor da 1 punto a cada equipo y suma "GPEN" a los dos. El reglamento dice 1 punto solo al que gana la tanda y 0 al que pierde. El partido no guarda la tanda, así que hoy no hay forma de cargarlo bien. |
| T2 | Alta | Las copas no guardan penales: `getMatchWinner` da `null` en un empate, así que un cruce definido por penales no tiene ganador y no avanza solo. Tampoco hay avance automático en general: cada ronda se completa a mano. |
| T3 | Media | Desempates: falta "victorias en los 90'" y "victorias totales" entre la diferencia y los goles a favor, y los empates totales se ordenan en silencio (sin aviso). |
| T4 | Media | No hay generador de fechas suizas ni control de revancha: los cruces de liga se cargan a mano. |
| T5 | Media | Identidad por texto: un nombre mal escrito crea un club nuevo (hay aviso de "más de 12") y un goleador escrito distinto cuenta como otro jugador. |
| T6 | Baja | Un gol en contra no tiene dónde ir: hay que no anotarlo en goleadores (es lo que hace el colector). |
| T7 | Info | Copa de Plata: el modelo de la app (8 equipos en preliminares → 2 → semis con los 2 perdedores de semis de Oro → final) es válido; la descripción del reglamento no cierra en números (sección 5). |

## 3. Qué ya está hecho (sin conectar)

`utils/competitionRules.js` + `tests/competitionRules.test.js` (17 tests, datos sintéticos):
- `leagueMatchOutcome`: 2 / 1 / 0, exige tanda tras empate, la tanda no cuenta como goles (corrige T1).
- `buildLeagueStandings` + `rankStandings`: desempates del reglamento y lista de empates sin resolver (T3).
- `swissPairings`: fecha suiza óptima (menor diferencia de puntos) sin revanchas; si no se puede, lo dice (T4).
- `goldCupQuarterFinals`: 1-8, 4-5, 2-7, 3-6. `knockoutWinner`: marcador con alargue y después la tanda (T2).
- `placeCupResult`: ubica un partido terminado de la Konami Cup en su cruce del bracket (ver 4).

En el colector ya existía `toTournamentFields` (`pes-collector/collector/matchSummary.js`): convierte un partido
terminado a los campos del torneo, sin goles en contra en la lista de goleadores.

## 4. Propuesta de integración (para aprobar)

1. **Modelo**: agregar a los partidos de liga `homePenalties` / `awayPenalties` y a los cruces `penaltiesA` /
   `penaltiesB`, opcionales. Los partidos viejos siguen valiendo.
2. **Motor**: `tournamentEngine.js` pasa a usar `competitionRules.js` (puntos, tabla y desempates). Cambia la tabla
   publicada si hubo empates cargados; se avisa antes de guardar.
3. **Equipos**: tabla `gameTeamId → nombre del torneo`, derivada de la asignación Draft → PES (`draftMap`:
   draft team → equipo del juego; el nombre sale de `teams/{uid}.teamName`).
4. **Partidos del colector en el admin**: lista de `live_matches` terminados. Liga (amistoso): elegir el partido del
   fixture con esos dos equipos → vista previa de `toTournamentFields` → Guardar (mismo flujo y noticia de hoy).
   Copa (torneo 48): `placeCupResult` encuentra el cruce → vista previa → Guardar. Nunca pisa un resultado ya cargado.
5. **Avance de copas**: con `knockoutWinner`, el ganador pasa solo a la ronda siguiente (Oro) y los perdedores entran
   a la Plata según el flujo que se apruebe.
6. **Fechas suizas**: botón "Generar fecha N" con `swissPairings`, vista previa y aprobación del admin.

Sobre "importar los cruces de la copa desde el juego": el juego no expone el sorteo de la Konami Cup en lo que leemos
hoy (solo el partido que se está jugando, con tournament_id 48). Al revés sí funciona y es lo recomendado: la web
calcula los cruces (`goldCupQuarterFinals`), se arman igual en la Konami Cup, y cada partido jugado se ubica solo en
su cruce con `placeCupResult` (punto 4). Leer el sorteo del juego requeriría investigar el modo Copa (partida
guardada o memoria) y sigue abierto.

## 5. Copa de Plata: cuentas

Reglamento descrito: Preliminar (puestos bajos) → Repechaje de cuartos (4 perdedores de cuartos de Oro) → Fusión
(ganadores de la preliminar vs perdedores de cuartos) → Semis (ganadores de la fusión + 2 perdedores de semis de Oro) → Final.

- Las semis tienen 4 lugares; 2 son de los perdedores de semis de Oro → la Fusión debe dar **2** clasificados → tiene
  **4** equipos. Pero solo los perdedores de cuartos ya son 4: la Preliminar no podría aportar a nadie.
- El ejemplo "7.° vs 8.°" contradice que del 1.° al 8.° van a la Copa de Oro.
- Con 12 equipos, los que no van a Oro son 4 (9.° a 12.°).

Opción que cierra con el modelo actual de la app (`r1[4] → r2[2] → semis[2] → final`), cambio mínimo:
**Ronda 1** = 9.° a 12.° contra los 4 perdedores de cuartos de Oro (4 partidos, 8 equipos) → **Ronda 2** = 2 partidos
→ **Semis** = esos 2 + los 2 perdedores de semis de Oro → **Final**. Preliminar y Fusión quedan en una sola ronda.
Falta definir cómo se cruzan en la ronda 1 (p. ej. 9.° vs peor perdedor de cuartos). **No se implementa hasta que lo
confirmes.**

## 6. Preguntas abiertas

1. ¿Confirmás 2/1/0 con la tanda para el ganador (T1)? Cambia la tabla si ya hay empates cargados.
2. Desempate final si todo sigue igual: ¿sorteo, partido extra, decide el admin?
3. Copa de Plata: ¿sirve la opción de la sección 5? ¿Cómo se cruzan en la ronda 1?
4. Fecha 1 suiza: ¿orden inicial por sorteo, por el draft, otro?
5. Partidos de Plata: ¿también en la Konami Cup (otro torneo del juego) o como amistosos? Afecta cómo distingue el
   colector un partido de Oro de uno de Plata (hoy los dos serían tournament_id 48).
