# Architecture map

How the app is put together, where the kit viewer and the formation editor live, and how to keep the
dependency graph current. The binary formats and the PES engine are described in `docs/PES_ENGINE.md`.

## The dependency graph

- **Location:** `graphify-out/`. `graph.json` holds nodes (files, functions, constants) and edges (`imports`, `calls`, `contains`, …).
  `GRAPH_REPORT.md` summarises communities, the most-connected nodes and import cycles. `graph.html` is the interactive view.
- **Regenerate after code changes:** `graphify update .` (AST only, no API cost). Run
  `graphify cluster-only . --no-label` to rebuild the report without calling a model.
- **Query it before reading code:** `graphify query "<question>"`, `graphify explain "<file or symbol>"`,
  `graphify affected "<symbol>"` (what breaks if it changes).
- **What it does not show** (checked against the source):
  - **Data passed by string paths, not imports.** Two loaders reading the same Firestore documents look
    unrelated; this hid the duplicated team loader of `TemplateAdminSection` and `draftTeamsService`.
  - **Formulas written inline.** The pitch → game coordinate formula existed in `utils/pesExport.js` (inline)
    and `pes/draftTransfer.js` (`toPitch`) with no edge between them.
  - **Some `INFERRED` edges are name collisions**, e.g. `KitGL → upload()` (`services/pesTextureStorage.js`):
    `kitRenderer.js` has no imports at all.
  - **Missing file types.** `.sql` files (tree-sitter SQL not installed), `firestore.rules`, CSS and
    `config.txt`/JSON data are not in the graph.

## Two sites

`main.jsx` reads the URL before rendering and mounts one of two apps from the same `index.html`
(`utils/siteRoutes.js`, tested in `tests/siteRoutes.test.js`):

| URL | App | Notes |
| --- | --- | --- |
| `/draft…` (also `/DRAFT…`) | `app.jsx` in `<BrowserRouter basename="/draft">` | the draft; its own title and PWA manifest |
| everything else | `screens/league/LeagueSite.jsx` | public league site; never links to the draft |

Each app is its own lazy chunk, so league visitors do not download the draft. Old draft URLs keep working:
`firebase.json` redirects paths (`/team/…`, `/overlay`, `/login`, …) and `legacyDraftRedirect()` handles query
modes the hosting cannot match (`/?mode=obs`, `/torneo?mode=…`).

Administration (league texts, club profiles, community voting, tournament editor, OBS scenes) exists only inside the
draft, at `/draft/admin`. `/admin` is deliberately not redirected (it shows the league 404), so the URL does not point
visitors at the draft. The league site has no admin screens.

## Layers

| Layer | Folders | Depends on |
| --- | --- | --- |
| Screens and components (React) | `app.jsx`, `screens/`, `components/` | hooks, services, utils, pes |
| State and data hooks | `hooks/` | services |
| Services (Firebase, Supabase) | `services/`, `config/` | — |
| Domain helpers (pure) | `utils/` | `pes/formats/*Layout.js` (constants only) |
| PES engine (pure, no React) | `pes/core` → `pes/formats` → `pes/operations.js`, `pes/kits`, `pes/draftTransfer.js` | `utils/formationStates.js`, `utils/advancedInstructions.js` |

The graph reports no import cycles. The `pes/` ↔ `utils/` link added for the formation editor is acyclic:
- `pes/draftTransfer` imports the pure `utils/formationStates` and `utils/advancedInstructions`.
- `utils/advancedInstructions` imports only the constant table `EDIT_ADVANCED_CODES` from `pes/formats/pes2021/editLayout.js`.

## Kit viewer: from `config.txt` to pixels

```
team/sections/KitsSection ──(kits workspace, cfg, workspaceId, uid, canShare)──▶ PesKit3DViewer (tabs; layout + orchestration)
  pes/kits/kitConfig.js        parse config.txt (lossless); constraint = kserv.lua range, commentConstraint = comment
  pes/kits/kitConfigSchema.js  kserv.lua v1.17 editor ranges (authoritative), badge "off" = X31,Y0
  pes/kits/kitRenderConfig.js  config → render parameters, values {raw, used}, badges, notes
  pes/kits/kitDecalFormulas.js steps → game floats (KitPos/PES2021.exe) → texture UV of name and numbers
  pes/kits/kitAssetResolver.js refs (KitFile, _srm, _nrm, fonts, _ex) → providers in order → per-slot status
  components/pes/kit3d/useKitAssets.js + loadKitTextures.js + gameFolder.js
                               providers: workspace → cloud manifest (Firestore kit_textures + Supabase) → local
                               kit-server folder; session AssetCache; "Compartir texturas" uploads local .ftex
  pes/kits/kitModels.js        model parts: collar / winter collar, sleeves, undershirt, shorts, socks
  components/pes/kit3d/kitDecals.js   name/numbers drawn with the kit's font sheets (KitFont)
  components/pes/kit3d/useKitGL.js    context lifecycle (lost/restored → epoch), dispose on unmount
  components/pes/kit3d/kitRenderer.js WebGL (KitGL); deletes buffers/textures it replaces; sharedThumbRenderer
  components/pes/kit3d/CollarPicker.jsx  thumbnails on the shared context; "Usar" → kit.set Collar/WinterCollar
  components/pes/kit3d/KitViewerPanels.jsx  presentational panels (Vista, Camiseta, Letras, Tela, Diagnóstico)
```

## Formation editor: states, positions, instructions

```
FormationModal (state + autosave) ── Pitch (drag, keyboard) ── TacticalStateBar, PositionPicker, AdvancedInstructionsPanel
  utils/formationStates.js      Inicio / Con pelota / Sin pelota, fluid switch, positions and roles per slot
                                and state, formation preset per state, pointer → pitch %, pitch % → game
                                coordinates, PES role table
  utils/positionRules.js        which roles a slot may play where it stands (zone table from the game's EDIT data)
  utils/advancedInstructions.js catalog (codes from editLayout EDIT_ADVANCED_CODES), 2 + 2 rules
Persisted in the profile and public team docs: formation, lineup, formationStates, advancedInstructions, …
Read back by:
  services/draftTeamsService.js    the only team loader, shared by both exports
  pes/draftTransfer.js             EDIT variants and instructions, TacticsFormation F1..F3
  utils/pesExport.js               Formation.csv F1..F3 and FluidS
  screens/TeamScreen.jsx, screens/FormationViewScreen.jsx   the saved starting positions
```

Legacy profiles without `formationStates` or `advancedInstructions` normalise to the plain layout, fluid
off and no instructions, and export exactly as before.

`formationStates.formation` is the team's formation; FormationModal derives the selector from it (no second
copy). Choosing a formation applies to the state being edited: Inicio changes the team formation (with fluid on,
Con pelota / Sin pelota are first written out so they keep what they had); Con pelota / Sin pelota take only the
preset's positions and roles. The lineup is never cleared. A slot's role always resolves to one allowed where it
stands (`layoutForState`), so the pitch, the saved data and both exports agree; each variant exports its own roles.

## Known structural risks

- **High:** `app.jsx` (≈2,600 lines, the most-connected app node) mixes routing, Firestore
  subscriptions, market logic and modal wiring. Changes there have the widest blast radius. Split it into
  route components and data hooks when it next needs substantial work.
- **Medium:**
  - **`components/FormationModal.jsx` (≈1,070 lines)** builds the Firestore save payload and the shared
    snapshot itself. The state logic now lives in `utils/formationStates.js`; the save payload could move to
    a small service.
  - **`components/PlayerModal.jsx` and `screens/LandingPage.jsx`** are slightly over 800 lines.
