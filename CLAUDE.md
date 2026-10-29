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
git push origin master                   # production deploy: Vercel builds and publishes master
firebase deploy --only firestore:rules   # rules only; project supercont-d62df
```

**Hosting is Vercel** (`https://supercontinental-draft.vercel.app`), deployed by its Git integration on every push to
`master`. `vercel.json` holds headers, redirects and the SPA fallback; with `cleanUrls` the fallback must rewrite to
`/`, not `/index.html` (that 404s every route). Don't deploy with the Vercel CLI: the build (~44k files, mostly
`fotos_jugadores`) exceeds its upload limits. The `VITE_*` env vars live in the Vercel project settings. Firebase
still provides Auth, Firestore, rules and Storage; Firebase Hosting (`supercont-d62df.web.app`) is a frozen
pre-migration build, so don't deploy hosting there. If the site domain changes, update `SITE_URL` in
`utils/sharePages.js`, the canonical/`og:` tags in `index.html`, `LEGACY_HOSTS` in `utils/overlayPopup.js`, the
Firebase Auth authorized domains and the Supabase secrets `MARKET_ALLOWED_ORIGINS`, `COMMUNITY_ALLOWED_ORIGINS` and
`OVERLAY_SITE_URL`.

There is no linter or type checker; plain JS/JSX, ES modules. Env vars: copy `.env.example` to `.env`
(Firebase `VITE_FIREBASE_*`; Supabase vars are only needed for PES textures).

## Architecture

| Layer | Where | Notes |
| --- | --- | --- |
| Entry | `main.jsx` → `app.jsx` | `BrowserRouter` + `ErrorBoundary`; Chart.js registered lazily |
| App shell | `app.jsx` (~2,900 lines) | routing, Firestore subscriptions, market logic, modal wiring. Widest blast radius in the repo |
| Screens | `screens/` | Landing, Login, LinkGoogle, TeamScreen, FormationViewScreen, PesWorkspaceScreen. A closed market is read-only (`MarketClosedBanner`), not a screen |
| Components | `components/` | feature modals at top level; `ui/` primitives; `admin/`, `tournament/`, `formation/`, `pes/` |
| Hooks | `hooks/` | `useAuth`, `useFirebaseData` (listeners), `useBudget`, `useSquadSync`, `usePresence`, `usePesWorkspace`, … |
| Services | `services/`, `config/` | `firebase.js` (Auth, Firestore with persistent multi-tab cache, Storage), `supabase.js` |
| Pure helpers | `utils/` | `constants.js` (positions, formations, `APP_ID`), `helpers.js`, `formationStates.js`, `pesExport.js`, … |
| PES engine | `pes/` | pure, no React, no Firebase: `core` → `formats/pes2021` → `operations.js`, `kits/`, `draftTransfer.js` |

**Two sites, one page** (`main.jsx`, `utils/siteRoutes.js`): the root is the public **league site**
(`screens/league/`, `components/league/`, data from `hooks/useLeagueData.js`: `/`, `/historia`, `/equipos`,
`/equipos/:userId` = club history + `screens/TeamScreen.jsx`, `/reglamento` (season rules), `/torneo`, `/partidos` = PES match centre from `live_matches`, docs/MATCH_FEED.md). Its texts
(league history, club histories, season rules) are plain text written in Administración → Web pública
(`components/admin/LeagueContentAdminSection.jsx`, `utils/leagueContent.js`). The **draft** lives under `/draft`, mounted with
`<BrowserRouter basename="/draft">`; nothing on the league site links to it (managers type `/draft`, `/DRAFT` is
normalised). Inside the draft every path below is relative to `/draft`; URLs that are copied or shared must go
through `draftUrl()`. Old draft URLs redirect: paths in `vercel.json` `redirects`, query modes
(`/?mode=obs`, `/torneo?mode=…`) in `legacyDraftRedirect()`. The two public fronts share
`components/landing/SiteChrome.jsx` (nav, footer, section titles), `RuleGroups.jsx` and `FollowLeague.jsx`.

**Draft routing** is not declared with `<Route>`: `app.jsx` derives the active tab from `location.pathname` via the
path↔tab maps near line 235 (`/overview`, `/marketplace`, `/my-team`, `/tactics`, `/admin`, `/pes`, …).
Modals are routes too (`/modal/<name>`, returning to `location.state.from`). Public, unauthenticated draft views:
`/` (draft landing), `/login`, `/team/:id`, `/tactics/view/:id`, `/torneo`, `/overlay…`, and query modes
`?mode=obs|table|bracket`, all under `/draft`.
Screens and heavy modals are `React.lazy`; a `vite:preloadError` reloads the page after a deploy.

**Firestore layout** (paths are built as strings, so the graph does not link readers of the same data):
- `artifacts/${APP_ID}/public/data/{player_locks,teams,transfers,offers,manager_chat,shared_formations,suggestions,news,tournament,broadcast,config,locks,league_content}`
- `artifacts/${APP_ID}/presence/{uid}`, `artifacts/${APP_ID}/users/{uid}/{cart,profile/data,…}`
- `pes_roles/{uid}`, `pes_workspaces/{wsId}/{ops,exports,meta}`
- `APP_ID` comes from `utils/constants.js`, not from the Firebase config.
- `services/draftTeamsService.js` is the single team loader used by both PES exports. Reuse it; do not add another.

**Auth/roles:** Firebase Auth (email/password + Google, with a legacy-account linking flow). A new account's team
starts with `approved: false` and waits on `PendingApprovalScreen` until the admin approves it; teams without the
field count as approved (`supabase/functions/_shared/membership.js`, enforced by the market function and rules). App admin is a
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
- `scripts/Untitled-1.py` is an unrelated personal script, not part of the app.
- A knowledge graph lives in `graphify-out/`. Query it before broad searches (`graphify query "<q>"`) and run
  `graphify update .` after code changes. It misses string-path Firestore coupling, `.sql`, rules and CSS.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.claude/skills/antislop/SKILL.md`
- Code comments: `antislop-code`: `.claude/skills/antislop-code/SKILL.md`
- UI / visual: `antislop-ui`: `.claude/skills/antislop-ui/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.claude/skills/antislop-layoutmobile/SKILL.md`
- People: `antislop-human`: `.claude/skills/antislop-human/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->
