# Supercontinental Draft — design system

Art direction: **matchday control room**. A football competition's own tool: dark blue-ink canvas, the royal
blue of the SCL crest (`public/logo.webp`) as the single identity/interaction color, white numbers, condensed
type for titles and figures. Information-dense but calm. Every element earns its place.

## Principles

1. **Weight, not boxes.** Hierarchy comes from type size, weight and spacing. One panel per real region of the
   page (a list, a form, a detail). Inside a panel separate groups with spacing or a hairline
   (`border-line/10`), never with nested cards. A row of metrics is plain `<Stat>`s, not tiles.
2. **Badges are rare.** A badge marks a *state* the user must notice (locked, error, unsaved, live, new offer).
   Counts, categories, file names, seasons and metadata are plain text (`text-ink-3`). At most one badge per row.
3. **One accent: crest blue.** `accent` marks the primary action, the selected item and focus. success / warning /
   danger only for their meaning. No purple, indigo, cyan, gradients or glows as decoration. The crest lavender
   (`--c-crest-lavender`) is reserved for competition marks (e.g. a "Supercontinental" wordmark rule) and never
   for interaction.
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

Radii: `rounded-md` 6px small controls · `rounded-lg` 8px buttons, fields · `rounded-xl` 12px inner blocks ·
`rounded-2xl` 16px panels, dialogs. Shadows `shadow-md`/`shadow-lg` only for things that float or panels on canvas.

Type: **Barlow** text, **Barlow Condensed** (`font-display`) for page/section titles, numbers, scoreboards.
Page title 28–32px bold · section title 18px bold uppercase (`.section-title`) · body 14–16px · labels 11–12px.
Weights: 400/500/600/700 only (no `font-black`). Uppercase only for eyebrows, section titles and table heads.

## Motion

Motion explains a change; it never decorates or delays. Audit and roadmap: `docs/ANIMACIONES-2026-10-16.md`.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` / `duration-fast` | 120ms | feedback to an action, exits |
| `--dur-base` / `duration-base` | 180ms | entries (`animate-in`, toasts) |
| `--dur-move` / `duration-move` | 220ms | things moving to a new place (pitch markers, meters) |
| `--dur-flash` | 600ms | a value that changed glows once (`.value-flash`) |
| `--ease-out` / `ease-out` | `cubic-bezier(0.2,0.7,0.2,1)` | entries |
| `--ease-in` / `ease-in` | `cubic-bezier(0.4,0,1,1)` | exits |
| `--ease-in-out` / `ease-in-out` | `cubic-bezier(0.4,0,0.2,1)` | moves |

- **Entries**: `animate-in` plus `fade-in`, `zoom-in-95`, `slide-in-from-*`. Its length is fixed: `duration-*` classes
  change transitions, not animations, so they do nothing next to it.
- **Exits**: React unmounts at once, so an element that should animate out stays mounted with `data-closing` until its
  animation ends: `usePresenceList` and `useExitAnimation` (`hooks/usePresence.js`), as in `ToastStack`. A leaving
  element is `inert`, and closing never waits for the animation to return focus or accept the next action.
- **Only `transform` and `opacity`**, using individual properties (`translate`, `scale`), not an inline `transform`:
  it overrides Tailwind's scale classes. Exceptions: the pitch markers keep `left`/`top` in % (11 small elements) and
  meters animate `width`.
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
  .num .font-display`.
- React (`components/ui`): `Page`, `PageHeader`, `SectionHeader`, `Button`, `IconButton`, `Field`, `Tabs`,
  `Alert`, `Stat`, `EmptyState`, `Spinner`, `Badge` (states only), `BaseModal` (dialogs; Escape inside a field
  only leaves the field).

## Pattern: entity editor (reference: `components/pes/team/`)

For editing one record out of many (the PES team workspace): a sticky list panel (search, filter `Tabs`, rows
≥ 44px with at most one state), next to an identity header (mark, name in `font-display`, one metadata line),
section `Tabs`, one panel per section with `Group`s, and a sticky save bar shown only while that record has unsaved
changes. Below `lg` it is master/detail (list, then the record with a «← back» button), never a stacked list.
Selection and section live in the URL. Data colours (team colours) appear only in the mark and its band, as solid
halves, never as decoration.

## Don'ts

Pills for metadata · cards inside cards · `font-black` and uppercase on every label · emoji as icons ·
`bg-[#hex]` literals (use tokens) · light-mode classes (the app is dark only) · `window.alert` for feedback ·
icon-only buttons without `aria-label` · buttons without `type` · hardcoded season labels or invented data ·
budget repeated in page bodies.
