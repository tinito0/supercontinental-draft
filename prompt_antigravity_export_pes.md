# Contexto para Antigravity CLI — Feature: Exportar plantilla en formato PES (option file)

## Quién sos y qué necesito

Estás trabajando sobre el repo `tinito0/supercontinental-draft` (React + Firebase/Firestore), la web de mercado/draft de la SuperContinental League™, una liga amateur de PES 2021 entre 12 managers. Necesito que analices el código real del repo (no asumas nada de lo que sigue sin confirmarlo vos mismo en los archivos) y me devuelvas un plan de implementación concreto, con tradeoffs, antes de tocar una sola línea. Esto es intencional: quiero validar el análisis antes de que se escriba código.

## Objetivo de negocio

Quiero poder reemplazar un club existente del juego (ej. "Panathinaikos") por uno de los clubes ficticios de la liga (ej. "Dinamo Visegrad"), conservando el mismo `Id` interno de PES para no romper referencias del juego, pero con toda la data nueva (plantilla, nombre, etc.). Para lograrlo necesito que la web de mercado pueda **exportar la plantilla de un equipo en el formato de "option file" de PES**, que consiste en un set de CSVs: `Team.csv`, `Roster.csv`, `Players.csv`, `Coach.csv`, `Formation.csv`. Tengo un ejemplo real de referencia (export de Liverpool FC con Id=103) que podés usar para ver el esquema exacto de columnas de cada archivo.

## Lo que ya analicé (verificalo, no lo des por sentado)

Revisé el repo y encontré lo siguiente. Quiero que confirmes esto contra el código actual (puede haber cambiado) y corrijas cualquier error mío:

1. **Roster.csv es 100% automatizable.** Cada equipo en Firestore (`artifacts/{APP_ID}/public/data/teams/{uid}`) guarda `team.players`, y cada jugador conserva su `Id` original de PES (mismo id que usa `Players.csv`/`Team.csv` para referenciarse — confirmado porque el export a PDF en `components/AdminModal.jsx` (~línea 774) lo etiqueta literalmente "ID (Juego)"). También existe `team.dorsals` (mapa `{playerId: numeroDeCamiseta}`).

2. **Players.csv se puede generar sin pérdida**, pero OJO: no hay que reconstruirlo desde `jugadores.json` (el pipeline `main.py` descarta columnas como `YouthClub`, `ContractUntil`, todos los `Edit*`, `DribbleMotion`, etc. — ver la lista `columnas_a_incluir` en `main.py`). En cambio, como cada jugador conserva su `Id` original, la fila completa y sin pérdida se puede sacar directamente del CSV maestro `jugadores_exportados.csv` (que tiene el esquema completo de `Players.csv`), matcheando por `Id`.

3. **Team.csv y Coach.csv NO tienen dato de origen en la app.** El modelo de datos del equipo en Firestore solo tiene `teamName` y `logoUrl`. Las ~130 columnas de `Team.csv` (colores de kit, escudo, estadio, sponsors, rivales) y toda la ficha de `Coach.csv` no existen en ningún lado del código — no hay feature de DT ni de identidad visual más allá del logo.

4. **Formation.csv es parcial.** Existe `utils/constants.js` → `FORMATIONS`, con un `layout` por esquema táctico (ej. "4-3-3") que da `{pos, x, y}` por slot, pero en escala 0-100 pensada para el pitch visual de la UI, no en la escala/códigos de posición reales que usa PES en `Formation.csv`. Se podría reversear la escala/mapeo usando el `Formation.csv` de referencia (Liverpool), pero no es automático hoy.

5. **`dorsals` no cubre toda la plantilla.** En `components/FormationModal.jsx` (~línea 165-184), al guardar se filtra `dorsalsToSave` contra `validSavedIds`, que sale de los valores del `lineup` (el 11 titular) — es decir, los dorsales de suplentes no quedan persistidos hoy. Para que `Roster.csv` tenga número de camiseta de toda la plantilla (hasta 40 jugadores) hay que revisar/ajustar esa lógica.

## Pista extra: ya existe un export parecido en el código

En `components/AdminModal.jsx` (la misma zona de ~línea 740-830 que ya te marqué) hay una función que genera un **PDF llamado "Plantilla"** por equipo, y hace exactamente el join que necesitás para `Roster.csv`: recorre `team.players`, cruza con `team.lineup` (para el 11 titular por slot táctico), con `team.dorsals` (número de camiseta) y con `FORMATIONS[team.formation]` (para el rol táctico de cada slot), y arma la tabla de titulares + banquillo con `Id` (juego), dorsal, nombre, posición natural y valoración.

Te adjunto un PDF real generado por esa función (`Plantilla_PORTLAND_ROVERS_Tactico.pdf`, equipo Portland Rovers) para que veas el resultado y uses esa misma función/lógica como base o referencia directa para armar `Roster.csv` — capaz ni hace falta escribir el join de nuevo, solo reformatear la salida a CSV.

Cosas para que notes en ese PDF de ejemplo (confirman puntos que ya marqué arriba):
- Hay jugadores del banquillo sin dorsal asignado (aparece "-"), lo que confirma el problema de `dorsals` que no persiste para todo el plantel, no solo el 11 titular.
- La columna "Pos" del banquillo es la posición **natural** del jugador (`POS_NOMBRE`), mientras que en el 11 titular la columna "Rol" es la posición **táctica del slot** de la formación (pueden no coincidir, ej. C. Pulisic natural ED jugando de MD) — para `Formation.csv` vas a necesitar diferenciar estos dos conceptos.
- Hay un jugador con un `Id` de 10 dígitos (`CAIO LUCAS — 1073803084`) que no pinta como un Id real de la base de PES (los demás son de 5-6 dígitos) — puede ser un jugador editado/creado a mano. Marcalo como caso borde a resolver: qué hacer en `Players.csv` si el `Id` no matchea contra `jugadores_exportados.csv`.

Si para hacer un análisis más extenso de cómo funciona el sistema de datos preferís tener más ejemplos de plantillas reales (más PDFs de este tipo, u otros equipos), avisame y te paso más antes de que sigas.

## Lo que quiero que hagas

1. **Verificá cada uno de los 5 puntos de arriba** contra el código actual del repo. Decime si algo cambió o si mi lectura está mal.
2. **Analizá el `Formation.csv` y `Team.csv` del ZIP de referencia** (`Liverpool FC - 103`, contiene `Team.csv`, `Roster.csv`, `Players.csv`, `Coach.csv`, `Formation.csv`, `Appearances.csv`) para documentar el esquema exacto de columnas de cada archivo, con foco en `Formation.csv` (códigos de posición numéricos, rango real de `LocationX`/`LocationY`, qué son `AttackingStylesS1`, `BuildUp...`, etc.) y `Team.csv` (qué columnas son obligatorias para que el juego no rompa vs. cuáles son cosméticas).
3. **Proponeme un plan de implementación en fases**, con esta base como punto de partida (podés cuestionarla):
   - **Fase 1**: botón "Exportar Plantilla PES" (en `components/AdminModal.jsx`, por equipo) que genera un ZIP con `Team.csv` (solo `Id`+`Name` completos, resto en blanco para completar a mano), `Roster.csv` completo, y `Players.csv` con la fila original completa de cada jugador (matcheada por `Id` contra `jugadores_exportados.csv`).
   - **Fase 2 (a confirmar conmigo)**: si conviene generar también `Coach.csv`/`Formation.csv`, y si vale la pena, para eso, construir nueva UI de captura de datos (colores, estadio, DT) o mantenerlo manual en el editor del juego.
4. **Para la Fase 1**, decime también qué cambios mínimos hacen falta en `dorsals` (ver punto 5) para que el número de camiseta salga correcto para toda la plantilla, no solo el 11 titular.
5. **No implementes nada todavía.** Quiero el análisis + plan + preguntas abiertas primero, para darte el ok antes de que generes código.

## Restricciones y estilo del proyecto

- Todo el contenido de cara al usuario/manager va en español (Argentina, voseo).
- No asumas nada del modelo de datos sin verificarlo vos mismo en el repo — no confíes ciegamente en mi resumen de arriba.
- Priorizá no romper nada de lo que ya funciona en el mercado/draft (fichajes, cashback, formaciones actuales).
