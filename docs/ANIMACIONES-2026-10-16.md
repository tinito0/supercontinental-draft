# Animaciones y microinteracciones — auditoría (16/10/2026)

## Contexto

Pediste evaluar si las animaciones mejorarían Supercontinental Draft, sin implementar nada antes de aprobar.

**Cómo se hizo**
- Leí el código real: `index.css`, `landing.css`, `tailwind.config.js`, `docs/DESIGN_SYSTEM.md`, `BaseModal`, `StatusAlert`, los toasts de fichaje en `app.jsx`, `Pitch`, `FormationModal`, `CartModal`, `TeamsModal` (Rivales), `marketplace/*`, `PlayerCard`/`PlayerListItem`, `PlayerModal`, `TransferFeed`, `LeftSidebar` y `Button`.
- Contrasté las recomendaciones con la skill `modern-web-guidance`, usando las guías `motion`, `animate-element-entry-exit` y `persistent-toast-notifications`.
- No abrí el navegador ni medí rendimiento: lo marcado **CONFIRMADO** se leyó en el código.

**Sesiones en paralelo**
- programa-super2-12 está editando `FormationModal`, `Pitch`, `CartModal`, `TeamsModal` y `useBudget`.
- programa-super2-28 rehízo el mercado: `components/marketplace/`, tarjetas y CSS.
- Antes de tocar esos archivos hay que avisarles.

## Estado (16/10/2026)

**Fase 1 hecha.** Sin commitear, pero **desplegada en producción** el 16/10/2026 (`firebase deploy`: hosting y reglas):
- antes del deploy pasaron `npm test` (584/584), `npm run test:rules` (62/62) y `npm run build`;
- se verificó que el sitio en producción sirve el bundle nuevo y el HTML con `no-cache`.
- **Tokens:** `--dur-*` y `--ease-*` en `index.css`, mapeados en `tailwind.config.js`. Las duraciones sueltas de
  `index.css` pasaron a tokens (P10, salvo la barra lateral de escritorio, que queda para la fase 2).
- **Movimiento reducido por animación** con `--animation-reduced` (P11): las entradas y salidas quedan en fundido y
  los spinners giran lento.
- **Pila única de avisos** (`components/ToastStack.jsx`) con entrada y salida (ítem 1, P3, P4):
  - `hooks/usePresence.js` y `utils/motion.js` (`waitForExit`, `mergeWithLeaving`);
  - `StatusAlert` pasa a tonos -700 para el contraste del texto blanco.
- **Pizarra:**
  - centrado con la propiedad `translate`, así funcionan `scale-90` y `hover:scale-110` (ítem 2, P1);
  - transición limitada a `left`, `top`, `transform` y `opacity`;
  - sin transición mientras se mueve con flechas (ítem 3, P7).
- **Festejo de fichaje** (ítem 5, P2): el confeti se arma una sola vez y los keyframes pasan a `index.css`. Sin
  confeti con movimiento reducido, y brillo fijo.
- **Fichar** (ítem 4):
  - se ignora un segundo toque mientras hay un fichaje en curso;
  - `finally` para que el botón no quede en "Procesando…" si algo falla.
- **Presupuesto del encabezado:** destella una vez cuando cambia, sin contar los primeros 2 s de carga. La barrita
  se desliza.
- **Limpieza:** se sacaron los `duration-*` inútiles junto a `animate-in` (P5) y el CSS muerto (P6, incluida
  `animate-pulse-slow`).
- **Docs:** sección Motion en `docs/DESIGN_SYSTEM.md`.

**Pendiente:** fases 2 a 4 (salida de modales, barra lateral, desplegables, acordeones, tarjeta de oferta,
`TransferFeed`, comparador, pantallas de carga). Sin verificar en el navegador: no se hizo la revisión visual con el
arnés.

## A. Lo que hay hoy

**Base técnica**
- No hay librería de animación. Todo es Tailwind 3 más CSS propio.
- Utilidad de entrada en `index.css:305-329`:
  - `animate-in` (180 ms, `--app-ease` = `cubic-bezier(0.2,0.7,0.2,1)`);
  - modificadores `fade-in`, `zoom-in-95` y `slide-in-from-*`, que funcionan con variables CSS.
  - Se usa en 28 lugares:
    - fondo y panel de `BaseModal`;
    - cada cambio de pestaña (`app.jsx` ~1899-2057);
    - el panel de notificaciones y el menú de `FormationModal`;
    - los toasts de fichaje;
    - la bandeja del comparador;
    - el cajón de `TransferFeed`;
    - `InstallPopup`.
- Interruptor global de movimiento reducido (`index.css:176`): lleva animaciones y transiciones a 0,01 ms. Es una buena base.
- `.btn` tiene `transition 150ms` y `active:translate-y-px`. Las filas y tarjetas usan `transition-colors`. Los chevrones de los acordeones rotan (Rivales, Recomendaciones, Filtros).
- Esqueletos de carga: `.skeleton`, un pulso de 1,4 s, en 10 lugares. Los spinners usan `animate-spin`.
- Barra lateral:
  - en celular anima `transform` (bien);
  - en escritorio anima `width` durante 280 ms.
- Pizarra: los marcadores tienen `transition-all 200ms`. Al cambiar de formación ya se deslizan, porque se animan `left` y `top`.

**Problemas encontrados**

| # | Problema | Evidencia | Estado |
|---|---|---|---|
| P1 | **El jugador "en la mano" en la pizarra no se achica, y el puesto destino no crece al pasar el mouse.** El `style.transform: translate(-50%,-50%)` en línea pisa las clases `scale-90` y `hover:scale-110`. Solo funciona el `opacity-30`. | `Pitch.jsx:80-86` | CONFIRMADO |
| P2 | **El confeti del festejo de fichaje no se ve.** `\${…}` dentro del template literal deja `rotate(${360 + …}deg)` literal en el CSS: la declaración es inválida y el fotograma 100 % pierde el `transform`. Las partículas no caen: nacen en `top:-5%`, fuera de pantalla. Además `Math.random()` se recalcula en cada render. El brillo tiene `animate-pulse` infinito. | `PlayerModal.jsx:279-293` | CONFIRMADO por lectura; falta verlo en el navegador |
| P3 | **`StatusAlert` y los toasts de fichaje ocupan la misma esquina** (`fixed bottom-4/6 right-4/6`, los dos `z-[120]`): el aviso de estado tapa el último fichaje. | `StatusAlert.jsx`, `app.jsx:2389` | CONFIRMADO |
| P4 | **No hay animaciones de salida.** Modales, toasts y avisos se desmontan de golpe: entran en 180 ms y desaparecen en 0. El `transition-opacity duration-300` de `StatusAlert` nunca corre, porque el aviso se monta y se desmonta en lugar de cambiar de estado. | `BaseModal.jsx` (`if (!isOpen) return null`), `StatusAlert.jsx` | CONFIRMADO |
| P5 | **`duration-200/300/500` junto a `animate-in` no hacen nada**: `duration-*` cambia la transición, no la animación. Todo dura 180 ms. `duration-250` ni siquiera existe en Tailwind. | `app.jsx`, `PlayerModal.jsx:261,263`, `TransferFeed.jsx:242` | CONFIRMADO |
| P6 | **CSS muerto:** `.modal-enter`, `.modal-content-enter`, `@keyframes slideIn` y `gradientBG` no se usan. `animate-pulse-slow` no está definida. | `index.css:459-522`, `MaintenanceScreen.jsx:32` | CONFIRMADO |
| P7 | **Las flechas del teclado en la pizarra arrastran el marcador:** cada pulsación inicia una transición de 200 ms, así que al mantener la tecla el marcador queda atrás. | `Pitch.jsx:80` | SOSPECHADO (falta probarlo) |
| P8 | **La barra lateral de escritorio anima `width`:** durante 280 ms se recalcula el layout del contenido principal, incluida la grilla virtualizada del mercado. | `index.css:578` | CONFIRMADO; costo no medido |
| P9 | **Un traspaso liberado se desvanece y se colapsa en 5 s** en `TransferFeed`. Anima `max-height`, `padding` y `margin` (propiedades de layout), y la fila desaparece mientras la leés. | `TransferFeed.jsx:105,334` | CONFIRMADO |
| P10 | **Duraciones y curvas sin criterio:** 150, 160, 180, 200, 220, 280, 300 y 500 ms, con `ease`, `ease-out`, `ease-in-out` y `--app-ease`. El único token es `--app-ease`. Las pantallas "Cargando…" pulsan el texto sin fin, contra la regla de `DESIGN_SYSTEM.md` ("no looping animations except a live indicator"). | `index.css`, `app.jsx:1601-1742` | CONFIRMADO |

| P11 | **Con "reducir movimiento" activado, los spinners quedan congelados.** El interruptor global (`animation-duration: 0.01ms; iteration-count: 1`) detiene `animate-spin` y los esqueletos de carga, así que una carga en curso parece colgada. La guía `motion` de modern-web-guidance desaconseja justamente ese reset global ("DO NOT globally apply `animation-duration: 0.01ms;`… can cause certain animations to become _more_ jarring"). | `index.css:176` | CONFIRMADO |

**Conclusión de la sección:** hay una base buena y liviana. El problema no es la falta de animaciones: hay cuatro rotas (P1, P2, P3, P5), ninguna salida, y valores sueltos sin un sistema.

## B. Animaciones recomendadas (por prioridad)

| # | Objetivo | Disparador | Comportamiento | Duración | Curva | Para qué | Prio | Esfuerzo |
|---|---|---|---|---|---|---|---|---|
| 1 | Pila única de toasts (`StatusAlert` y fichajes) | Aparece o se cierra un aviso | Un solo contenedor: abajo a la derecha en escritorio, abajo al centro en celular, por encima de la bandeja del comparador. Entra con un desplazamiento de 8 px y fundido; sale con fundido y 4 px. | 180 entrada / 120 salida | ease-out / ease-in | Arregla P3 y P4. Se ve qué aviso llegó y cuál se fue. | Alta | S–M |
| 2 | Pizarra: jugador en la mano y destino válido | Tocar un jugador; pasar el mouse sobre un puesto | Pasar el centrado a la propiedad CSS `translate`, así componen `scale-90` (en la mano) y `hover:scale-110` (destino). Cambiar `transition-all` por `transition-[left,top,scale,opacity]`. | 150 | ease-out | Arregla P1: hoy no se distingue qué jugador tenés agarrado. | Alta | S |
| 3 | Pizarra: mover con el teclado | Flecha | Sin transición en los movimientos por teclado (o 80 ms). El cambio de formación sigue deslizándose. | 0–80 / 220 | — / ease-in-out | Arregla P7. El cambio de formación se sigue leyendo como movimiento. | Alta | S |
| 4 | Fichar / ofertar / aceptar: estado en curso | Click en la acción | Botón deshabilitado con spinner hasta que responde el servidor. Al terminar, el número de presupuesto del encabezado destella su color una vez. | inmediato / 600 | ease-out | Evita el doble toque (éxito y después 409) y une la acción con su efecto en la plata. | Alta | S (verificar qué botones ya usan `loading`) |
| 5 | Festejo de fichaje | Fichaje exitoso | Arreglar el keyframe. Calcular las partículas una sola vez (`useMemo`), usar solo `transform` y `opacity`, máximo 30. Brillo estático. Con movimiento reducido, sin confeti. | 1500–2500 | ease-in | Arregla P2: hoy es el momento más importante de la app y la animación está rota. | Alta | S |
| 6 | Salida de modales y hojas | Cerrar (X, Escape, fondo, ruta) | El fondo se funde; el panel baja 8 px en celular (la hoja vuelve abajo) o achica a 0,98 en escritorio. Mientras sale queda con `inert` y `pointer-events:none`; el foco vuelve enseguida. | 140 | ease-in | Le da continuidad a la entrada que ya existe. En celular, la hoja que baja es lo que se espera. | Media | M (los modales-ruta se desmontan en `app.jsx`: hace falta mantenerlos montados al salir) |
| 7 | Acordeones (clubes en Rivales, Recomendaciones, secciones de Filtros) | Expandir | El contenido entra con `animate-in fade-in` (solo opacidad) y el chevron rota como ahora. **No** animar la altura. | 120 | ease-out | El contenido deja de aparecer de golpe, sin recalcular listas largas. | Media | S |
| 8 | Tarjeta de negociación (`CartModal`) | Cambia el estado de la oferta en vivo | El fondo de esa tarjeta destella una vez y el chip de estado transiciona de color. | 600 | ease-out | Hace notar qué oferta cambió mientras mirás otra. | Media | S |
| 9 | Traspaso liberado (`TransferFeed`) | Fila liberada | Estilo estático "Liberado" (atenuado), sin ocultarla ni colapsarla. | — | — | Arregla P9 y saca la animación de layout. | Media | S |
| 10 | Barra lateral de escritorio | Abrir o cerrar | Cambio de ancho instantáneo, o una animación `transform` del panel con un único cambio de layout al final. | 0 / 180 | ease-out | Arregla P8 en la pantalla más pesada. | Media | S |
| 11 | Bandeja del comparador | Agregar o quitar un jugador | El contador hace un único pulso de escala (1 → 1,15 → 1). | 150 | ease-out | Confirma la selección lejos de la tarjeta. | Baja | S |
| 12 | Menús desplegables (notificaciones, menú de formación) | Abrir o cerrar | `transform-origin` en la esquina del disparador, y salida con el mismo mecanismo que el ítem 6. | 140 / 100 | ease-out / ease-in | Coherencia con los modales. | Baja | S |
| 13 | Pantallas "Cargando…" | Carga inicial | `Spinner` con texto fijo, en lugar del texto que pulsa sin fin. | — | — | Cumple la regla del sistema de diseño. | Baja | S |

## C. Por componente

**FormationModal / Pitch**
- Lo que ya está bien: el deslizamiento de los marcadores al cambiar de formación, y que el arrastre siga al puntero sin transición.
- Arreglar 2 y 3.
- El pulso de los puestos vacíos mientras tenés un jugador en la mano se puede quedar: indica un estado. Pasarlo a un borde fijo más brillante sería más tranquilo.
- No animar el panel de tácticas ni los selectores.

**CartModal (plantel y finanzas)**
- La barra de presupuesto ya anima su `width` en 500 ms. Es un solo elemento, así que se queda.
- Agregar 4 (destello del presupuesto) y 8 (tarjeta de oferta).
- Liberar un jugador: la fila desaparece sin animación, y el toast más el destello del presupuesto alcanzan.
- Nada de animaciones escalonadas en la lista.

**Mercado** (de la otra sesión: coordinar)
- Las tarjetas ya tienen hover de color. Una elevación de 1 px en hover es opcional y de bajo valor.
- **No** animar resultados al filtrar, ordenar o buscar: la grilla está virtualizada (`@tanstack/react-virtual`) y tiene cientos de ítems.
- Lo útil está en otro lado: el ítem 11 y el estado en curso de Fichar (ítem 4).

**Rivales (TeamsModal)**
- Solo el ítem 7: fundido del contenido al expandir un club.
- Las filas de jugadores se quedan como están.

**Otros**
- Arreglar `TransferFeed` (ítem 9) y el festejo de fichaje (ítem 5).
- Las pestañas de navegación ya hacen un fundido de 180 ms: no agregar deslizamientos.

## D. Sistema de movimiento (chico y justificado)

**Tokens en `index.css :root`**, mapeados en `tailwind.config.js` (`transitionDuration` y `transitionTimingFunction`):
- `--dur-fast: 120ms`: respuesta a una acción y salidas chicas.
- `--dur-base: 180ms`: entradas (ya es la duración de `animate-in`).
- `--dur-move: 220ms`: movimientos de la pizarra.
- `--ease-out: var(--app-ease)` (ya existe), `--ease-in: cubic-bezier(0.4,0,1,1)` para salidas, `--ease-in-out: cubic-bezier(0.4,0,0.2,1)` para movimientos.

**Reglas**
- Solo `transform` y `opacity`, salvo la barra de presupuesto.
- Las salidas son más cortas que las entradas.
- Nada que bloquee: un cierre nunca espera a la animación para devolver el foco ni para aceptar la siguiente acción.
- Nada infinito, salvo indicadores en vivo y esqueletos.

**Un solo mecanismo de salida:** un hook `hooks/usePresence.js` de unas 25 líneas, según la guía `animate-element-entry-exit`.
- Recibe `isOpen` y devuelve `{ mounted, ref }`.
- Al cerrar, pone `data-closing` en el elemento. El CSS lleva `opacity` y `translate` al estado de salida.
- Espera `Promise.allSettled(el.getAnimations().map(a => a.finished))`, con un tope de seguridad de unos 300 ms, y recién ahí desmonta.
- No usa un temporizador fijo: así no se desincroniza de la duración del CSS, y con movimiento reducido no hay animación que esperar.
- Si el componente se reabre a mitad de la salida, cancela el cierre.
- Lo usan `BaseModal`, la pila de toasts y los desplegables.

**Detalles que vienen de la guía:**
- **Entradas:** siguen con los keyframes de `animate-in`, que funcionan en todos los navegadores. `@starting-style` y `transition-behavior: allow-discrete` son Baseline "newly available" (2024), y Firefox todavía no transiciona `display`. No los necesitamos: React desmonta el elemento, no le cambia el `display`.
- **Centrado y desplazamientos:** con propiedades individuales (`translate`, `scale`), no con `transform` en línea. Es la causa de P1 y lo que pide la guía ("individual transform properties, e.g. `translate` instead of `left/right/top/bottom`").
- **Pizarra:** los marcadores siguen usando `left`/`top` en %, porque `translate` en % es relativo al marcador y no a la cancha. Son 11 elementos chicos, así que es una excepción aceptada y documentada.
- **Movimiento reducido** (arregla P11): cambiar el reset global por el patrón `@property --animation-reduced` de la guía.
  - Cada animación declara su versión reducida.
  - Las entradas y salidas pasan a ser solo fundidos.
  - Los spinners giran lento o quedan con opacidad 0,5, en vez de congelarse.
  - Los esqueletos quedan fijos.
- **Destello del presupuesto:** uno solo por acción, nunca más de tres por segundo (límite de destellos de la guía).
- **Toasts:** la guía `persistent-toast-notifications` propone `popover="manual"` en la capa superior. **Por ahora no:** Popover es Baseline recién desde enero de 2025 (iOS 18.3), y en la liga puede haber iPhones más viejos, así que haría falta un polyfill. Alcanza con un contenedor `fixed` con z-index de toast por encima de los modales, como ahora. Se puede reconsiderar más adelante.

**Sin librería nueva.** framer-motion o motion suman decenas de KB gzip para cosas que CSS ya resuelve. Solo valdría la pena para animaciones de layout compartidas (FLIP), que no se recomiendan acá.

**Documentación:** agregar una sección "Movimiento" en `docs/DESIGN_SYSTEM.md`.

## E. Rendimiento y accesibilidad

- **Grillas grandes:** nunca animar ítems del mercado al filtrar, ni hacer entradas escalonadas. Con la virtualización, los ítems se montan y desmontan al scrollear, y cada uno volvería a animarse.
- **`backdrop-blur-sm` en el fondo de los modales:** fundir un elemento con blur es caro en Android de gama baja. Conviene fundir solo el color y dejar el blur estático, o sacar el blur en celular. Medirlo antes de decidir.
- **Layout:** sacar `transition-all` de los marcadores y las transiciones de `width`/`max-height` señaladas (P8, P9).
- **Foco:**
  - un modal que está saliendo debe quedar con `inert` y salir enseguida de la pila `openDialogs`, para que Escape y Tab ya vayan al de abajo;
  - el foco vuelve al disparador sin esperar la animación.
- **Movimiento reducido:**
  - cambiar el interruptor global por versiones reducidas animación por animación (ver D y P11);
  - el festejo lee `matchMedia('(prefers-reduced-motion: reduce)')` para no lanzar el confeti. Se puede reutilizar la función de `components/landing/Reveal.jsx`, moviéndola a `utils/motion.js`;
  - `usePresence` no necesita leerlo: espera las animaciones reales.
- **Lectores de pantalla:** los toasts mantienen `role=status`/`alert`. La salida no debe volver a anunciarlos.

## F. Hoja de ruta

1. **Microinteracciones de alto valor (S, un día):**
   - tokens;
   - ítems 2, 3 y 5;
   - ítem 4 (estado en curso);
   - ítem 1 (pila de toasts con `usePresence`);
   - movimiento reducido por animación (P11);
   - limpieza de P5, P6 y P10.
2. **Modales y navegación (M):**
   - ítem 6: `BaseModal` y una envoltura de presencia para los modales-ruta en `app.jsx`;
   - ítem 12 (desplegables);
   - ítem 10 (barra lateral).
3. **Contenido dinámico (S–M):** ítems 7, 8, 9, 11 y 13.
4. **Pulido opcional:** View Transitions API para cambiar de pestaña, como mejora progresiva solo en Chromium. **No se recomienda por ahora.**

**Orden y coordinación:**
- La fase 1 toca `Pitch.jsx` y `PlayerModal.jsx`: esperar a que programa-super2-12 termine y avisarle antes.
- El ítem 11 es del mercado: avisarle a programa-super2-28.

## G. Respuestas directas

- **¿Vale la pena?** Sí, pero de forma acotada. La app ya tiene entradas correctas. Lo que más mejora la experiencia es **arreglar las animaciones rotas** y agregar **salidas y respuesta a las acciones**, no sumar efectos.
- **Las cinco de mayor impacto:**
  1. pila de toasts con entrada y salida;
  2. jugador en la mano y destino en la pizarra;
  3. estado en curso de Fichar/ofertar con destello del presupuesto;
  4. salida de modales y hojas;
  5. festejo de fichaje reparado.
- **Evitar:**
  - animar resultados del mercado al filtrar, ordenar o buscar;
  - entradas escalonadas en listas;
  - elevación o escala en filas densas (plantel, Rivales);
  - deslizamientos entre pestañas;
  - contar números del presupuesto (retrasa leer el valor exacto);
  - rebotes y efectos elásticos;
  - pulsos infinitos decorativos;
  - animar `height`, `width` o `top` en contenedores grandes;
  - cualquier salida que demore un cierre o un click.
- **¿Librería o CSS?** CSS más el hook `usePresence`. Sin dependencias nuevas.
- **Plan mínimo:** la fase 1 completa, en un PR chico.

## Archivos a tocar (fase 1)

- `index.css`: tokens, utilidades `exit` / `[data-state=closing]`, borrar CSS muerto.
- `tailwind.config.js`: duraciones y curvas.
- `hooks/usePresence.js` (nuevo); `utils/motion.js` (nuevo, con `prefersReducedMotion` movido desde `Reveal.jsx`).
- `components/Pitch.jsx`: `translate` como propiedad propia, lista de transiciones, sin transición en movimientos por teclado.
- `components/PlayerModal.jsx`: `CelebrationPopup`.
- `components/StatusAlert.jsx` y el bloque de toasts de `app.jsx`, que pasan a un `components/ToastStack.jsx` nuevo.
- Botones de acción del mercado y las ofertas: usar `Button loading` donde falte.
- `docs/DESIGN_SYSTEM.md`: sección Movimiento.
- Después de aprobar, guardar este informe como `docs/ANIMACIONES-2026-10-16.md`.

## Verificación

- `npm test`, más un test de unidad para `usePresence` con timers falsos de Vitest (sin DOM: probar la lógica de la máquina de estados).
- `npm run build` y `graphify update .`.
- Revisión visual con el arnés de Vite y playwright-core más Chrome del sistema (memoria `visual-qa-harness`). Capturas a 360 y 1440 px de:
  - jugador en la mano en la pizarra;
  - la pila de toasts con aviso y fichaje juntos;
  - modal cerrándose (captura a mitad de la animación);
  - el festejo.
- Repetir con `page.emulateMedia({ reducedMotion: 'reduce' })`:
  - solo fundidos, sin desplazamientos;
  - sin confeti;
  - los spinners siguen indicando actividad, no quedan congelados;
  - el modal se desmonta sin quedar colgado.
- Teclado: Escape y Tab durante la salida de un modal van al modal de abajo, y el foco vuelve al disparador.
- Panel Performance de Chrome en el mercado con CPU ×4 al abrir y cerrar la barra lateral y un modal: sin tareas largas nuevas.
