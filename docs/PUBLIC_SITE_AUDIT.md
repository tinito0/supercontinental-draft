# Audit de diseño: sitio público de la liga

Fecha: 2026-10-23. Alcance: la web pública en `/` (no el draft ni OBS).

**Cómo se midió**
- **Herramientas:**
  - axe-core con las reglas WCAG 2.1 A/AA;
  - un recorrido propio con Playwright y Chrome que mide tamaño de toque, texto chico, scroll horizontal y contraste de los tokens;
  - revisión a mano contra `docs/DESIGN_SYSTEM.md` y las Web Interface Guidelines.
- **Anchos:** 390 px (celular) y 1440 px (escritorio).
- **Datos:** sintéticos, en el arnés de QA: partidos en vivo, copas en curso y clubes con ficha cargada.
- **Límites:** no hubo prueba con lector de pantalla real ni en Safari o Firefox.

## Resumen

| | Resultado |
|---|---|
| Violaciones axe (11 páginas × 2 anchos) | **0** |
| Scroll horizontal | Ninguno |
| Contraste del texto | Todos los tonos de texto superan 4.5:1 (el más tenue, 10.2:1) |
| Objetivos de toque | Menú y logo subidos a 44 px. Las pestañas miden 44 px en pantallas táctiles y 32 px con mouse, a propósito |
| Texto menor a 12 px | Corregido en las llaves de las copas y en la posición del jugador. Queda la inicial del escudo de reemplazo (ver Pendiente) |

## Contraste de los tokens

Sobre el panel (`--c-surface` 14 19 32) y la superficie elevada (`--c-raised` 21 27 43):

| Token | Uso | Panel | Elevada |
|---|---|---|---|
| `ink` | Texto principal | 16.9:1 | 15.7:1 |
| `ink-2` | Texto secundario | 15.1:1 | 13.9:1 |
| `ink-3` | Texto terciario | 11.0:1 | 10.2:1 |
| `accent-soft` | Links, íconos | 8.6:1 | 8.0:1 |
| `accent` | Solo rellenos y bordes, nunca texto chico | 3.4:1 | 3.2:1 |
| `success-soft` | Ganador, «en vivo» | 10.6:1 | 9.9:1 |

El pedido de «textos grises difíciles de leer» queda resuelto: en `.landing-root` los tokens `ink-2` e `ink-3` están casi blancos.

## Hallazgos por página

| Página | Estado | Qué se cambió en esta pasada |
|---|---|---|
| **Inicio** `/` | OK | Partido destacado junto al título. Franja de etapa («Fase suiza · Fecha 3 de 4»). Tabla con zonas Oro/Plata (barra de acento + texto para lectores). Centro de partidos sin banda decorativa |
| **Partidos** `/partidos` | OK | Cada fecha es un título grande. Cada partido dice de qué fecha o ronda es. Penales al lado del marcador («1 (5)») y línea «Ganó X por penales 5-4» |
| **Partido** `/partidos/:id` | OK | Minifaces con dorsal en la formación, pelota para los goles, cuerpo técnico. Sin el panel «De dónde sale cada dato» |
| **En vivo** `/en-vivo` | OK | Resultado final, MVP ganador y cómo terminó la predicción. El admin puede cerrar el MVP o reiniciar votos |
| **Torneo** `/torneo` | Corregido | La final de las copas pasó del ámbar al azul del acento. Las pills «FIN/PEND» ahora son texto («Final», «Por jugar»). Etiquetas de ronda a 12 px |
| **Equipos** `/equipos` | OK | Vuelto a las filas horizontales originales, con estadio y mánager si están cargados |
| **Club** `/equipos/:id` | OK | Cabecera con foto del estadio, ficha en un panel, pestañas El club / Palmarés / Plantel, palmarés en columnas, campañas en tabla (tarjetas en celular) |
| **Historia, Reglamento** | OK | Sin cambios de estructura. Texto en `ink` y medida de lectura de 68 caracteres |
| **Navegación** | Corregido | Links del menú y logo a 44 px de alto. Subrayado del activo reubicado. Enlace «Saltar al contenido» |

## Reglas del sistema de diseño

| Regla | Estado |
|---|---|
| Azul del escudo como único acento | Cumple (se quitó el ámbar de la Copa de Oro y de la final) |
| Sin pills de metadatos | Cumple en el sitio público |
| Sin sombras en escudos, sin degradés ni brillos decorativos | Cumple (se quitó el brillo de la final) |
| Sin tarjetas dentro de tarjetas | Cumple |
| Métricas como `<Stat>` | Cumple en el inicio |
| Mobile first a 360 px, toques de 44 px | Cumple. Las pestañas llegan a 44 px solo con puntero táctil (`pointer: coarse`) |
| Movimiento | Solo fundidos cortos. Respeta `prefers-reduced-motion` sin anular todas las animaciones |

## Pendiente (menor)

- **Escudo de reemplazo:** cuando un escudo no carga, se muestra la inicial del club a 10 px en un círculo de 24 px. Es decorativa, porque el nombre está al lado, pero podría ser un ícono.
- **Llaves en el admin:** las de la app de administración comparten `MatchCard` con el sitio público. Mejoraron con este cambio y no tienen revisión propia.
- **Historias de los clubes:** quedan pendientes (`Propuestas/*.docx`). Están todas en el mismo formato (ficha, épocas, palmarés, SCL, presente, lema), así que la página puede leer ese formato directamente.
