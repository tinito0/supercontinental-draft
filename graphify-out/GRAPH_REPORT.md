# Graph Report - PROGRAMA SUPER2  (2026-10-16)

## Corpus Check
- 371 files · ~24,085,942 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 3, .css 3, .csv 2)

## Summary
- 2245 nodes · 6312 edges · 146 communities (106 shown, 40 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68c91ed9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PesWorkspaceScreen.jsx
- teamView.js
- app.jsx
- pes/index.js
- os
- firebase
- Layout Generation Scripts
- permissions.js
- draftTransfer.js
- helpers.js
- market.js
- LandingPage.jsx
- react
- **SuperContinental League™ — Brand Voice Guidelines**
- DEFAULT_LOGO
- marketRules.test.js
- ScoutAssignmentsPanel.jsx
- index.ts
- kitWorkspace.js
- loadKitTextures.js
- playerCatalog.test.js
- TransferFeed.jsx
- OverlayAdminSection.jsx
- usePesWorkspace.js
- PesFormatError
- README.md
- KitViewerPanels.jsx
- bracketModel.js
- dependencies
- readField
- Changelog
- pesTextureStorage.js
- RESUMEN REUNION.md
- kitDecalFormulas.js
- package.json
- Supabase
- firestoreRest.js
- squadSync.test.js
- Changelog
- Writing Guidelines for Postgres References
- rules/marketFunction.test.js
- FormationModal.jsx
- PesKit3DViewer.jsx
- vitest
- PES 2021 database & kit engine
- IdentitySection.jsx
- devDependencies
- PWA Manifest
- TournamentModal.jsx
- PlatformDemo.jsx
- scripts
- PES Claims Sync
- NotificationsPanel.jsx
- usePesWorkspace
- kitConfig.js
- Section Definitions
- useKitAssets.js
- BaseModal
- lucide-react
- kitDecals.js
- MCP Config
- Service Worker
- Auditoría integral — Supercontinental Draft (14/10/2026)
- TournamentUI.jsx
- Third-party notices — PES engine
- Supabase Postgres Best Practices
- Caveman Mode — Antigravity Adaptation
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md
- team_budgets.md
- MarketplaceView.jsx
- FiltrosModal.jsx
- Función del mercado (Supabase Edge Function `market`)
- transferService.js
- binDatabase.js
- simulate_t3.py
- editDatabase.js
- TopHeader.jsx
- tournamentEngine.js
- calcular_modificadores_meta
- main.py
- FollowLeague.jsx
- procesar_datos_para_json
- kitModels.js
- PesValidationError
- Auditoría integral — Supercontinental Draft (15/10/2026)
- useAuth.js
- generador.py
- Simulación T3
- ManagerChat.jsx
- useScrollRestore.test.js
- ComparisonModal.jsx
- budgetCalculations.test.js
- Animaciones y microinteracciones — auditoría (16/10/2026)
- broadcastRender.test.jsx
- TutorialModal.jsx
- firebase.js
- getStatAndOvrColorClass
- parseOpenTime
- prefetch.js
- recommendations.js
- react-router-dom
- Supercontinental Draft — design system
- sessionHint.test.js
- PesTeamWorkspace.jsx
- TeamList.jsx
- StadiumSection.jsx
- kitRenderer.test.js
- AdminModal.jsx
- exportService.js
- constants.js
- marketConstants.js
- ErrorBoundary
- LoadingScreen

## God Nodes (most connected - your core abstractions)
1. `react` - 141 edges
2. `lucide-react` - 83 edges
3. `App()` - 64 edges
4. `vitest` - 60 edges
5. `PesValidationError` - 57 edges
6. `getStatAndOvrColorClass()` - 45 edges
7. `usePesWorkspace()` - 41 edges
8. `getPosColorClass()` - 41 edges
9. `formatPriceShort()` - 38 edges
10. `BaseModal()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `A. Lo que hay hoy` --references--> `BaseModal()`  [INFERRED]
  docs/ANIMACIONES-2026-10-16.md → components/ui/BaseModal.jsx
- `D. Sistema de movimiento (chico y justificado)` --references--> `BaseModal()`  [INFERRED]
  docs/ANIMACIONES-2026-10-16.md → components/ui/BaseModal.jsx
- `F. Hoja de ruta` --references--> `BaseModal()`  [INFERRED]
  docs/ANIMACIONES-2026-10-16.md → components/ui/BaseModal.jsx
- `B. Animaciones recomendadas (por prioridad)` --references--> `Spinner()`  [INFERRED]
  docs/ANIMACIONES-2026-10-16.md → components/ui/Spinner.jsx
- `5. Authorization` --references--> `authorize()`  [INFERRED]
  docs/PES_ENGINE.md → pes/permissions.js

## Import Cycles
- None detected.

## Communities (146 total, 40 thin omitted)

### Community 0 - "PesWorkspaceScreen.jsx"
Cohesion: 0.06
Nodes (82): modifiedKeys(), opKey(), PesAddKit(), describe(), fmt(), OpRow(), PesChangesPanel(), TYPE_LABEL (+74 more)

### Community 1 - "teamView.js"
Cohesion: 0.20
Nodes (24): from6bit(), kitPreviewModel(), kitCategory(), abbreviationOps(), assignmentOwners(), binTeams(), cleanAbbreviation(), countryOps() (+16 more)

### Community 2 - "app.jsx"
Cohesion: 0.06
Nodes (44): ALL_DETAILED_STAT_KEYS, App(), CartModal, CommandPalette, ComparisonModal, FiltrosModal, FirebaseError(), FormationModal (+36 more)

### Community 3 - "pes/index.js"
Cohesion: 0.16
Nodes (34): EXTS, FontGenerator(), FontLibrary(), PesKitTextures(), SlotRow(), slotStatus(), STATUS, inspectFtex() (+26 more)

### Community 4 - "os"
Cohesion: 0.24
Nodes (6): calculate_budgets(), get_avg_price_for_ovr(), load_players(), limpiar_fotos_huerfanas(), main(), update_playlist()

### Community 5 - "firebase"
Cohesion: 0.13
Nodes (23): commitBatchOperations(), FIRESTORE_BATCH_LIMIT, GeneralAdminSection, ACCESS_FILTERS, TeamsAdminSection, firebase, FakeTimestamp, tournament (+15 more)

### Community 6 - "Layout Generation Scripts"
Cohesion: 0.07
Nodes (26): content, fs, fs, out, src, A, C, camel() (+18 more)

### Community 7 - "permissions.js"
Cohesion: 0.14
Nodes (17): PesPermissionError, KIT_EDITABLE_KEYS, TEXTURE_SLOT_IDS, authorize(), can(), capabilitiesOf(), EDIT_TEAM_KIT_FIELDS, OP_TYPES (+9 more)

### Community 8 - "draftTransfer.js"
Cohesion: 0.20
Nodes (18): abbreviationOf(), binSquadSize(), binStrategyFromTactics(), clamp(), clubRowsOf(), enc, fitBytes(), idOf() (+10 more)

### Community 9 - "helpers.js"
Cohesion: 0.14
Nodes (18): TeamScreen, getPosRank(), OVR_COLOR_THRESHOLDS, POS_COLOR, POS_RANK, TeamScreen(), COUNTRY_CODE_MAP, REGION_COUNTRIES (+10 more)

### Community 10 - "market.js"
Cohesion: 0.33
Nodes (14): toUnits(), isFranchiseEligible(), acceptOffer(), appendHistory(), getCatalogPlayer(), getCommittedFunds(), handleMarketAction(), isMarketOpen() (+6 more)

### Community 11 - "LandingPage.jsx"
Cohesion: 0.24
Nodes (15): FollowLeague(), SocialLinks(), PlatformDemo(), PlayerMarquee(), PlayerTile, Reveal(), SHOWCASE_PLAYERS, Button (+7 more)

### Community 12 - "react"
Cohesion: 0.11
Nodes (36): Conventions, CartModal, CLOSED_STATUSES, getOfferSenderName(), getOfferStatusLabel(), getOfferTargetName(), NegotiationCard, OfferTimeline (+28 more)

### Community 13 - "**SuperContinental League™ — Brand Voice Guidelines**"
Cohesion: 0.09
Nodes (22): **1\. Rigurosos**, **2\. Auténticos entre amigos**, **3\. Prolijos en la forma, no en el fondo**, **4\. Transparentes**, **5\. Ambiciosos con la producción**, **Así no**, **Así sí**, **Brand Personality** (+14 more)

### Community 14 - "DEFAULT_LOGO"
Cohesion: 0.29
Nodes (12): LeagueTableView, BracketFork, MatchCard, EDIT_FIELDS, MatchCenter, StatsView, TeamSelect, TournamentTeamsContext (+4 more)

### Community 15 - "marketRules.test.js"
Cohesion: 0.36
Nodes (7): acceptBatch(), cart(), lock(), offer(), profile(), team(), TRANSFER_FEE_RATE

### Community 16 - "ScoutAssignmentsPanel.jsx"
Cohesion: 0.17
Nodes (19): ScoutAssignmentsPanel, attentionOptions, DEFAULT_SCOUTS, getMonthKey(), getTimeLeft(), initialCriteria, makeCriteriaFingerprint(), SCOUT_TUTORIAL_STEPS (+11 more)

### Community 17 - "index.ts"
Cohesion: 0.15
Nodes (12): jose, allowedOrigins, corsHeaders(), firestore, keySet, reply(), serviceAccount, createServiceAccountTokenProvider() (+4 more)

### Community 18 - "kitWorkspace.js"
Cohesion: 0.16
Nodes (10): parseKitMap(), parseKitOrder(), serializeKitConfig(), TEXTURE_KEYS, insertInOrder(), KIT_SERVER_PREFIX, KitWorkspace, norm() (+2 more)

### Community 19 - "loadKitTextures.js"
Cohesion: 0.10
Nodes (23): glossFromAlpha(), assetCache, decode(), decoded, loadKitTextures(), MAX_WIDTH, ASSET_SLOTS, AssetCache (+15 more)

### Community 20 - "playerCatalog.test.js"
Cohesion: 0.08
Nodes (27): buildMarketCatalog(), root, source, target, compact, players, root, source (+19 more)

### Community 21 - "TransferFeed.jsx"
Cohesion: 0.35
Nodes (9): getInitials(), getTransferTime(), TeamVisual, TransferCard, TransferFeed, TransferSkeleton, getOvrBadgeClass(), TeamLogo (+1 more)

### Community 22 - "OverlayAdminSection.jsx"
Cohesion: 0.16
Nodes (29): BroadcastMatchPicker, MatchRow, STATUS_FILTERS, TeamCell(), teamLogoFor(), OnAirTeam(), OVERLAY_FIELDS, OverlayAdminSection (+21 more)

### Community 23 - "usePesWorkspace.js"
Cohesion: 0.19
Nodes (18): clearDraft(), connect(), del(), deleteSource(), get(), getAsset(), getDraft(), getSource() (+10 more)

### Community 24 - "PesFormatError"
Cohesion: 0.08
Nodes (37): PesFormatError, adler32(), isWesys(), MAGIC, WESYS_HEADER_SIZE, decryptEdit(), alphaBlock(), c565() (+29 more)

### Community 25 - "README.md"
Cohesion: 0.06
Nodes (31): 1. Clonar el repositorio, 2. Instalar dependencias, 3. Configurar variables de entorno, 4. Iniciar servidor de desarrollo, 5. Build para producción, 6. Deploy a Firebase, 🏗️ Arquitectura del proyecto, 🔐 Autenticación (+23 more)

### Community 26 - "KitViewerPanels.jsx"
Cohesion: 0.21
Nodes (17): LIGHT_PRESETS, AssetRow(), DiagnosticsPanel(), FabricPanel(), FolderControls(), FONT_SLOTS, LetteringPanel(), LEVEL (+9 more)

### Community 27 - "bracketModel.js"
Cohesion: 0.14
Nodes (27): BracketBoard, BroadcastBracket, BroadcastMatchCard, TeamRow(), TONE_STROKES, boardWidth(), CupBracketView, TONE_STYLES (+19 more)

### Community 28 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, chart.js, fflate, firebase, @fontsource/barlow, @fontsource/barlow-condensed, html2canvas, jspdf (+9 more)

### Community 29 - "readField"
Cohesion: 0.16
Nodes (11): readField(), writeField(), BIN_TABLES, fieldMap(), RecordTable, binIssues(), editIssues(), issue() (+3 more)

### Community 30 - "Changelog"
Cohesion: 0.10
Nodes (20): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), [0.1.8](https://github.com/supabase/agent-skills/compare/v0.1.7...supabase-v0.1.8) (2026-09-24), [0.1.9](https://github.com/supabase/agent-skills/compare/v0.1.8...supabase-v0.1.9) (2026-09-28), Bug Fixes (+12 more)

### Community 31 - "pesTextureStorage.js"
Cohesion: 0.17
Nodes (26): refreshFirebaseClaims(), sha256Hex(), replayOperations(), buildWorkspace(), classifyFiles(), KNOWN_BIN, pathOf(), readSources() (+18 more)

### Community 32 - "RESUMEN REUNION.md"
Cohesion: 0.20
Nodes (9): 1\. Formato de Competencia y Estructura del Torneo, 2\. Mercado de Pases, Presupuestos y Regulación de Planteles, 3\. Dinámica del Draft (Jugadores Especiales / Promesas), 4\. Logística, Sede y Fechas, 5\. Puntos Pendientes / Acciones Inmediatas, A. Opción 1: Formato en 2 Zonas (Estilo Copa de la Liga), B. Opción 2: Mantener el Formato Anterior (Liga / Sistema Suizo), C. Copa de Plata (+1 more)

### Community 33 - "kitDecalFormulas.js"
Cohesion: 0.23
Nodes (13): decalLayout(), gameFloat(), gameValue(), maxStep(), NAME_CANVAS, NAME_GLYPH_TABLE, NAME_GLYPHS, NAME_RADIUS (+5 more)

### Community 34 - "package.json"
Cohesion: 0.12
Nodes (16): name, private, type, version, autoprefixer, html2canvas, jspdf, jspdf-autotable (+8 more)

### Community 35 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 36 - "firestoreRest.js"
Cohesion: 0.28
Nodes (10): createFirestore(), createTransaction(), request(), runTransaction(), FirestoreRestError, OPERATORS, decodeFields(), decodeValue() (+2 more)

### Community 37 - "squadSync.test.js"
Cohesion: 0.36
Nodes (8): useSquadSync(), catalog, buildPublicRoster(), isSameRoster(), ownedLockEntries(), reconcileCart(), ROSTER_KEYS, rosterEntry()

### Community 38 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 39 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 40 - "rules/marketFunction.test.js"
Cohesion: 0.23
Nodes (11): @firebase/rules-unit-testing, accept(), call(), catalog, firestore, read(), readAll(), seed() (+3 more)

### Community 41 - "FormationModal.jsx"
Cohesion: 0.05
Nodes (93): TemplateAdminSection, AdvancedInstructionsPanel, SIDE_META, PositionPicker, TacticalStateBar, dedupeLineup(), FormationModal, formationReducer() (+85 more)

### Community 42 - "PesKit3DViewer.jsx"
Cohesion: 0.20
Nodes (19): CollarPicker(), fabricPreview(), fabricTextures(), kitPixels(), pixelsToCanvas(), KitEnv, KitGL, lightState() (+11 more)

### Community 43 - "vitest"
Cohesion: 0.09
Nodes (35): encodeWesys(), loadEditDatabase(), readTeamTactics(), tacticsIdsOfTeam(), validateTeamTactics(), writeTeamTactics(), formationRowKey(), vitest (+27 more)

### Community 44 - "PES 2021 database & kit engine"
Cohesion: 0.14
Nodes (13): 1. Supported input (explicit), 2. Investigation summary, 3. Field evidence (`pes/formats/pes2021/binLayout.js`), 4. Architecture, 4b. Draft → PES (`pes/draftTransfer.js`, tab "Draft → PES"), 4c. Shared sources, 4d. Kits: 3D preview, fabric maps, new kits, 5. Authorization (+5 more)

### Community 45 - "IdentitySection.jsx"
Cohesion: 0.24
Nodes (13): ColourField(), ColourGroup(), EXTRA_NAME_FIELDS, IdentitySection(), LanguageNames(), lockedHelp(), OriginGroup(), coachNameOfTeam() (+5 more)

### Community 46 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, autoprefixer, fake-indexeddb, firebase-admin, @firebase/rules-unit-testing, jose, @opentelemetry/api, postcss (+4 more)

### Community 47 - "PWA Manifest"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 48 - "TournamentModal.jsx"
Cohesion: 0.21
Nodes (11): BracketView, OBS_CONTENT_SCALE, OBS_STAGE, ObsStage(), TournamentModal, COLOR_MAP, SIZE_MAP, Spinner() (+3 more)

### Community 49 - "PlatformDemo.jsx"
Cohesion: 0.13
Nodes (19): formatPrice(), MarketPanel(), PANELS, pitchName(), PitchPanel(), TAB_INTRO, TABS, TacticList() (+11 more)

### Community 50 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, pes:claims, prebuild, predev, preview, test (+2 more)

### Community 51 - "PES Claims Sync"
Cohesion: 0.29
Nodes (6): firebase-admin, APPLY, auth, changes, db, roles

### Community 52 - "NotificationsPanel.jsx"
Cohesion: 0.60
Nodes (4): getTypeConfig(), NotificationItem, NotificationsPanel, TYPE_CONFIG

### Community 53 - "usePesWorkspace"
Cohesion: 0.17
Nodes (24): usePesAccess(), readActive(), usePesWorkspace(), writeActive(), clean(), createWorkspace(), decodeOp(), deleteWorkspace() (+16 more)

### Community 54 - "kitConfig.js"
Cohesion: 0.16
Nodes (21): KitFont, parseKitConfig(), parseRangeComment(), setKitValue(), validateKitValue(), BADGE_KEYS, describeConstraint(), isBadgeOff() (+13 more)

### Community 55 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 56 - "useKitAssets.js"
Cohesion: 0.23
Nodes (17): canPickFolder(), filesReader(), handleReader(), idb(), kitServerReader(), pickGameFolder(), readerFromFiles(), rememberedGameFolder() (+9 more)

### Community 57 - "BaseModal"
Cohesion: 0.13
Nodes (16): SuggestionsModal, SIZE_MAP, VARIANT_MAP, BaseModal(), openDialogs, SIZE_MAP, ConflictBanner, KeyboardShortcutsHelp() (+8 more)

### Community 58 - "lucide-react"
Cohesion: 0.19
Nodes (16): AuthLayout(), Brand(), GoogleButton(), TeamSaveBar(), Alert(), TONES, IconButton, SIZES (+8 more)

### Community 59 - "kitDecals.js"
Cohesion: 0.31
Nodes (13): composeKitTexture(), drawCell(), drawDigits(), drawName(), fallbackKitTexture(), FONT_LABEL, fontNote(), digitCell() (+5 more)

### Community 64 - "Auditoría integral — Supercontinental Draft (14/10/2026)"
Cohesion: 0.22
Nodes (8): 1. Qué se ejecutó, 3. Pendiente — requiere decisión o trabajo mayor, 4. Dependencias, 5. No verificado, Alta, Auditoría integral — Supercontinental Draft (14/10/2026), Baja, Media

### Community 65 - "TournamentUI.jsx"
Cohesion: 0.19
Nodes (10): BroadcastOverlay, DEFAULT_BROADCAST_OVERLAY, getTeam(), SCENE_LABELS, StatRows(), TOURNAMENT_THEME, tournamentBackdropClass, tournamentControlClass (+2 more)

### Community 66 - "Third-party notices — PES engine"
Cohesion: 0.29
Nodes (6): bcdec (Sergii Kudlai) — MIT / public domain, Libraries, PES 2020 Editor V0.12.8 by Ejogc327, PES Editor Rebuilt (BSD 3-Clause), Third-party notices — PES engine, Upstream work carried through PES Editor Rebuilt

### Community 67 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 68 - "Caveman Mode — Antigravity Adaptation"
Cohesion: 0.40
Nodes (4): Caveman Mode — Antigravity Adaptation, Levels, Persistence, Rules

### Community 102 - "MarketplaceView.jsx"
Cohesion: 0.16
Nodes (16): FranchiseMarketNotice(), MarketplaceView(), ResultsSkeleton(), CARD_INFO_ESTIMATE, lockInfo(), useScrollMargin(), VirtualPlayerResults(), PlayerPreview() (+8 more)

### Community 103 - "FiltrosModal.jsx"
Cohesion: 0.14
Nodes (21): filterColors, FilterSection(), FiltrosModal, RangeInputs(), RANGES, ToggleButton, ActiveFilterChips(), numberFormat (+13 more)

### Community 104 - "Función del mercado (Supabase Edge Function `market`)"
Cohesion: 0.40
Nodes (4): Función del mercado (Supabase Edge Function `market`), Mantenimiento, Probar localmente, Puesta en marcha (una vez)

### Community 105 - "transferService.js"
Cohesion: 0.44
Nodes (9): appendHistory(), applyOfferAction(), buildOfferUpdate(), counterTransferOffer(), getOfferAmount(), OFFER_ACTIONS, rejectTransferOffer(), withdrawTransferOffer() (+1 more)

### Community 106 - "binDatabase.js"
Cohesion: 0.13
Nodes (20): fieldByteSpan(), decodeWesys(), baseName(), FORMAT_ID, loadBinDatabase(), PASSTHROUGH_FILES, spanOf(), ASSIGNMENT_FIELDS (+12 more)

### Community 107 - "simulate_t3.py"
Cohesion: 0.23
Nodes (8): cargar_jugadores(), contar_por_posicion(), costo_banco(), generar_reporte(), main(), mejor_xi(), precios_medianos(), presupuesto()

### Community 108 - "editDatabase.js"
Cohesion: 0.06
Nodes (34): cryptHeader(), cryptStream(), cstr(), decryptWith(), encryptEdit(), MASTER_KEYS, mersenne(), rol() (+26 more)

### Community 109 - "TopHeader.jsx"
Cohesion: 0.33
Nodes (10): BudgetMeter(), TopHeader, OnlineIndicator, FIVE_MINUTES_MS, getTimestampMillis(), HEARTBEAT_INTERVAL_MS, isPresenceActive(), isPresenceStale() (+2 more)

### Community 110 - "tournamentEngine.js"
Cohesion: 0.48
Nodes (5): buildAutomaticTournamentData(), buildAutomaticTournamentReport(), getMatchesWithNewResults(), RESULT_FIELDS, ZERO_STATS

### Community 111 - "calcular_modificadores_meta"
Cohesion: 0.23
Nodes (5): calcular_modificadores_meta(), _columnas_numericas(), _desvios_contra_pares(), imprimir_control_precios(), _puntaje_por_posicion()

### Community 112 - "main.py"
Cohesion: 0.22
Nodes (7): calcular_modificador_edad(), calcular_modificador_edad_t2(), calcular_modificador_posicion(), calcular_modificador_reputacion_t2(), calcular_precio_t2(), calcular_precios(), calcular_valor_base_t2()

### Community 113 - "FollowLeague.jsx"
Cohesion: 0.39
Nodes (6): external, FEATURED_VIDEO, LEAGUE_NAME, LINKTREE_URL, SOCIAL_LINKS, STREAM_CHANNEL

### Community 114 - "procesar_datos_para_json"
Cohesion: 0.18
Nodes (4): cargar_lista_exclusion(), cargar_mapeo_paises(), normalizar_nombre(), procesar_datos_para_json()

### Community 115 - "kitModels.js"
Cohesion: 0.43
Nodes (6): loadPack(), collarName(), parseKitPack(), selectKitParts(), smoothNormals(), weldNormals()

### Community 116 - "PesValidationError"
Cohesion: 0.15
Nodes (21): PesValidationError, decoder, encoder, fieldRange(), validateFieldValue(), fabricOf(), FABRICS, fabricTile() (+13 more)

### Community 117 - "Auditoría integral — Supercontinental Draft (15/10/2026)"
Cohesion: 0.18
Nodes (10): 1. Qué se ejecutó, 2. Corregido en esta sesión (C1 + C3 + C2), 4. Pendiente — Media y baja (resumen), 5. Funcionalidades nuevas propuestas (por valor y esfuerzo), 6. Hoja de ruta, Auditoría integral — Supercontinental Draft (15/10/2026), C1: los traspasos no llegaban al plantel del comprador (CRÍTICO, CONFIRMADO), C2: ofertas con monto negativo saltaban el presupuesto (CRÍTICO, CONFIRMADO) (+2 more)

### Community 118 - "useAuth.js"
Cohesion: 0.15
Nodes (16): Architecture, Commands, Gotchas, 3. Pendiente — Alta, useAuth(), useFirebaseData(), computeSignature(), isDocumentDifferent() (+8 more)

### Community 120 - "Simulación T3"
Cohesion: 0.29
Nodes (6): Pool de Jugador Franquicia, Pool del Draft de promesas, Presupuesto por POV, Simulación T3, XI máximo con piso de banco 73, XI máximo con piso de banco 74

### Community 121 - "ManagerChat.jsx"
Cohesion: 0.47
Nodes (8): getMessageDate(), ManagerChat, getMentionedTeamIds(), getMentionHandle(), getTeamMentionOptions(), hasTransferIntent(), normalizeChatText(), transferWords

### Community 123 - "ComparisonModal.jsx"
Cohesion: 0.18
Nodes (14): barPercent(), ComparisonContent(), ComparisonModal, lastName(), RADAR_KEYS, RADAR_OPTIONS, SIDE, SkillList() (+6 more)

### Community 124 - "budgetCalculations.test.js"
Cohesion: 0.32
Nodes (8): Una sola cuenta de presupuesto para la app y el servidor (parte de H6), calculateBudget(), useBudget(), committedInOffers(), heldAmount(), isFranchiseLock(), spentOnLocks(), PRICES

### Community 125 - "Animaciones y microinteracciones — auditoría (16/10/2026)"
Cohesion: 0.09
Nodes (27): showAtOnce(), StatusAlert, TONES, SigningToast(), ToastFrame, ToastStack, A. Lo que hay hoy, Animaciones y microinteracciones — auditoría (16/10/2026) (+19 more)

### Community 126 - "broadcastRender.test.jsx"
Cohesion: 0.36
Nodes (5): OBS_SOURCE_GROUPS, ObsSources(), TournamentBroadcastAdminSection, TournamentSummary(), bracket

### Community 127 - "TutorialModal.jsx"
Cohesion: 0.47
Nodes (5): TutorialModal, APP_TUTORIAL_STEPS, getTooltipStyle(), TutorialModal, formatBudget()

### Community 128 - "firebase.js"
Cohesion: 0.23
Nodes (10): supabase, supabaseConfigured, TEXTURE_BUCKET, @supabase/supabase-js, acceptOffer(), callMarket(), loadMarketClient(), readFunctionError() (+2 more)

### Community 129 - "getStatAndOvrColorClass"
Cohesion: 0.13
Nodes (37): MiniPlayerCard, CartMiniPlayerCard, CommandPalette(), PlayerHeader(), FormationPlayerItem, brokenImageIds, PlayerCard, FIELD_STATS (+29 more)

### Community 130 - "parseOpenTime"
Cohesion: 0.53
Nodes (3): MaintenanceScreen, LEAGUE_UTC_OFFSET, parseOpenTime()

### Community 131 - "prefetch.js"
Cohesion: 0.40
Nodes (5): ./Foo.jsx, isPrefetchSafe(), makePrefetchable(), prefetchedKeys, schedulePrefetchOnIdle()

### Community 132 - "recommendations.js"
Cohesion: 0.40
Nodes (5): calculateSmartRecommendations(), getPlayerGroup(), GROUP_LABELS, GROUP_TARGETS, POS_GROUPS

### Community 133 - "react-router-dom"
Cohesion: 0.50
Nodes (4): LeftSidebar, NAV_GROUPS, NavItem(), react-router-dom

### Community 134 - "Supercontinental Draft — design system"
Cohesion: 0.40
Nodes (4): Don'ts, Pattern: entity editor (reference: `components/pes/team/`), Supercontinental Draft — design system, Tokens (`index.css` → `tailwind.config.js`)

### Community 136 - "PesTeamWorkspace.jsx"
Cohesion: 0.23
Nodes (10): accessNote(), headerMeta(), PesTeamWorkspace(), TEAM_SECTIONS, TeamDetail(), AdvancedSection(), ELSEWHERE, useMediaQuery() (+2 more)

### Community 137 - "TeamList.jsx"
Cohesion: 0.19
Nodes (15): inkOn(), luminance(), SIZES, TeamBadge(), TeamColourBand(), TeamHeader(), FILTERS, RowState() (+7 more)

### Community 138 - "StadiumSection.jsx"
Cohesion: 0.23
Nodes (12): Group(), CommitText(), enc, NameGroup(), BYTES, StadiumNumber(), StadiumSection(), TeamPicker() (+4 more)

### Community 139 - "kitRenderer.test.js"
Cohesion: 0.40
Nodes (3): LIGHT, MESH, scene

### Community 142 - "AdminModal.jsx"
Cohesion: 0.33
Nodes (9): AdminModal, SuggestionsAdminSection, ADMIN_TABS, AdminModal, ADMIN_TAB_IDS, LEGACY_TABS, normalizeAdminTab(), readStoredAdminTab() (+1 more)

### Community 144 - "exportService.js"
Cohesion: 0.27
Nodes (7): PesError, buildExport(), EDIT_PATH, PESDB_DIR, same(), verifyGenerated(), serializeBinDatabase()

### Community 145 - "constants.js"
Cohesion: 0.46
Nodes (5): FRANCHISE_MAX_OVR, FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, MAPEO_POS_ID, Z_INDEX

### Community 147 - "marketConstants.js"
Cohesion: 0.27
Nodes (8): FRANCHISE_RULE_TEXT, ADMIN_USER_IDS, APP_ID, FRANCHISE_MAX_OVR, FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, MAX_TRANSFER_MULTIPLIER, TRANSFER_FEE_RATE

### Community 148 - "ErrorBoundary"
Cohesion: 0.15
Nodes (4): ErrorBoundary, rootElement, @fontsource/barlow, @fontsource/barlow-condensed

### Community 149 - "LoadingScreen"
Cohesion: 0.50
Nodes (4): LoadingScreen(), 2. Corregido en esta auditoría, Otros arreglos, Seguridad del mercado — CRÍTICO, CONFIRMADO con requests falsificados en el emulador

## Knowledge Gaps
- **6 isolated node(s):** `html2canvas`, `@opentelemetry/api`, `autoprefixer`, `postcss`, `tailwindcss` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 714 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `PesWorkspaceScreen.jsx`, `getStatAndOvrColorClass`, `app.jsx`, `pes/index.js`, `parseOpenTime`, `firebase`, `react-router-dom`, `PesTeamWorkspace.jsx`, `TeamList.jsx`, `StadiumSection.jsx`, `LandingPage.jsx`, `helpers.js`, `AdminModal.jsx`, `DEFAULT_LOGO`, `ScoutAssignmentsPanel.jsx`, `constants.js`, `ErrorBoundary`, `TransferFeed.jsx`, `OverlayAdminSection.jsx`, `usePesWorkspace.js`, `KitViewerPanels.jsx`, `bracketModel.js`, `package.json`, `squadSync.test.js`, `FormationModal.jsx`, `PesKit3DViewer.jsx`, `IdentitySection.jsx`, `TournamentModal.jsx`, `PlatformDemo.jsx`, `NotificationsPanel.jsx`, `usePesWorkspace`, `useKitAssets.js`, `BaseModal`, `lucide-react`, `TournamentUI.jsx`, `MarketplaceView.jsx`, `FiltrosModal.jsx`, `TopHeader.jsx`, `FollowLeague.jsx`, `useAuth.js`, `ManagerChat.jsx`, `useScrollRestore.test.js`, `ComparisonModal.jsx`, `budgetCalculations.test.js`, `Animaciones y microinteracciones — auditoría (16/10/2026)`, `broadcastRender.test.jsx`, `TutorialModal.jsx`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **What connects `html2canvas`, `@opentelemetry/api`, `autoprefixer` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PesWorkspaceScreen.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `teamView.js`, `parseOpenTime`, `pes/index.js`, `firebase`, `permissions.js`, `sessionHint.test.js`, `helpers.js`, `TeamList.jsx`, `kitRenderer.test.js`, `AdminModal.jsx`, `marketRules.test.js`, `ScoutAssignmentsPanel.jsx`, `index.ts`, `loadKitTextures.js`, `playerCatalog.test.js`, `OverlayAdminSection.jsx`, `usePesWorkspace.js`, `bracketModel.js`, `kitDecalFormulas.js`, `package.json`, `squadSync.test.js`, `rules/marketFunction.test.js`, `FormationModal.jsx`, `PlatformDemo.jsx`, `kitConfig.js`, `BaseModal`, `MarketplaceView.jsx`, `FiltrosModal.jsx`, `transferService.js`, `binDatabase.js`, `TopHeader.jsx`, `tournamentEngine.js`, `PesValidationError`, `useAuth.js`, `useScrollRestore.test.js`, `budgetCalculations.test.js`, `Animaciones y microinteracciones — auditoría (16/10/2026)`, `broadcastRender.test.jsx`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Should `app.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06448979591836734 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `PesWorkspaceScreen.jsx`, `getStatAndOvrColorClass`, `app.jsx`, `pes/index.js`, `parseOpenTime`, `firebase`, `react-router-dom`, `PesTeamWorkspace.jsx`, `TeamList.jsx`, `helpers.js`, `LandingPage.jsx`, `react`, `AdminModal.jsx`, `DEFAULT_LOGO`, `ScoutAssignmentsPanel.jsx`, `ErrorBoundary`, `TransferFeed.jsx`, `OverlayAdminSection.jsx`, `KitViewerPanels.jsx`, `bracketModel.js`, `package.json`, `FormationModal.jsx`, `PesKit3DViewer.jsx`, `IdentitySection.jsx`, `TournamentModal.jsx`, `PlatformDemo.jsx`, `NotificationsPanel.jsx`, `BaseModal`, `MarketplaceView.jsx`, `FiltrosModal.jsx`, `TopHeader.jsx`, `FollowLeague.jsx`, `ManagerChat.jsx`, `ComparisonModal.jsx`, `Animaciones y microinteracciones — auditoría (16/10/2026)`, `broadcastRender.test.jsx`, `TutorialModal.jsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `firebase` be split into smaller, more focused modules?**
  _Cohesion score 0.12773109243697478 - nodes in this community are weakly interconnected._