# Supercontinental Draft — design system

Art direction: **matchday control room**. A football competition's own tool: dark blue-ink canvas, the royal
blue of the SCL crest (`public/logo.webp`) as the single identity/interaction color, white numbers, condensed
type for titles and figures. Information-dense but calm. Every element earns its place.

**Dials** (antislop, Part 3): the draft app is ENERGY 2 / RHYTHM 2 / MOTION 1; the public league site
(`screens/league/`, `components/landing/`) is ENERGY 3 / RHYTHM 3 / MOTION 2. The OBS overlay is broadcast
graphics and sets its own frame in `components/broadcast/broadcast.css`.

**Why these choices** (one line each, so a change has something to argue against):

- *Dark only*: managers use it during a live draft in the evening, next to OBS and the game; a bright page there is glare, not preference.
- *Crest blue as the single accent*: it is the league's own mark, so interaction color and identity are the same thing.
- *Barlow + Barlow Condensed*: the condensed face is the scoreboard voice (figures, titles); Barlow carries long text. Two families, as the performance rules ask.
- *Radii 6/8/12/16*: small controls tighten, containers soften, so a panel never reads as a button.
- *Hairlines instead of cards*: dense lists need separation without stacking boxes.

## Principles

1. **Weight, not boxes.** Hierarchy comes from type size, weight and spacing. One panel per real region of the
   page (a list, a form, a detail). Inside a panel separate groups with spacing or a hairline
   (`border-line/10`), never with nested cards. A row of metrics is plain `<Stat>`s, not tiles.
2. **Badges are rare.** A badge marks a *state* the user must notice (locked, error, unsaved, live, new offer).
   Counts, categories, file names, seasons and metadata are plain text (`text-ink-3`). At most one badge per row.
3. **One accent: crest blue.** `accent` marks the primary action, the selected item and focus. success / warning /
   danger only for their meaning. No purple, indigo, cyan, gradients or glows as decoration (the guided tour and the
   chat scrollbar included: they use `accent-soft`). The crest lavender (`--c-crest-lavender`) is reserved for
   competition marks (e.g. a "Supercontinental" wordmark rule) and never for interaction. Its one use in the UI is the
   **Jugador Franquicia** mark (a league identity): `border-crest` on the franchise card, `text-crest-soft` for the
   «Franquicia» label (lavender itself as text on a fill is 4.1:1, so text always uses the soft tone). Exceptions that are not
   decoration: the OBS overlay frame gradient (`broadcast.css`), the pitch grass stripes (`Pitch.jsx`) and the data
   palettes (`pos-*`, `stat-c-*`, `ovr-*`).
4. **Numbers are the content.** Prices, OVR, budgets, scores, points: `font-display` + `.num` (tabular), larger and
   heavier than their labels. Labels are small and muted (`.eyebrow` or `text-xs text-ink-3`).
5. **Same skeleton everywhere**: `<Page>` → `<PageHeader eyebrow title description actions>` → optional toolbar
   (search / filters / `<Tabs>`) → content. Pages must not draw their own outer frame, close button or full-height
   card: the app shell already provides the frame. The remaining budget is shown **only** in the top header.
6. **Football language is reused, not reinvented**: the marketplace player card (`components/PlayerCard.jsx`: square photo, OVR and position chips), position colors
   (`getPosColorClass` → `pos-*`, `getPosColor`), stat color scale (`getStatAndOvrColorClass` → `stat-c-*`),
   `Pitch`, the standings table style (`LeagueTableView`). Wherever a player appears: photo
   (`/fotos_jugadores/{Id}.webp`, square, `object-cover`, `bg-raised`), position color, OVR in the stat color.
   Club crests: `object-contain`, never cropped, no drop shadows.
7. **Designed states**: `.skeleton` placeholders shaped like the content, `<EmptyState>` that says what to do
   next, inline `<Alert tone="danger">` next to what failed, disabled controls that say why (`title`/help text).
8. **Mobile first.** Works at 360px: no horizontal page scroll (tables scroll inside their own container with
   `overflow-x-auto`), touch targets ≥ 44px (`min-h-11`), toolbars wrap, side-by-side layouts stack below `lg`,
   dialogs become full-height sheets below `sm`. Never hide essential functionality on small screens.
9. **Accessible by default**: visible focus (global), labels on every field (`<Field>`), `aria-label` on icon
   buttons (`<IconButton label>`), color never the only signal, `prefers-reduced-motion` honored (see Motion),
   no looping animations except a live indicator, skeletons and spinners.

## Tokens (`index.css` → `tailwind.config.js`)

| Token | Value | Use |
|---|---|---|
| `bg-canvas` | #080b14 | app background |
| `bg-surface` | #0e1320 | panels, page regions, dialogs |
| `bg-raised` | #151b2b | fields, rows, controls inside panels |
| `bg-overlay` | #1d253a | menus, hover of raised elements, selected tab |
| `text-ink` / `-2` / `-3` | #f1f5f9 / #b8c2d6 / #8692ab | primary / secondary / muted text |
| `border-line/10…30` | | hairlines (10–14 inside panels, 16–20 controls, 30 hover) |
| `accent` | #3a66c4 | crest blue: primary buttons, selection (white text on it) |
| `accent-hover` / `accent-soft` / `accent-deep` | #4d7ad6 / #93b0f2 / #16244a | hover / blue text & icons on dark / tinted fills |
| `success` `warning` `danger` (+`-soft` text) | | meaning only |

Contrast (measured with `.claude/skills/antislop-human/contrast-check.py`): `ink-3` on surface 5.93:1, on raised 5.49:1,
on overlay 4.87:1; white on `accent` 5.42:1; `accent-soft` on surface 8.59:1, on raised 7.95:1. Plain `accent` on
surface is **3.42:1**: it fails for text, so **blue text is always `text-accent-soft`**; `accent` is for fills,
borders and large icons. A control whose border is what delimits it (`.input`, `.select`) needs 3:1 against its
background, so its border is `border-line/55` (3.03:1 on raised); hairlines at 10–20 % are for dividers only.
Text on a data color (position, OVR and stat pills) is `#1e1e1e`: white fails AA on all of them (2.1–3.3:1).

Radii: `rounded-md` 6px small controls · `rounded-lg` 8px buttons, fields · `rounded-xl` 12px inner blocks ·
`rounded-2xl` 16px panels, dialogs. `rounded-full` only for dots, avatars, crest masks and count bubbles on an icon;
a label, category or state is `rounded-md`, never a pill. Shadows `shadow-sm`/`shadow-md`/`shadow-lg` only (no custom
ones, no `drop-shadow` on crests) for things that float or panels on canvas.

**Depth and blur.** No `backdrop-filter` blur anywhere. The `BaseModal` scrim is a near-opaque `bg-canvas/90`; it had
`backdrop-blur-sm` until 2026-10-30, when it was measured dropping scrolling inside a long dialog (Filtros with its
glossary) to about 15 fps (headless Chromium, CPU 4x, 99 % of frames late; 60 fps without it). Firefox-based browsers
pay even more for it. Sticky bars, popovers, the mobile sidebar scrim and the other full-screen scrims also use a solid
or near-opaque token fill. No glow (`box-shadow` with blur in an accent color); the only halos are the one-shot `.value-flash` and
`.row-flash`.

Type: **Barlow** text, **Barlow Condensed** (`font-display`) for page/section titles, numbers, scoreboards.
Page title 28–32px bold · section title 18px bold uppercase (`.section-title`) · body 14–16px · labels 11–12px.
**Nothing is smaller than 11px** (`text-[9px]`/`text-[10px]` are gone). One exception: the dorsal and OVR chips on the
pitch markers (`Pitch.jsx`, 9–10px) sit on a 360px pitch; the same numbers are in the lists next to it.
Weights: 400/500/600/700 only (no `font-black`, no 900); the OBS overlay may use Barlow Condensed 800, which is loaded.
Uppercase only for eyebrows, section titles and table heads, never for field labels, buttons, badges or names.
Letter-spacing on uppercase is at most `0.08em` (`tracking-wider` is 0.05em); `tracking-widest` is not used.

## Motion

Motion explains a change; it never decorates or delays. Audit and roadmap: `docs/ANIMACIONES-2026-10-16.md`.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` / `duration-fast` | 120ms | feedback to an action, exits |
| `--dur-base` / `duration-base` | 180ms | entries (`animate-in`, toasts) |
| `--dur-move` / `duration-move` | 220ms | things moving to a new place (pitch markers, meters) |
| `--dur-flash` | 600ms | a value that changed glows once (`.value-flash`) |
| `--ease-out` / `ease-out` | `cubic-bezier(0.2,0.7,0.2,1)` | entries |
| `--ease-in` / `ease-in` | `cubic-bezier(0.4,0,1,1)` | only falling things (confetti); exits use `--ease-out` too |
| `--ease-in-out` / `ease-in-out` | `cubic-bezier(0.4,0,0.2,1)` | moves |

- **Entries**: `animate-in` plus `fade-in`, `zoom-in-95`, `slide-in-from-*`. Its length is fixed: `duration-*` classes
  change transitions, not animations, so they do nothing next to it.
- **Exits**: React unmounts at once, so an element that should animate out stays mounted with `data-closing` until its
  animation ends: `usePresenceList` and `useExitAnimation` (`hooks/usePresence.js`), as in `ToastStack`. A leaving
  element is `inert`, and closing never waits for the animation to return focus or accept the next action.
- **Only `transform` and `opacity`**, using individual properties (`translate`, `scale`), not an inline `transform`:
  it overrides Tailwind's scale classes. Exceptions: the pitch markers keep `left`/`top` in % (11 small elements) and
  meters animate `width`.
- **Duration classes**: `duration-fast` (feedback, hover, exits), `duration-base` (entries), `duration-move` (meters and
  anything that travels). No `duration-150/200/300/500`. The one literal is the live vote bar at 300ms (below).
  Easing keywords `ease`/`ease-in-out` are not used; transitions name their properties and use `var(--ease-out)`.
- **Looping**: `animate-pulse` only on the live dot (`bg-danger`, marks a real live match). Loading placeholders use
  `.skeleton`, not `animate-pulse`. Nothing else loops.
- **Guided tour** (`.guide-*`, used by `TutorialModal` and `ScoutAssignmentsPanel`): its ring animates
  `left/top/width/height` on purpose, because it is one small fixed element that follows another and `transform`
  cannot resize a border without distorting it. It is the only exception besides pitch markers and meters.
- **transitions.dev** (installed as `.claude/skills/transitions-dev` and `transitions-polish`): the app keeps its own
  scale (120/180/220ms) because it matches the library's open/close asymmetry rule (exit shorter than entry). Use
  `transitions review` to flag off-scale values, not to import the library's 150/250/350/400/500ms scale. Its
  stagger, bounce and count-up transitions stay out (see Don't below); anything from it that is not on this page needs
  a line here first. In use, on the app's scale:
  - *Text states swap* (`.status-swap` + `hooks/useStatusSwap.js`): a status that steps to the next one in place
    (the board's autosave «Guardando…» → «Guardado automático», the «jugador en mano» line, the share icon turning
    into a check). Old text leaves 4px up in `--dur-fast`, new one enters from 4px below in `--dur-base`.
  - *Text swap soft* (`.soft-swap`, `components/ui/SoftValue.jsx`): numbers that change because the data behind them
    changed (team strength when the XI changes). Old and new cross-fade in the same cell, nothing moves.
  - Both add a 2px blur to the fade: the one `filter` exception to "only transform and opacity", on short text only.
- **PES editor** (`components/pes/`, all on the app scale, each one explains a change):
  - The view behind the editor tabs, an opened team, a team section and a picked player fade in (`animate-in fade-in`,
    keyed by what changed), so a switch reads as "another record", not as an edit. Fade only, no slide.
  - The status line shows one state (`StatePill`: errors, unsaved, missing sources, ready, saved) that steps to the
    next with the *text states swap*; the modified-field count uses `SoftValue`.
  - A field that becomes modified gets `ModifiedDot`, which pops in once (`zoom-in-50`, no bounce): the edit landed.
  - Attribute bars grow with `scale` (`.meter-fill`), like the strength bars.
  - `<details>` use `Disclosure`: a chevron that flips (`scale: 1 -1`); the content appears without animating height.
  - Irreversible actions use `ConfirmAction` instead of `window.confirm`: the button turns, in place, into the
    question with «Cancelar» (focused) and the confirm button; Escape cancels and returns focus.
  - The team save bar rises 8px in and drops 8px out once saved (`.save-bar`, `useExitAnimation`).
- **Press and hover** (2026-10-22 audit): pressables scale to 0.97 on `:active` (`.btn`, vote buttons, OBS scene
  buttons). `hover:` only applies with a real pointer (`future.hoverOnlyWhenSupported` in `tailwind.config.js`), so a
  tap never leaves a hover stuck on phones. No `transition-all`: list the properties.
- **Live values**: bars fed by live votes grow with `transform: scaleX()` and a 300ms ease-out transition, not `width`.
  A live score that changes flashes once (`.value-flash`), never on page load.
- **OBS overlay** (`components/broadcast/broadcast.css`) is broadcast graphics, not app UI: staged entries (~1.6 s) and
  short row staggers are allowed there; the exit is shorter than the entry (280ms). Every curve is `--scl-ease`.
  The community popup and cards (`CommunityFrame.jsx`, `.scl-pop`) sit at the bottom, clear of the game's score and
  clock, and enter softly: fade, a 20px rise and a blur that clears, then each line in turn. No bounce, no rotation.
  The QR ring pulses three times, then stops; a percentage that changes fades in place.
- **Defaults**: a bare `transition` or `transition-colors` resolves to `--dur-fast` and `--ease-out`
  (`tailwind.config.js` `DEFAULT`), never Tailwind's 150ms. The mobile sidebar opens in `--dur-move` and closes in
  `--dur-base`.
- **Reduced motion**: no animation runs except its declared reduced version, `--animation-reduced` next to the
  original (`index.css`). Entries and exits become fades; spinners turn slowly instead of freezing. Transitions are
  instant. Check `prefersReducedMotion()` (`utils/motion.js`) before starting JS-driven effects such as the confetti.
- **Don't**: animate marketplace results on filter, sort or search (the grid is virtualized); stagger list entries;
  scale or lift dense rows; slide between tabs; count numbers up; bounce; animate `width`/`height`/`top` on large
  containers; flash anything more than once per change.

## Building blocks

- CSS (`index.css @layer components`): `.btn .btn-primary|secondary|ghost|danger|success .btn-sm|lg .btn-icon`,
  `.input .select .field-label .field-help .field-error`, `.panel .panel-flat .well`, `.tab-list .tab`,
  `.chip` (removable filter tokens only), `.data-table`, `.skeleton`, `.kbd`, `.eyebrow .page-title .section-title
  .num .font-display`. `.eyebrow-strong` lifts an eyebrow to `ink-2`, only for group titles inside long reading lists
  (the Filtros glossary), where `ink-3` at 11px got lost between 16px entries (owner feedback, 2026-10-30).
- React (`components/ui`): `Page`, `PageHeader`, `SectionHeader`, `Button`, `IconButton`, `Field`, `Tabs`,
  `Alert`, `Stat`, `EmptyState`, `Spinner`, `Badge` (states only), `BaseModal` (dialogs; Escape inside a field
  only leaves the field).
- Guided tour: `.guide-layer .guide-backdrop .guide-ring .guide-popover .guide-close`. Crest blue, solid surface,
  `shadow-lg`; there is no second tour style.
- Legacy names are gone: Tailwind `brand.*` and `info`, and the `--app-*` color aliases. Use `canvas/surface/raised/
  overlay`, `ink`, `line`, `accent` and the `--c-*` channels. `Spinner color="cyan"` and `Badge tone="purple"` are old
  prop names that map to the accent; they do not render those hues.

## Pattern: entity editor (reference: `components/pes/team/`)

For editing one record out of many (the PES team workspace): a sticky list panel (search, filter `Tabs`, rows
≥ 44px with at most one state), next to an identity header (mark, name in `font-display`, one metadata line),
section `Tabs`, one panel per section with `Group`s, and a sticky save bar shown only while that record has unsaved
changes. Below `lg` it is master/detail (list, then the record with a «← back» button), never a stacked list.
Selection and section live in the URL. Data colours (team colours) appear only in the mark and its band, as solid
halves, never as decoration.

## Pattern: squad list (PES game plan, `components/formation/SquadList.jsx`)

The public club page and the tactics board list a squad the way PES 2021's game plan does: the XI in kick-off order
(one row per slot, empty slots included), then the substitutes. Each row leads with the role it plays as a solid
position-colour cell (the only colour block in the row, and it carries data: the role), then shirt number, name with
one muted metadata line, and OVR in the stat colour. Rows are separated by hairlines, never boxed. «Fuerza del once»
(`TeamStrength`, `utils/teamStrength.js`) sits on top: average OVR per line of the XI, bars in the stat colours, the
bar floor at OVR 40 so close lines still look different. On the board a row is the same target as its pitch marker:
tap a starter to take him in hand, then another starter (swap), a substitute (substitution) or «Mandar al banco».

## Don'ts

Pills for metadata · cards inside cards · `font-black` and uppercase on every label · text under 11px ·
`text-accent` for text (use `text-accent-soft`) · white text on a data color · `backdrop-filter` blur ·
a second accent hue (cyan) · `transition: all` · emoji as icons ·
`bg-[#hex]` literals (use tokens) · light-mode classes (the app is dark only) · `window.alert` for feedback ·
icon-only buttons without `aria-label` · buttons without `type` · hardcoded season labels or invented data ·
budget repeated in page bodies.
