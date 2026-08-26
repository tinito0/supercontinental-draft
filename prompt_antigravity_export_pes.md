# Contexto para Antigravity CLI — Fix de Pateadores + Feature de Estrategia (v2, diagnóstico confirmado)

Este prompt reemplaza al anterior (`prompt_antigravity_roles_kickers_tactics.md`). Esta vez el diagnóstico **no es una hipótesis** — está confirmado leyendo el código real del repo (commit `c11dc699`, "A lot of changes", 26/08). Repasá igual el código vos mismo antes de tocar nada, por las dudas de que haya cambiado desde entonces, pero acá no hay adivinanza: son ubicaciones y líneas concretas.

## 1. BUG CONFIRMADO: "Roles y Pateadores" no persiste bien

**Archivo:** `components/FormationModal.jsx`

**Causa raíz #1 — no autoguarda:**
`handleSetPieceChange` (línea ~299) solo hace `setSetPieces(prev => ({...}))`, sin disparar ningún guardado. Comparalo con la colocación de jugadores en la cancha (`onSlotClick`, línea ~442-449), que marca `pendingAutoSaveRef.current = true` y un `useEffect` sobre `lineup` (línea ~452-457) llama a `handleSaveLineup(lineup)` automáticamente. Elegir un capitán/pateador **no tiene ningún mecanismo equivalente**. Si el usuario entra a la pestaña "Pateadores", cambia algo, y sale sin tocar la cancha ni apretar "Guardar" manualmente, el cambio se pierde.

**Causa raíz #2 — no limpia ids huérfanos:**
`lineup` tiene un `SANITIZE` en el reducer (línea ~156-167) que saca jugadores que ya no están en el `cart`. `setPieces` **no tiene ningún mecanismo así**. Si un jugador que era capitán/pateador sale del 11 titular (lo sacás de la cancha, lo vendés, lo mandás al banco), su Id se queda guardado en Firestore en `setPieces.captain` (u otro rol) para siempre. El `<select>` de `RolesPanel` (línea ~97-112) solo lista `starterPlayers`, así que ese Id huérfano no aparece entre las opciones — el desplegable se ve vacío/en "(Por defecto / Automático)" aunque en Firestore siga guardado un valor viejo. Esto es probablemente lo que Santino percibe como "sigue el bug": el rol "se resetea solo" o "no respeta lo que elegí".

**Fix mínimo propuesto (confirmalo/ajustalo vos, no lo apliques a ciegas sin mirar el código actual):**
1. Agregar un `useEffect` sobre `setPieces` análogo al de `lineup`, que dispare `handleSaveLineup()` (o una función de guardado más liviana que solo toque `setPieces`) cuando cambie.
2. Agregar una limpieza (efecto o dentro de `SANITIZE`) que filtre `setPieces` contra los ids de `starterPlayers` vigentes, sacando cualquier rol cuyo playerId ya no esté en el 11 titular — así el dato en Firestore no queda huérfano y el `<select>` siempre refleja la realidad.

**Nota para no romper otra cosa:** `utils/pesExport.js` → `generateFormationCsv()` (línea ~192-211) ya resuelve bien el mapeo real hacia el formato PES: convierte el Id de `setPieces` al índice 0-10 dentro de `starters` (`getPlayerIndex`), que es lo que espera `Formation.csv` (confirmado contra un `Formation.csv` real de Portland Rovers: `Captain=9` referencia el slot 9 del 11 titular, no un Id de jugador). Esa parte **no tiene el bug** — no la toques, el problema está solo en `FormationModal.jsx` (captura y persistencia en la UI), no en la exportación.

## 2. FEATURE NUEVA: Editor de Estrategia de Ataque/Defensa

**Confirmado el hueco:** en `utils/pesExport.js`, `generateFormationCsv()` (línea ~187) tiene:
```js
const strategyChunk = "1;1;1;1;6;2;0;0;0;8;2;0;0;0;0;0;0;0;0;0;0;0;0";
```
Este string está **hardcodeado igual para los 12 equipos** — nadie puede tener su propia estrategia hoy. Corresponde a estos 12 valores en este orden (columnas reales de `Formation.csv`, confirmadas contra el archivo de Portland Rovers):

```
AttackingStylesS1;BuildUpS1;AttackingAreaS1;PositioningS1;SupportRangeS1;NumbersInAttackS1;
DefensiveStylesS1;ContainmentAreaS1;PressuringS1;DefensiveLineS1;CompactnessS1;NumbersInDefenseS1
```

**Alcance decidido: empezar solo con el preset S1** (el mismo que ya usa el export hoy). PES soporta 3 presets tácticos alternables en partido (S1/S2/S3), pero tripicar la UI y el trabajo de mapeo de enums para un beneficio marginal en una liga amateur no vale la pena todavía — dejalo como posible fase futura, no lo bloquees ni lo descartes de plano, pero no lo construyas ahora.

**Lo que falta para construir esto:**
- **UI**: nueva sección (¿pestaña "Estrategia" al lado de "Pateadores" en `FormationModal.jsx`, o en `AdminModal.jsx`? — proponé vos dónde tiene más sentido según cómo está armada la navegación hoy) con un `<select>` por cada uno de los 12 campos de arriba.
- **Modelo de datos**: agregar un objeto (ej. `team.tactics` o similar) al mismo `saveData` que ya arma `handleSaveLineup` en `FormationModal.jsx`, con las 12 claves. Definí un default razonable si no está seteado (podés usar los mismos valores del `strategyChunk` actual como default, así ningún equipo existente queda roto).
- **Conectar con el export**: en `generateFormationCsv()`, reemplazar el `strategyChunk` hardcodeado por los valores reales de `team.tactics` (con fallback al default si el equipo todavía no lo configuró), para no romper exports existentes.
- **HUECO DE DATOS QUE SIGUE ABIERTO — pedíselo a Santino directamente:** varios de estos 12 campos son *enums* con etiquetas (ej. `AttackingStylesS1=1` es "Possession Game" según la captura del editor que compartió), y otros son escalas numéricas directas (`SupportRangeS1=6`, `DefensiveLineS1=8`, `CompactnessS1=2` — estos van con un input numérico, no un `<select>` de opciones). No tenés la tabla completa de qué código numérico corresponde a qué etiqueta en cada enum (`AttackingStyles`, `BuildUp`, `AttackingArea`, `Positioning`, `NumbersInAttack`, `DefensiveStyles`, `ContainmentArea`, `Pressuring`, `NumbersInDefense`). Pedile a Santino que, desde el editor de PES que ya tiene abierto, te pase la lista completa de opciones de cada dropdown en el orden en que aparecen (la posición en la lista suele ser el código numérico, empezando en 0). Sin esto no se puede armar el `<select>` real — no inventes las etiquetas.

## Qué quiero que hagas

1. Confirmá vos mismo, mirando el código actual (puede haber cambiado desde este commit), que el diagnóstico del bug sigue siendo así.
2. Aplicá el fix de "Roles y Pateadores" (autoguardado + limpieza de huérfanos). Este sí lo podés implementar directo, es acotado y de bajo riesgo.
3. Para la Estrategia de Ataque/Defensa: armá la UI + modelo de datos + conexión al export **excepto los enums** (dejá placeholders o los valores numéricos crudos en los `<select>` mientras tanto), y pedile a Santino la tabla de equivalencias antes de poner las etiquetas en español definitivas.
4. Avisame si algo de lo que describí ya cambió en el código o no coincide con lo que encontrás vos.

## Restricciones del proyecto

- Español (Argentina, voseo) en todo lo de cara al manager.
- No toques `getPlayerIndex`/`generateFormationCsv` más que para conectar la estrategia real — esa parte del export ya funciona bien.
- No implementes los 3 presets (S2/S3) todavía, solo S1.
