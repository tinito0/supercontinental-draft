# Prompt para Antigravity — Auditoría UI + Rediseño estilo SofaScore

> Generado por Claude tras clonar y leer el código real de `tinito0/supercontinental-draft`
> (no es una auditoría genérica — cada hallazgo tiene archivo y línea).
> Pegar este documento completo en Antigravity como tarea.

---

## Contexto para el agente

`supercontinental-draft` es la app React 18 + Vite + Firebase de la SuperContinental League
(mercado de fichajes PES 2021 entre 12 managers). El objetivo es que la UI se sienta más
"SofaScore-like": densidad de datos alta pero legible de un vistazo, comparaciones visuales
(no solo numéricas), y una identidad de "app de resultados en vivo" más que de "spreadsheet
con estilo".

**No es un rediseño desde cero.** Gran parte de la base ya va en esa dirección (ver sección 1).
El trabajo es: parchear inconsistencias reales, sumar 2-3 patrones que faltan, y limpiar deuda
técnica que ya está en el repo. Priorizar patches quirúrgicos sobre reescrituras de componentes
enteros.

---

## 1. Lo que YA funciona estilo SofaScore (no tocar sin razón)

- **`components/TournamentModal.jsx` (tabla de posiciones, líneas ~679-730):** franjas de
  color en el borde izquierdo para zona de clasificación (top 4 verde, bottom 3 rojo),
  fila resaltada para el equipo del usuario, números tabulares. Esto es exactamente el
  patrón de tabla de SofaScore — no reinventar.
- **`MatchCenter` dentro de `TournamentModal.jsx` (líneas ~182-300):** fixtures agrupados
  por jornada, escudo + nombre + marcador, pill de estado ("Finalizado"/"Próximo"). También
  correcto, mantenerlo como base.
- **`components/PlayerListItem.jsx`:** pills de stats con banda de color (cian/verde/amarillo/
  naranja/rojo según valor) — es el mismo lenguaje visual que SofaScore usa para ratings de
  jugador. Mantener la paleta tal cual está en `index.css` (`.stat-c-90` a `.stat-c-50`).
- **`components/ComparisonModal.jsx`:** radar superpuesto + header de duelo con foto/OVR/posición
  de ambos jugadores. Estructura correcta, ver punto 2.1 para lo que le falta.

---

## 2. Gaps concretos (con evidencia)

### 2.1 — Comparador: pills numéricos sin barra de magnitud
`components/ComparisonModal.jsx`, componente `StatBarRow` (líneas 80-116).

Hoy cada stat se muestra como dos pills de color con el número, sin ningún elemento visual
que codifique la magnitud. El usuario tiene que **leer y comparar** los dos números. El patrón
SofaScore es al revés: una barra horizontal cuya longitud ya te dice quién gana antes de leer
el número — el número es un detalle secundario, no el vehículo principal de la comparación.

**Tarea:** rediseñar `StatBarRow` para que cada valor se represente también como barra
horizontal (ancho proporcional al valor, 0-100), con las dos barras creciendo desde el centro
hacia afuera (jugador A hacia la izquierda, jugador B hacia la derecha) o apiladas con el
número al costado. Mantener el color-band existente (`getStatAndOvrColorClass`) para el
relleno de la barra. No tocar el radar, el header del duelo, ni la sección de habilidades.

### 2.2 — Sistema de theming a medias: los tokens existen pero casi nadie los usa
`index.css` (líneas 20-40) define un sistema completo de theming con custom properties
(`--app-bg`, `--app-surface`, `--app-surface-elevated`, `--app-border`, `--app-accent`,
`--app-text-primary`, etc.) para `:root` (claro) y `.dark` (oscuro). `hooks/useTheme.js`
implementa un toggle funcional con persistencia en `localStorage` y sincronización entre tabs.
`components/TopHeader.jsx` sí lo usa (`bg-white dark:bg-[#06080d]`, con toggle de sol/luna
visible).

El problema: **24 de los ~30 archivos en `components/` y `screens/` ignoran ese sistema** y
hardcodean colores oscuros directo en el className (`bg-[#111722]`, `bg-[#0c1017]`, etc. —
verificado con grep, lista completa: AdminModal, CartModal, ComparisonModal, FiltrosModal,
FormationModal, InstallPopup, LeftSidebar, ManagerChat, NotificationsPanel, Pitch, PlayerCard,
PlayerListItem, PlayerModal, RecommendationsAccordion, ScoutAssignmentsPanel, SearchBar,
TeamsModal, TournamentModal, TournamentUI, TransferFeed, TransferPlayerCard,
TransferProposalModal, FormationViewScreen, LinkGoogleScreen, LoginScreen). Ninguno usa
`var(--app-*)`.

**Consecuencia real:** el toggle de tema en el header cambia el fondo del header y poco más —
todos los modales de alto tráfico (mercado, comparador, carrito, formación) se quedan oscuros
sin importar lo que el usuario elija. El feature de light mode existe en el código pero no
funciona para el usuario.

**Tarea (decisión a tomar primero, no asumir):**
- Opción A — Si el proyecto quiere mantener dark-first de verdad (razonable para una app de
  streaming/gaming), eliminar el toggle de `TopHeader.jsx` y los tokens `:root` claros de
  `index.css`, y formalizar que la app es dark-only. Menos trabajo, consistente con lo que
  ya se ve en el 90% del código.
- Opción B — Si se quiere light mode real, migrar los 24 archivos a usar `var(--app-surface)`,
  `var(--app-border)`, etc. (o el par `dark:` de Tailwind ya usado en TopHeader) en vez de hex
  hardcodeado. Es upgrade grande — hacerlo por lotes (empezar por los modales más usados:
  PlayerListItem, ComparisonModal, CartModal) y no en un solo commit gigante.

No elegir por Santino — preguntarle cuál de las dos opciones prefiere antes de tocar esto,
ya que es una decisión de producto, no solo de código.

### 2.2b — Ni siquiera dentro del modo oscuro hay UN fondo consistente
Esto es más grave que 2.2: no es solo que los componentes ignoren los tokens de tema, es que
**cada archivo inventó su propio negro** en vez de reutilizar los dos que ya define
`index.css` (`--app-surface: #0c1017`, `--app-surface-elevated: #111722`). Evidencia:

- El shell principal autenticado (`app.jsx` línea 2187) usa `bg-slate-50 dark:bg-[#06080d]`
  — coincide con `--app-bg`.
- La pantalla de Torneo (`app.jsx`, líneas 1926, 1954, 1982, 2008, 2171) usa `bg-[#0a0a0a]`
  a secas — sin variante clara, y es un negro distinto al del shell principal.
- `components/TournamentUI.jsx` (líneas 17-18, `tournamentShellClass` /
  `tournamentBackdropClass`) define encima un tercer negro, `dark:bg-[#020617]`, que se
  monta sobre el `#0a0a0a` anterior.
- Paneles y modales de uso frecuente usan cada uno el suyo, todos distintos entre sí y de
  los dos tokens oficiales: `FormationModal.jsx` → `#080c14`; `FiltrosModal.jsx` → `#09131f`;
  `TeamsModal.jsx` → `#090d16` y `#161f2e`; `PlayerModal.jsx` → `#0a0e16`;
  `TransferFeed.jsx` / `TransferPlayerCard.jsx` → `#0f141f`; `InstallPopup.jsx` /
  `screens/LinkGoogleScreen.jsx` → `#0f172a` / `#0a1628` (estos dos ni siquiera son de la
  familia neutra — tiran a azul).

**Consecuencia visual real:** paneles anidados no calzan entre sí ni con el fondo de la
página — se nota como "cosido" en vez de una superficie continua, que es justo lo opuesto
al look limpio de SofaScore.

**Tarea:** independientemente de qué se decida en 2.2 (Opción A o B), consolidar TODOS los
fondos oscuros hardcodeados a máximo 3 valores: fondo de página (`#06080d`), superficie
(`#0c1017`), superficie elevada (`#111722`) — los mismos que ya están en `--app-app-bg` /
`--app-surface` / `--app-surface-elevated`. Ningún componente nuevo debería introducir un
hex de fondo propio; si hace falta un cuarto nivel, agregarlo a `index.css` como token, no
como hex suelto en el componente.

### 2.3 — No hay una vista "de un vistazo" (home/overview)
Los tabs de navegación en `app.jsx` (~línea 2217 en adelante) son: `Marketplace`, `Torneo`,
`My Team`, `Scouting`, `Other Teams`, `Financials`, `Admin`. No hay un tab tipo "Inicio" que
muestre de entrada: próximo partido del equipo del usuario, posición actual en la tabla,
presupuesto restante, últimos fichajes propios. Es el patrón central de SofaScore (la home
es siempre "esto es lo que te importa ahora mismo", no un submenú).

**Tarea:** evaluar con Santino si vale la pena un tab/pantalla "Resumen" que combine datos que
YA existen en otros tabs (próximo partido de `MatchCenter`, fila del equipo en la tabla de
`TournamentModal`, `remainingBudget` que ya calcula `TopHeader.jsx`) en una sola vista de
lectura rápida. No es prioridad si el uso real de la app es mayormente mercado de fichajes
— confirmar antes de invertir tiempo acá.

### 2.4 — Limpieza: archivos duplicados sin usar en el repo
`components/PlayerCard - copia.jsx` y `components/PlayerModal - copia.jsx` existen en el
repo (verificado: ningún archivo los importa — son código muerto, probablemente backups
manuales que quedaron commiteados). Los espacios en el nombre de archivo también son un
problema de higiene aparte de ser dead code.

**Tarea:** confirmar con Santino que no se usan y borrarlos. Es un cambio de 30 segundos que
no debería esperar a lo demás.

### 2.5 — Sin sistema de z-index: hay un bug real de visibilidad, no solo desorden
No existe una escala de z-index definida en ningún lado — son valores arbitrarios puestos
archivo por archivo: `z-10`, `z-20`, `z-30`, `z-40`, `z-50`, y luego arbitrarios `z-[60]`,
`z-[70]`, `z-[80]`, `z-[100]`, `z-[110]`, `z-[200]` repartidos sin criterio visible entre
componentes que no se conocen entre sí.

Esto no es solo estética — hay un riesgo concreto de bug de visibilidad:
- El stack de notificaciones toast (`app.jsx` línea 2845) vive en `z-[80]`.
- Pero varios modales de acción están en `z-[100]`: el confirm de borrado de
  `AdminModal.jsx` (línea 1238), `InstallPopup.jsx` (línea 8),
  `TransferProposalModal.jsx` (línea 90), y una vista interna de `PlayerModal.jsx`
  (línea 655).
- Si un toast se dispara mientras cualquiera de esos modales está abierto, **el toast queda
  tapado por el modal** en vez de mostrarse encima — el usuario nunca lo ve.
- Aparte, `PlayerModal.jsx` (línea 248) tiene un lightbox interno en `z-[200]`, más alto que
  absolutamente todo lo demás en la app, incluido el `z-[110]` de `AdminModal.jsx`. Puede ser
  intencional (una foto a pantalla completa debería ganar siempre), pero no hay ningún
  comentario ni constante que lo documente — es frágil ante el próximo componente que alguien
  agregue con un z-index "grande para asegurarse".

**Tarea:** definir una escala fija de z-index (ej. `dropdown: 20`, `modal: 50`, `modal-nested:
60`, `toast: 70`, `lightbox: 90`) como constantes en `utils/constants.js`, y migrar los
`z-[N]` arbitrarios a esa escala. Prioridad real: al menos mover el toast de `app.jsx:2845`
por encima de todos los modales de `z-[100]`, porque hoy hay notificaciones que el usuario
puede no estar viendo nunca.

### 2.6 — Sin componente Button compartido y con 3-4 "azules primarios" distintos
No existe ningún `Button.jsx` ni equivalente — cada modal reimplementa sus botones con
className largas copiadas y ligeramente distintas. Consecuencia medible: el color que se usa
como "acento/acción primaria" no es uno solo, son al menos cuatro compitiendo en distintos
archivos — `cyan-500`/`cyan-400` (38 y 35 usos), `sky-500`/`sky-600` (26 y 15 usos),
`blue-500`/`blue-600` (16 y 7 usos), y el hex custom `#00b4d8` que ya vimos en 2.2b como
"el" acento oficial de marca. No hay forma de saber, mirando el código, cuál de los cuatro es
el correcto — probablemente lo sea `#00b4d8` (aparece en el logo del header y en
`TopHeader.jsx`), y el resto sea deriva de distintos momentos de desarrollo.

**Tarea:** declarar `#00b4d8` como único acento primario (agregarlo como color de Tailwind en
`tailwind.config.js`, ej. `brand.accent`, en vez de repetir el hex), y al menos en los
botones de acción principal (Fichar, Vender, Confirmar) migrar a un solo color. No hace falta
un componente `Button.jsx` completo en esta pasada si no hay tiempo — pero si se toca 2.1 o
2.2b igual, aprovechar para unificar el acento en los archivos que ya se están tocando.

### 2.7 — El término oficial "FICHAR" no existe en la UI real
El reglamento (`SUPERCONTINENTAL LEAGUE TEMPORADA 2`) y la guía de voz de marca definen
"FICHAR" (mayúsculas) como término obligatorio para la acción de compra: *"Se pulsa la acción
'FICHAR'"*. Buscando en todo el código vivo, el botón de compra real en `PlayerModal.jsx`
(líneas 636 y 643) dice **"Fichar"** (capitalización normal, no mayúsculas) — y la única
aparición de "FICHAR" en mayúsculas de todo el repo está en `PlayerModal - copia.jsx`, el
archivo muerto que ya se marcó para borrar en 2.4. El término oficial se perdió en algún
refactor y hoy no está en ningún lugar que el usuario vea.

**Tarea:** cambiar el texto del botón en `PlayerModal.jsx` (líneas 636, 643) de "Fichar" a
"FICHAR", consistente con el reglamento y la guía de voz. Cambio de una línea, cero riesgo,
pero corrige una inconsistencia de marca real y documentada en el propio proyecto.

### Antes de seguir: lo mobile SÍ está contemplado, en parte
Revisé esto puntualmente porque se pidió. La app no está descuidada en mobile — hay trabajo
real: viewport meta correcto, un estado `isMobileViewport` en `app.jsx` que maneja tamaño de
página (24 vs 64 items), columnas de grilla y layout en varios puntos del archivo (no es solo
CSS responsive, hay lógica dedicada); los modales usan `h-[100dvh]` en vez de `100vh` (correcto
para navegadores móviles con chrome dinámico); en mobile la lista de jugadores usa paginación
manual + scroll infinito en vez de `VirtualizedPlayers.jsx`, que sí se usa en desktop — es una
decisión razonable, no un bug, dado que las libs de virtualización suelen dar problemas dentro
de contenedores de scroll móviles; y `safe-area-inset-bottom` está aplicado donde realmente
hace falta (la barra de acción de `FiltrosModal.jsx`, `TutorialModal.jsx`,
`ScoutAssignmentsPanel.jsx`, `TransferFeed.jsx`) — no encontré ninguna barra fija al fondo sin
cubrir. Esto no necesita trabajo.

Dicho eso, sí hay tres problemas reales de interacción táctil:

### 2.8 — El componente más usado en mobile (lista de jugadores) no tiene feedback al tocar
`components/PlayerListItem.jsx` — toda la retroalimentación visual de la fila (el
levantamiento sutil, el resaltado de borde, el brillo degradado, el nombre cambiando a color
de acento) está condicionada solo a `hover:` / `group-hover:`, sin ningún `active:`. En touch,
`:hover` no dispara de forma confiable (o queda "pegado" después de tocar, según el navegador)
— en la práctica, tocar una fila en el celular no muestra ninguna señal de "esto se está
presionando" hasta que el modal del jugador efectivamente abre. Mismo patrón en
`LeftSidebar.jsx`, `NotificationsPanel.jsx`, `Pitch.jsx`, `PlayerModal.jsx` y
`TopHeader.jsx` (33 usos de `group-hover` en total, sin ningún `active:` de contraparte en
esos 6 archivos).

**Tarea:** en `PlayerListItem.jsx` como mínimo (es la vista más repetida en mobile), agregar
`active:scale-[0.98]` o `active:bg-[#111722]` al contenedor de la fila para que el toque tenga
respuesta inmediata. Replicar el mismo criterio en los otros 5 archivos si se toca ese código
por otro motivo, pero no es necesario abrir los seis solo por esto en la misma pasada.

### 2.9 — Botones de la lista de jugadores por debajo del tamaño táctil mínimo
Mismo archivo, botones de favorito y comparar (líneas 45-52 y 122-128):
- Botón de estrella (favorito): `p-1.5` + ícono `w-5 h-5` (20px) → **~32×32px** de área
  tocable real.
- Botón de comparar: `p-2.5` + ícono `size={16}` → **~36×36px**.

Los dos quedan por debajo de los 44×44px que recomienda Apple HIG (y los 48dp de Material) —
justo en la fila que se repite decenas de veces por pantalla y donde el usuario toca rápido
mientras scrollea. Como además toda la fila tiene su propio `onClick` para abrir el modal del
jugador, un toque que erra por poco el botón de estrella o comparar termina abriendo el
jugador en su lugar — no es solo un problema de tamaño, genera clics equivocados.

**Tarea:** subir el padding de ambos botones para acercarse a 44×44px reales (ej. estrella de
`p-1.5` a `p-2.5`, comparar de `p-2.5` a `p-3`), o agregar una zona de toque invisible más
grande con `::before`/padding extra sin cambiar el ícono visual si el espacio en la fila es
ajustado.

### 2.10 — Inputs con texto chico que pueden disparar auto-zoom en iOS
Safari en iOS hace zoom automático al foco si el `font-size` del input es menor a 16px.
Encontré 15 `<input>`/`<select>` en el repo con `text-xs` (12px) o `text-sm` (14px). La mayoría
están en `AdminModal.jsx` y en la edición de la tabla de `TournamentModal.jsx` (contextos de
administración, probablemente usados más desde desktop/laptop para cargar resultados). El que
sí importa para el flujo mobile normal de cualquier manager es el `<select>` de orden en
`components/SearchBar.jsx` (línea 237) — está en el uso más común de la app en celular
(buscar/ordenar el mercado).

**Tarea:** subir el `<select>` de `SearchBar.jsx` a `text-base` (16px) mínimo en mobile. No es
necesario tocar los inputs de `AdminModal`/`TournamentModal` en esta pasada salvo que se
confirme que también se usan mucho desde el celular durante los partidos.

---

## 3. Principios SofaScore a aplicar en trabajo futuro (no todo entra en esta tarea)

Para cualquier componente nuevo o rediseño futuro, mantener estos criterios:
- **La magnitud se ve antes de leerse:** barras, longitudes, franjas de color — no solo
  números y texto (ver 2.1).
- **Color con significado consistente:** el sistema de bandas que ya existe en `index.css`
  (`.stat-c-*`) es la fuente de verdad para "bueno/regular/malo" — no introducir una paleta
  de color nueva para lo mismo en un componente distinto.
- **Densidad sin ruido:** SofaScore mete mucha info por pantalla pero cada elemento tiene
  jerarquía tipográfica clara (número grande y bold, label chico y mudo). El patrón de
  `StatItem` en `PlayerListItem.jsx` (líneas 14-23) ya sigue esto — replicarlo, no inventar
  uno nuevo por componente.
- **Estados en vivo/próximos siempre visibles primero:** en cualquier lista de partidos o
  eventos, lo "próximo" o "en curso" va arriba, lo finalizado abajo — como ya hace
  `MatchCenter` al ordenar por `status === 'completed'`.

---

## 4. Orden sugerido de trabajo

1. **2.4 (limpieza de archivos muertos) + 2.7 (FICHAR mayúsculas) + 2.10 (select de
   SearchBar a 16px)** — triviales, cero riesgo, hacerlos juntos ya como primer commit.
2. **2.5 (z-index del toast) + 2.9 (touch targets de estrella/comparar)** — son los dos bugs
   reales de esta lista (notificaciones tapadas, clics equivocados por botones chicos en la
   vista mobile más usada). Priorizar por encima de lo puramente visual.
3. **2.8 (feedback táctil en PlayerListItem)** — rápido, mismo archivo que 2.9, conviene
   resolverlos juntos ya que se está tocando el componente.
4. **2.1 (barras en el comparador)** — mayor impacto visual por menor esfuerzo, componente
   acotado (`StatBarRow`), no afecta otros archivos.
5. **2.2b (consolidar los negros hardcodeados a 3 tokens)** — no depende de la decisión de
   2.2, se puede hacer ya.
6. **2.6 (unificar el azul de acento)** — aprovechar los archivos que ya se tocan en 2.1/2.2b
   para migrar su acento a `#00b4d8`; no ir archivo por archivo solo por esto.
7. **2.2 (theming claro/oscuro)** — requiere que Santino elija Opción A o B antes de
   arrancar. Si es Opción A (dark-only), es rápido y se apoya directamente en el trabajo de
   2.2b. Si es Opción B, hacerlo por lotes y avisar entre lotes.
8. **2.3 (vista de inicio)** — solo si Santino confirma que aporta valor real de uso; no
   asumir.

No mezclar 2.1, 2.2b y 2.2 en el mismo commit/PR — son cambios independientes, y 2.2
depende de una decisión de producto que puede tardar en confirmarse. El resto (2.4, 2.5,
2.6, 2.7, 2.8, 2.9, 2.10) puede viajar junto con cualquiera de los otros sin problema, son
de bajo riesgo y en varios casos comparten archivo.
