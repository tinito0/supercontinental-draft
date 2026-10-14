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
6. **Football language is reused, not reinvented**: the PES player card (`playercard.css`), position colors
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
   buttons (`<IconButton label>`), color never the only signal, `prefers-reduced-motion` honored (global CSS),
   no looping animations except a live indicator.

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

## Building blocks

- CSS (`index.css @layer components`): `.btn .btn-primary|secondary|ghost|danger|success .btn-sm|lg .btn-icon`,
  `.input .select .field-label .field-help .field-error`, `.panel .panel-flat .well`, `.tab-list .tab`,
  `.chip` (removable filter tokens only), `.data-table`, `.skeleton`, `.kbd`, `.eyebrow .page-title .section-title
  .num .font-display`.
- React (`components/ui`): `Page`, `PageHeader`, `SectionHeader`, `Button`, `IconButton`, `Field`, `Tabs`,
  `Alert`, `Stat`, `EmptyState`, `Spinner`, `Badge` (states only), `BaseModal` (dialogs; Escape inside a field
  only leaves the field).

## Don'ts

Pills for metadata · cards inside cards · `font-black` and uppercase on every label · emoji as icons ·
`bg-[#hex]` literals (use tokens) · light-mode classes (the app is dark only) · `window.alert` for feedback ·
icon-only buttons without `aria-label` · buttons without `type` · hardcoded season labels or invented data ·
budget repeated in page bodies.
