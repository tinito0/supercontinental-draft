# CLAUDE.md

Supercontinental Draft (SCL Draft): a private, real-time multiplayer draft/transfer-market PWA for a friends'
football league, plus an in-browser editor for the eFootball PES 2021 database, save file and kits.
UI text is Spanish (Rioplatense); code, comments and docs are mostly English (older files mix in Spanish).

`README.md` is partly stale (no Supabase, no `pes/`, lists deps that are gone). Trust these instead:
- `docs/ARCHITECTURE.md` — layers, kit viewer and formation editor data flow, known structural risks
- `docs/PES_ENGINE.md` — binary formats, field evidence, roles, setup, export, limitations
- `docs/DESIGN_SYSTEM.md` — tokens, UI primitives, layout and copy rules (read before any UI work)

## Commands

```bash
npm run dev          # Vite dev server, http://localhost:5173
npm run build        # production build to dist/
npm test             # vitest run (unit + PES engine; excludes tests/rules and vendor/)
npx vitest run tests/pes/kits.test.js   # single file
npm run test:rules   # Firestore rules tests on the emulator (needs Java 21: export JAVA_HOME="$USERPROFILE/.jdks/jdk-21.0.12.1+1"; PATH="$JAVA_HOME/bin:$PATH")
npm run pes:claims   # dry run; `-- --apply` with GOOGLE_APPLICATION_CREDENTIALS sets pes_role custom claims
firebase deploy                          # hosting (dist/) + rules; project supercont-d62df
firebase deploy --only firestore:rules
```

There is no linter or type checker; plain JS/JSX, ES modules. Env vars: copy `.env.example` to `.env`
(Firebase `VITE_FIREBASE_*`; Supabase vars are only needed for PES textures).

## Architecture

| Layer | Where | Notes |
| --- | --- | --- |
| Entry | `main.jsx` → `app.jsx` | `BrowserRouter` + `ErrorBoundary`; Chart.js registered lazily |
| App shell | `app.jsx` (~2,900 lines) | routing, Firestore subscriptions, market logic, modal wiring. Widest blast radius in the repo |
| Screens | `screens/` | Landing, Login, LinkGoogle, Maintenance, TeamScreen, FormationViewScreen, PesWorkspaceScreen |
| Components | `components/` | feature modals at top level; `ui/` primitives; `admin/`, `tournament/`, `formation/`, `pes/` |
| Hooks | `hooks/` | `useAuth`, `useFirebaseData` (listeners), `useBudget`, `useRemoteConflict`, `usePesWorkspace`, … |
| Services | `services/`, `config/` | `firebase.js` (Auth, Firestore with persistent multi-tab cache, Storage), `supabase.js` |
| Pure helpers | `utils/` | `constants.js` (positions, formations, `APP_ID`), `helpers.js`, `formationStates.js`, `pesExport.js`, … |
| PES engine | `pes/` | pure, no React, no Firebase: `core` → `formats/pes2021` → `operations.js`, `kits/`, `draftTransfer.js` |

**Routing** is not declared with `<Route>`: `app.jsx` derives the active tab from `location.pathname` via the
path↔tab maps near line 235 (`/overview`, `/marketplace`, `/my-team`, `/tactics`, `/admin`, `/pes`, …).
Modals are routes too (`/modal/<name>`, returning to `location.state.from`). Public, unauthenticated views:
`/`, `/login`, `/team/:id`, `/tactics/view/:id`, `/torneo`, `/overlay…`, and query modes `?mode=obs|table|bracket`.
Screens and heavy modals are `React.lazy`; a `vite:preloadError` reloads the page after a deploy.

**Firestore layout** (paths are built as strings, so the graph does not link readers of the same data):
- `artifacts/${APP_ID}/public/data/{player_locks,teams,transfers,offers,manager_chat,shared_formations,suggestions,news,tournament,broadcast,config,locks}`
- `artifacts/${APP_ID}/presence/{uid}`, `artifacts/${APP_ID}/users/{uid}/{cart,profile/data,…}`
- `pes_roles/{uid}`, `pes_workspaces/{wsId}/{ops,exports,meta}`
- `APP_ID` comes from `utils/constants.js`, not from the Firebase config.
- `services/draftTeamsService.js` is the single team loader used by both PES exports. Reuse it; do not add another.

**Auth/roles:** Firebase Auth (email/password + Google, with a legacy-account linking flow). App admin is a
profile flag (`isAdmin`/`role: 'admin'`) in `hooks/useAuth.js`. In `firestore.rules` it is a hardcoded UID or an `admin`
claim. PES roles (super_admin / draft admin / kit manager) are checked three times: `pes/permissions.js`
`authorize()`, `firestore.rules`, and Supabase Storage policies (`supabase/storage-policies.sql`).
`tests/pes/rulesSync.test.js` fails if the rules' op/field lists drift from the engine's. Update both together.

**Market** (see `docs/MARKET_FUNCTION.md`): signing, releasing a player and accepting a transfer run on the server, in the
Supabase Edge Function `market` (`supabase/functions/`), which verifies the Firebase ID token, reads real prices
from `supabase/functions/_shared/catalog.json` and writes Firestore over REST with a service account. The app calls
it through `services/marketService.js`. `firestore.rules` therefore reject from the browser: any lock or feed
write, `budget`/`inWhitelist`/`isAdmin`/`role`/franchise flags, and offers moving to `accepted`.
`teams/{uid}.budget` is the authoritative base budget. `player_locks` is the only ownership record: carts are
private copies kept in line by `hooks/useSquadSync.js`, and the budget (`supabase/functions/_shared/budget.js`,
shared by app and function) and both exports (`services/draftTeamsService.js`) read squads from locks. Offers follow turns (`buildOfferUpdate` in `services/transferService.js` =
`isOfferTransition` in the rules): `pending` is answered by the seller, `countered` by the buyer.
- `supabase/functions/_shared/` must not import from outside `supabase/functions` (only that folder is deployed);
  `marketConstants.js` copies `utils/constants.js` and `tests/marketFunction.test.js` fails if they drift.
- After changing `public/jugadores.json`: `node scripts/build-market-catalog.mjs`, then redeploy the function.
  The app loads the gitignored `public/jugadores.compact.json` (built by `predev`/`prebuild`, or by hand with
  `node scripts/build-players-compact.mjs`; it falls back to `jugadores.json` if the compact file is missing).
- Firestore emulator REST quirk: a transactional single-document `GET ?transaction=` never answers; the REST
  client uses `documents:batchGet`.

**Supabase** is used only for PES texture and source files in Storage. There is no Supabase login: the client
passes the Firebase ID token (Third-Party Auth). Call `refreshFirebaseClaims()` after claims change.

**PES working copy** = original sources (IndexedDB, keyed by SHA-256, never modified) + saved operations
(Firestore, shared, payloads stored as JSON strings because Firestore rejects nested arrays) + drafts (IndexedDB,
per browser). Never store binaries in Firestore or localStorage.

## Conventions

- Follow `docs/DESIGN_SYSTEM.md`: page skeleton `<Page>` → `<PageHeader>`, primitives from `components/ui`
  (`Button`, `Field`, `Alert`, `EmptyState`, `Tabs`, `Stat`, `BaseModal`), crest blue as the only accent, mobile first
  at 360px, touch targets ≥ 44px. Reuse `getPosColorClass`, `getStatAndOvrColorClass` and `Pitch` instead of new styling.
- Player photos are `/fotos_jugadores/{Id}.webp`; the marketplace data is `public/jugadores.json`, generated by
  `scripts/main.py` from `jugadores_exportados.csv`. Its ids must stay identical to Player.bin.
- Formation state goes through `utils/formationStates.js` and `utils/advancedInstructions.js`. Legacy profiles
  without `formationStates` must keep normalising to the plain layout and export exactly as before.
- Writes of whole nested maps (formation, lineup, dorsals, …) use `{ mergeFields: [...] }`, not `{ merge: true }`:
  merge deep-merges maps, so removed keys (a reset position, a removed starter) would never be deleted.
- PES layout tables (`pes/formats/pes2021/binLayout.js`) are generated by `pes/tools/gen_layout.cjs`; regenerate,
  don't hand-edit. Fields marked `unverified`/`partial` stay read-only. Edits must only touch the edited field's bits.
- Tests use Vitest with `globals: true`, in `tests/` mirroring the source (`tests/pes/…`). PES tests that need real
  game files (`vendor/`, or the kit-server at `PES_KIT_SERVER`) skip when the files are missing. Synthetic fixtures only
  prove encode/decode symmetry, never game compatibility. Say which kind a test uses.
- Nothing in the PES editor is verified in-game. Don't claim game compatibility.

## Gotchas

- `vendor/` holds game files, an `EDIT00000000` that contains a Steam ID, and third-party tools. It is gitignored. Never commit it.
- On Windows, a shell whose cwd is inside `dist/` locks it and `npm run build` fails with EBUSY.
- `firestore.rules` changes need `npm run test:rules` and an explicit deploy. The catch-all
  `match /{document=**}` gives the app admin unrestricted writes on purpose. Don't widen other rules to "fix" access.
- `app.jsx`, `components/FormationModal.jsx` and `components/PlayerModal.jsx` are over 800 lines. Prefer extracting
  hooks/components over growing them.
- The public landing (`screens/LandingPage.jsx` + `components/landing/`) shows hardcoded sample players and the
  league's channels (from its Linktree, `leagueLinks.js`). `tests/landingSampleData.test.js` fails when the samples
  drift from `public/jugadores.json` or `utils/pesExport.js`; update `sampleData.js` after regenerating the market.
- Stray files exist (`components/temp.txt`, `components/test.txt`, `components/replace.js`, `scripts/Untitled-1.py`).
  Don't treat them as live code.
- A knowledge graph lives in `graphify-out/`. Query it before broad searches (`graphify query "<q>"`) and run
  `graphify update .` after code changes. It misses string-path Firestore coupling, `.sql`, rules and CSS.
