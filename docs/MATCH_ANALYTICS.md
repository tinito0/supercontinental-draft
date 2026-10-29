# Análisis de partidos (`/partidos/:matchKey`)

Qué muestra la página de cada partido, de dónde sale cada número y qué no se puede mostrar. La cadena de datos es
la de [MATCH_FEED.md](MATCH_FEED.md): probe de Sider → bridge local → función `match-feed` → `live_matches`. La
evidencia de cada dato del juego está en [PES_MATCH_DATA_RESEARCH.md](PES_MATCH_DATA_RESEARCH.md) (filas S1–S14).

**Regla:** un dato que no se midió no aparece, o aparece como «—» / «No disponible». Nunca se completa con un 0
ni con una estimación sin decirlo.

## Piezas

| Capa | Archivo | Qué hace |
|---|---|---|
| Probe (juego) | `pes-collector/sider/scl_probe.lua` (v5) | Estadísticas por jugador cada 2 s, XI, eventos, la formación (`formation`, v4) y las posiciones (`pos`, v5) |
| Colector | `pes-collector/collector/matchSummary.js`, `matchActions.js`, `formations.js`, `pitchData.js`, `statKinds.js` | Resumen `scl.match/1`: los campos nuevos son opcionales |
| Bridge | `pes-collector/bridge/nameIndex.js`, `teamPlans.js` | Nombres, posición registrada, plan guardado (solo si coincide con el XI) |
| Página | `utils/matchStats.js`, `utils/matchAnalysis.js`, `components/league/match/*`, `screens/league/LeagueMatchScreen.jsx` | Seis pestañas |

Campos agregados al resumen (todos opcionales; los partidos viejos no los tienen y la página lo dice):
`shots` (desde v5 con `x`, `y`, `xg`), `series`, `buckets`, `formations`, `teamPlans`, `possession`, `xg`, `ratings`, `heatmaps`, `names.positions`, y en `teamStats` los tipos de pase,
duelos, despejes, gambetas, toques y penales en juego.

## Fuente de cada dato

| Dato | Fuente | Cómo |
|---|---|---|
| Marcador, goles, asistencias, tarjetas, cambios | Del juego | Eventos y contadores en vivo (L1–L3, S1–S7) |
| Estadísticas de equipo y jugador | Del juego | Contadores por jugador; las de equipo son la suma |
| Tipos de pase | Del juego | Contadores 24–31; corto + filtrado + largo + centro = pases en todos los partidos grabados (S10) |
| Lista de tiros | Calculado | Por cada subida del contador de tiros de un jugador: al arco y gol si subieron en la misma muestra (S10). Concilia con los totales y con el marcador |
| Tramos de 15 minutos | Del juego | Los contadores ya vienen por tramo (S8); el tiempo agregado cae en el último tramo |
| Serie por minuto | Calculado | Subidas de cada contador con el reloj de la muestra (cada 2 s) |
| Dominio | **Modelo** | Ver abajo |
| Minutos jugados | Calculado | Inicio o entrada → final, salida o roja |
| Formación del saque inicial y sus cambios | Del juego (probe v4) | `ctx.mis`, plan y orden de cada equipo (S12–S13) |
| Formación de partidos grabados antes de v4 | Del archivo de guardado | Solo si el plan guardado coincide puesto por puesto con el XI inicial (S11); si no, no se dibuja |
| Dorsales, estrategia, instrucciones | Del archivo de guardado | Solo si el plan coincide con el XI |
| Posición registrada | Base de datos / guardado | Atributo del jugador, no el puesto que jugó |
| Posesión | Calculado (del juego) | Dos contadores de tiempo con la pelota (S9): local = trunc(local / total × 100), visitante = 100 − local. Coincidió con la pantalla en 3 de 4 controles (1 punto de diferencia en el otro). Algunos partidos dejan los contadores en 0: entonces no se muestra. Sin la tanda de penales |
| Valoraciones | Del juego | Estadística 179, primer valor como float (S15). Coincidió con la pantalla final (Raya 7,0, Saliba 6,0) |
| Posiciones | Del juego (probe v5) | Foto de las 22 posiciones que el juego refresca de a un equipo, cada jugador cada 2–3 s (S15). No es un recorrido |
| Mapas de calor | Del juego | Grilla 21 × 14 de las posiciones refrescadas, por jugador y por equipo, siempre atacando hacia la derecha |
| Posición de cada tiro | Calculado | Última posición refrescada del pateador antes de la muestra que contó el tiro (hasta 2 s tarde): unos metros de error |
| xG | **Modelo** | Ver abajo |
| Distancia recorrida, sprints, PPDA, bloque defensivo | No disponible | Hace falta la posición en cada cuadro, no cada 2–3 s |

## Cálculos

- **Porcentajes:** `round(hechos / intentos × 100)`, entero. Sin intentos no hay porcentaje («—»).
- **Tiros desviados o bloqueados:** tiros − tiros al arco. El juego no separa desviados de bloqueados.
- **Goles de tiro:** goles de jugadores del equipo (contador 0); los goles en contra del rival suman al marcador
  pero no a la conversión. **Conversión** = goles de tiro / tiros. **Precisión de tiro** = al arco / tiros.
- **Posesión:** el último par de contadores antes de la tanda de penales (durante la tanda siguen corriendo). Con
  probe v4 cada evento trae también el tiempo de juego (`+0x7B518`), y el par se descarta si no suma ese tiempo.
- **Duelos ganados:** entradas ganadas (50) / duelos disputados (49), la fila «Duelos X (Y)» del juego.
- **Tiempos de las acciones:** sin alargue, el tiempo 3 que aparece cerca del 90' es descuento del segundo; un
  penal en juego informa el tiempo 5 y se ubica por el minuto. Si el probe encontró las estadísticas tarde, lo
  acumulado hasta ese momento no tiene minuto: la serie empieza ahí y esos tiros muestran «—».

## Dominio (modelo)

No lo da el juego. Para cada minuto:

```
acciones(lado) = 1·tiros + 1·tiros al arco + 0,5·córners + 0,5·centros + 0,5·pases filtrados
dominio(m)     = acciones(local) − acciones(visitante) + 0,5 · dominio(m − 1)     (vuelve a 0 en cada tiempo)
```

Positivo = domina el local. Un tiro al arco suma 2 (tiro + al arco). Los pesos se eligieron a mano y no están
calibrados contra nada; la página lo dice. Partidos sin serie por minuto no muestran el gráfico.

## xG (modelo)

No lo da el juego. Por tiro, con la posición aproximada del pateador (x hacia el arco rival, en metros):

```
distancia = metros hasta el centro del arco; ángulo = ángulo que abarcan los dos palos (radianes)
xG        = 1 / (1 + e^-(−1,1 + 1,4·ángulo − 0,075·distancia))      penal: 0,76 fijo
```

Da ~0,53 desde el área chica, ~0,26 desde el punto penal y ~0,07 desde 25 m. Coeficientes elegidos a mano para
parecerse a los modelos públicos de distancia y ángulo; no están ajustados con tiros de PES, y el juego no da la
parte del cuerpo, el tipo de pase previo ni los defensores. El xG del equipo es la suma de sus tiros, y queda «—»
si algún tiro no tiene posición (una suma parcial se leería como total).

## Cancha (coordenadas)

Las posiciones son las del plan de juego (no dónde estaba cada jugador): profundidad 3 (arco propio) … 48,
lateral 8 (izquierda del equipo) … 92 (derecha). Comprobado en vivo: mover un DC a la izquierda baja el lateral
(S13). Dibujo horizontal (local ataca a la derecha): local `x = profundidad`, `y = lateral`; visitante
`x = 100 − profundidad`, `y = 100 − lateral`. En el teléfono la cancha es vertical (local abajo). El dibujo deja
un margen de 6 % para que el arquero y los laterales no queden cortados.

## Compatibilidad

- El esquema sigue siendo `scl.match/1`: la función `match-feed` acepta los resúmenes nuevos sin redesplegar.
- El bridge no vuelve a subir partidos ya guardados (`savedMatches` los deja como están): una nueva subida movería
  `updatedAt` y reabriría la votación del MVP. **Excepción:** la primera vez que el bridge actualizado lee la
  grabación más nueva, sus partidos se suben otra vez con los campos nuevos (una vez).
- Para que los planes guardados se usen, `editFile` en `%APPDATA%\scl-bridge\config.json` tiene que apuntar al
  guardado que usa el juego (`Documents\KONAMI\eFootball PES 2021 SEASON UPDATE\<id>\save\EDIT00000000`); la copia
  de `vendor/` es vieja.

## Pendiente de validar en el juego

- Probe v4 (`formation`, `time` en `possession`) no se instaló ni se probó en un partido: copiar `scl_probe.lua` a `modules\` y jugar
  uno. Ver la lista de la sección «Formation in the probe» del doc de investigación.
- Cambio de jugador durante el juego (si `ctx.mis` lo refleja como las team tables), lado visitante editado, Copa
  Konami, segundo equipo.
