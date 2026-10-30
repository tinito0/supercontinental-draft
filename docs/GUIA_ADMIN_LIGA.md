# Guía de administración: mercado y equipos

Para Santino y para las sesiones de código. Cómo actualizar el mercado de jugadores, sumar un equipo, cambiar el
manager de un club, editar o eliminar un club. Cada paso sale del código actual (revisado el 2026-10-30); si algo
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
8. **Publicá la web**: commit en una rama, PR, merge a `master`. Vercel hace el build.
9. **Probá en la web**: buscá un jugador nuevo y uno que cambió de precio, y mirá que el presupuesto de un club
   conocido sea el que esperabas.

---

## 2. Sumar un equipo

Un equipo del draft **es una cuenta**: el id del club es el id de Firebase del manager. No se crea a mano.

1. **El manager entra** a `/draft` con su cuenta de Google (o email). La app le crea el club solo, con presupuesto
   `DEFAULT_BUDGET` (200 000 000, `utils/constants.js`) y `approved: false`. Ve la pantalla de espera
   (`PendingApprovalScreen`): todavía no puede fichar, ofertar ni usar el chat.
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

### Lo importante

El club está atado al id de la cuenta. Ese id está en el equipo, el perfil, el plantel (`player_locks.lockedBy`),
las ofertas, los traspasos, los partidos del torneo (`homeTeamId`/`awayTeamId`), la historia de la web
(`club-{id}`), la página `/equipos/{id}`, el chat, las noticias y la asignación de Draft → PES.

Por eso **una cuenta de Gmail nueva que entra sola es un club nuevo, vacío**: no hereda nada.

### Qué existe hoy

La función del mercado tiene `migrateAccount` (`supabase/functions/_shared/market.js`): mueve un club de una cuenta
vieja **de email y contraseña** a una cuenta de Google. Mueve perfil, equipo, plantel, carrito, ofertas y traspasos.
Se dispara sola desde `screens/LinkGoogleScreen.jsx`, que aparece cuando alguien entra con email y contraseña a una
cuenta que nunca vinculó Google.

**No mueve**: la historia y la ficha del club en la web (`club-{id}`), los partidos del torneo, el chat, las noticias,
las formaciones compartidas, los datos de scouting ni la asignación en Draft → PES.

### Según cómo entra hoy el club

**A. La cuenta del club es de email y contraseña (nunca se vinculó a Google).**
1. El manager que se va le pasa el email y la contraseña al nuevo.
2. El nuevo entra con esos datos. La app le pide vincular Google: elige **su** Gmail. Ese Gmail no tiene que haber
   entrado antes a la app (si ya tiene equipo propio, la migración se frena: «Esa cuenta de Google ya tiene su propio
   equipo»; eliminá ese equipo vacío desde Administración y reintentá).
3. El club pasa a la cuenta nueva. Desde ahí entra con Google.
4. Arreglá a mano lo que no se mueve: copiá la historia del club en Web pública al club nuevo y revisá los partidos
   del torneo y la asignación en Draft → PES.

**B. La cuenta del club ya es de Google (lo normal hoy).**
No hay forma desde la app. Las salidas reales:
- Que el manager que se va ceda su Gmail (no recomendable: es su cuenta personal).
- **Construir una herramienta de administración «Cambiar manager»** (tarea de código, no existe): elegir el club y la
  cuenta nueva, reutilizar `migrateAccount` desde el servidor con permiso de admin y mover también `club-{id}`,
  partidos del torneo, Draft → PES y lo demás de la lista de arriba. Pedila en una sesión de código con esta sección
  como especificación.

Mientras no exista, la alternativa sin código es: el manager nuevo entra con su Gmail (club nuevo), lo aprobás, le
ponés el mismo nombre, escudo y presupuesto, y eliminás el club viejo. Se pierde el plantel (vuelve al mercado), la
historia de la web y los vínculos con partidos jugados.

---

## 4. Editar un club

Administración → Equipos y usuarios → **Editar**: nombre, escudo, país, presupuesto y estadísticas manuales.

- El presupuesto que vale es `teams/{id}.budget` (el formulario lo guarda ahí).
- **Las filas de la tabla del torneo guardan el nombre**, no el id: si renombrás un club con la temporada en curso,
  revisá la tabla en el gestor del torneo.

## 5. Eliminar un club

Administración → Equipos y usuarios → Editar → **Eliminar equipo**. No se puede deshacer. Borra la ficha pública, el
perfil (formación, dorsales, franquicia) y el carrito; **sus jugadores vuelven al mercado** y sus ofertas abiertas se
cierran. La cuenta de Firebase del manager sigue existiendo: si vuelve a entrar, se le crea un club nuevo pendiente de
aprobación.

## 6. Nueva temporada

Administración → General → reinicio de temporada (`utils/seasonReset.js`): vacía planteles, ofertas, traspasos,
noticias, formaciones compartidas, carritos y scouting, y devuelve el cupo de jugador franquicia. Mantiene
presupuesto base, nombre, escudo y permisos. Es el mejor momento para actualizar el mercado (sección 1).

---

## Para las sesiones de código

| Tarea | Dónde |
|---|---|
| Generar el mercado | `scripts/main.py` (fórmula de precio, mapeos de posición, estilo y aptitud) |
| Catálogo del servidor | `scripts/build-market-catalog.mjs` → `supabase/functions/_shared/catalog.json` |
| Presupuesto | `supabase/functions/_shared/budget.js` (lo comparten app y función) |
| Fichar, liberar, aceptar, migrar cuenta | `supabase/functions/_shared/market.js` |
| Alta y aprobación | `hooks/useAuth.js`, `components/admin/TeamsAdminSection.jsx`, `supabase/functions/_shared/membership.js` |
| Tamaño de la liga y copas | `utils/tournamentModel.js`, `utils/competitionRules.js`, `utils/bracketModel.js` |
| Draft → PES | `pes/draftTransfer.js`, `components/pes/PesDraftPanel.jsx`, `docs/PES_ENGINE.md` §4b |
| Reglas de Firestore | `firestore.rules` (`npm run test:rules` + `firebase deploy --only firestore:rules`) |

Pendiente conocido: herramienta «Cambiar manager» para clubes con cuenta de Google (sección 3, caso B).
