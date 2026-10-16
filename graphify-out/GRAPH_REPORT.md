# Graph Report - PROGRAMA SUPER2  (2026-10-16)

## Corpus Check
- 372 files · ~24,086,820 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .css 3, (none) 2, .csv 2)

## Summary
- 2259 nodes · 6349 edges · 154 communities (114 shown, 40 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0bdc3378`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lucide-react
- teamView.js
- app.jsx
- kits.test.js
- os
- TeamsAdminSection.jsx
- Layout Generation Scripts
- permissions.js
- draftTransfer.js
- helpers.js
- market.js
- LandingPage.jsx
- TeamsModal.jsx
- **SuperContinental League™ — Brand Voice Guidelines**
- TournamentModal.jsx
- ref_node_fs
- ScoutAssignmentsPanel.jsx
- index.ts
- kitWorkspace.js
- kitAssetResolver.test.js
- playerCatalog.test.js
- formatPriceShort
- OverlayAdminSection.jsx
- localStore.js
- textureDecode.js
- README.md
- KitViewerPanels.jsx
- bracketModel.js
- dependencies
- RecordTable
- Changelog
- session.js
- RESUMEN REUNION.md
- kitDecals.js
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
- PesPlayersPanel.jsx
- devDependencies
- PWA Manifest
- editDatabase.js
- PlatformDemo.jsx
- scripts
- PES Claims Sync
- NotificationsPanel.jsx
- usePesWorkspace.js
- kitConfig.js
- Section Definitions
- useKitAssets.js
- BaseModal
- LoginScreen.jsx
- formationStates.test.js
- MCP Config
- Service Worker
- Auditoría integral — Supercontinental Draft (14/10/2026)
- BroadcastOverlay.jsx
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
- getFlagUrl
- constants.js
- Función del mercado (Supabase Edge Function `market`)
- CartModal.jsx
- pes/index.js
- simulate_t3.py
- PesValidationError
- firebase
- tournamentEngine.js
- calcular_modificadores_meta
- main.py
- positionRules.test.js
- procesar_datos_para_json
- pesTextureStorage.js
- kitAdd.test.js
- Auditoría integral — Supercontinental Draft (15/10/2026)
- useRemoteConflict.js
- generador.py
- Simulación T3
- ManagerChat.jsx
- useScrollRestore.test.js
- ComparisonModal.jsx
- budgetCalculations.test.js
- ToastStack.jsx
- react
- TutorialModal.jsx
- marketService.js
- PlayerModal.jsx
- parseOpenTime
- prefetch.js
- recommendations.js
- react-router-dom
- pesExport.js
- sessionHint.test.js
- PesTeamWorkspace.jsx
- Tabs
- getStatAndOvrColorClass
- kitRenderer.test.js
- Pitch.jsx
- ftex.js
- AdminModal.jsx
- build-players-compact.mjs
- PesFormatError
- Alert
- fields.js
- PlayerPreview.jsx
- ErrorBoundary
- normalizeFormationStates
- RecommendationsAccordion.jsx
- loadKitTextures.js
- Architecture map
- tournamentRename.js

## God Nodes (most connected - your core abstractions)
1. `react` - 141 edges
2. `lucide-react` - 83 edges
3. `App()` - 64 edges
4. `vitest` - 61 edges
5. `PesValidationError` - 57 edges
6. `getStatAndOvrColorClass()` - 45 edges
7. `usePesWorkspace()` - 41 edges
8. `getPosColorClass()` - 41 edges
9. `formatPriceShort()` - 38 edges
10. `BaseModal()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `B. Animaciones recomendadas (por prioridad)` --references--> `Spinner()`  [INFERRED]
  docs/ANIMACIONES-2026-10-16.md → components/ui/Spinner.jsx
- `The dependency graph` --references--> `toPitch()`  [INFERRED]
  docs/ARCHITECTURE.md → pes/draftTransfer.js
- `5. Authorization` --references--> `authorize()`  [INFERRED]
  docs/PES_ENGINE.md → pes/permissions.js
- `1. Qué se ejecutó` --references--> `callMarket()`  [INFERRED]
  docs/AUDITORIA-2026-10-15.md → services/marketService.js
- `Formation editor: states, positions, instructions` --references--> `layoutForState()`  [INFERRED]
  docs/ARCHITECTURE.md → utils/formationStates.js

## Import Cycles
- None detected.

## Communities (154 total, 40 thin omitted)

### Community 0 - "lucide-react"
Cohesion: 0.12
Nodes (41): PesAddKit(), describe(), fmt(), OpRow(), PesChangesPanel(), TYPE_LABEL, ValidationView(), CoachInput() (+33 more)

### Community 1 - "teamView.js"
Cohesion: 0.10
Nodes (49): Group(), ColourField(), CommitText(), enc, ColourGroup(), EXTRA_NAME_FIELDS, IdentitySection(), LanguageNames() (+41 more)

### Community 2 - "app.jsx"
Cohesion: 0.06
Nodes (45): ALL_DETAILED_STAT_KEYS, App(), CartModal, CommandPalette, ComparisonModal, FiltrosModal, FirebaseError(), FormationModal (+37 more)

### Community 3 - "kits.test.js"
Cohesion: 0.14
Nodes (33): EXTS, FontGenerator(), FontLibrary(), PesKitTextures(), SlotRow(), slotStatus(), STATUS, inspectFtex() (+25 more)

### Community 4 - "os"
Cohesion: 0.24
Nodes (6): calculate_budgets(), get_avg_price_for_ovr(), load_players(), limpiar_fotos_huerfanas(), main(), update_playlist()

### Community 5 - "TeamsAdminSection.jsx"
Cohesion: 0.22
Nodes (15): commitBatchOperations(), FIRESTORE_BATCH_LIMIT, GeneralAdminSection, ACCESS_FILTERS, TeamsAdminSection, filterAdminTeams(), MAX_LOGO_BYTES, mergeAdminTeamProfile() (+7 more)

### Community 6 - "Layout Generation Scripts"
Cohesion: 0.07
Nodes (26): content, fs, fs, out, src, A, C, camel() (+18 more)

### Community 7 - "permissions.js"
Cohesion: 0.16
Nodes (15): KIT_EDITABLE_KEYS, TEXTURE_SLOT_IDS, authorize(), can(), EDIT_TEAM_KIT_FIELDS, OP_TYPES, ROLES, allowed() (+7 more)

### Community 8 - "draftTransfer.js"
Cohesion: 0.13
Nodes (29): abbreviationOf(), binSquadSize(), binStrategyFromTactics(), buildSquadSpec(), clamp(), clubRowsOf(), enc, fitBytes() (+21 more)

### Community 9 - "helpers.js"
Cohesion: 0.14
Nodes (18): TeamScreen, getPosRank(), OVR_COLOR_THRESHOLDS, POS_COLOR, POS_RANK, TeamScreen(), COUNTRY_CODE_MAP, REGION_COUNTRIES (+10 more)

### Community 10 - "market.js"
Cohesion: 0.20
Nodes (20): toUnits(), FRANCHISE_RULE_TEXT, isFranchiseEligible(), acceptOffer(), appendHistory(), getCatalogPlayer(), handleMarketAction(), isMarketOpen() (+12 more)

### Community 11 - "LandingPage.jsx"
Cohesion: 0.17
Nodes (19): LandingPage, external, FollowLeague(), SocialLinks(), FEATURED_VIDEO, LEAGUE_NAME, LINKTREE_URL, SOCIAL_LINKS (+11 more)

### Community 12 - "TeamsModal.jsx"
Cohesion: 0.16
Nodes (22): SuggestionsAdminSection, Crest(), goalDiff(), MatchFocus(), OverviewTab, RESULT, sameName(), StandingRow() (+14 more)

### Community 13 - "**SuperContinental League™ — Brand Voice Guidelines**"
Cohesion: 0.09
Nodes (22): **1\. Rigurosos**, **2\. Auténticos entre amigos**, **3\. Prolijos en la forma, no en el fondo**, **4\. Transparentes**, **5\. Ambiciosos con la producción**, **Así no**, **Así sí**, **Brand Personality** (+14 more)

### Community 14 - "TournamentModal.jsx"
Cohesion: 0.15
Nodes (24): BracketView, LeagueTableView, BracketFork, MatchCard, EDIT_FIELDS, MatchCenter, StatsView, TeamSelect (+16 more)

### Community 15 - "ref_node_fs"
Cohesion: 0.14
Nodes (11): @firebase/rules-unit-testing, root, source, target, acceptBatch(), cart(), lock(), offer() (+3 more)

### Community 16 - "ScoutAssignmentsPanel.jsx"
Cohesion: 0.18
Nodes (18): attentionOptions, DEFAULT_SCOUTS, getMonthKey(), getTimeLeft(), initialCriteria, makeCriteriaFingerprint(), SCOUT_TUTORIAL_STEPS, ScoutAssignmentsPanel (+10 more)

### Community 17 - "index.ts"
Cohesion: 0.15
Nodes (12): allowedOrigins, corsHeaders(), firestore, keySet, reply(), serviceAccount, createServiceAccountTokenProvider(), FIREBASE_JWKS_URL (+4 more)

### Community 18 - "kitWorkspace.js"
Cohesion: 0.16
Nodes (10): parseKitMap(), parseKitOrder(), serializeKitConfig(), TEXTURE_KEYS, insertInOrder(), KIT_SERVER_PREFIX, KitWorkspace, norm() (+2 more)

### Community 19 - "kitAssetResolver.test.js"
Cohesion: 0.11
Nodes (19): ASSET_SLOTS, AssetCache, assetCandidates(), describeAsset(), KIT_FOLDER_EXTS, kitAssetRefs(), kitDirOf(), manifestEntry() (+11 more)

### Community 20 - "playerCatalog.test.js"
Cohesion: 0.20
Nodes (15): buildMarketCatalog(), buildDraftSquad(), loadCatalogById(), loadDraftTeams(), glitched, realCatalog, synthetic, isGlitchedPlayer() (+7 more)

### Community 21 - "formatPriceShort"
Cohesion: 0.35
Nodes (10): getInitials(), getTransferTime(), TeamVisual, TransferCard, TransferFeed, TransferSkeleton, getOvrBadgeClass(), TeamLogo (+2 more)

### Community 22 - "OverlayAdminSection.jsx"
Cohesion: 0.16
Nodes (29): BroadcastMatchPicker, MatchRow, STATUS_FILTERS, TeamCell(), teamLogoFor(), OnAirTeam(), OVERLAY_FIELDS, OverlayAdminSection (+21 more)

### Community 23 - "localStore.js"
Cohesion: 0.17
Nodes (17): clearDraft(), connect(), del(), deleteSource(), get(), getAsset(), getDraft(), getSource() (+9 more)

### Community 24 - "textureDecode.js"
Cohesion: 0.12
Nodes (20): ftexHeader(), A16, AL, BC7_ABITS, BC7_BITS, bc7Block(), decodeBlocks(), decodeDds() (+12 more)

### Community 25 - "README.md"
Cohesion: 0.06
Nodes (31): 1. Clonar el repositorio, 2. Instalar dependencias, 3. Configurar variables de entorno, 4. Iniciar servidor de desarrollo, 5. Build para producción, 6. Deploy a Firebase, 🏗️ Arquitectura del proyecto, 🔐 Autenticación (+23 more)

### Community 26 - "KitViewerPanels.jsx"
Cohesion: 0.22
Nodes (16): LIGHT_PRESETS, AssetRow(), DiagnosticsPanel(), FabricPanel(), FolderControls(), FONT_SLOTS, LetteringPanel(), LEVEL (+8 more)

### Community 27 - "bracketModel.js"
Cohesion: 0.18
Nodes (21): BroadcastBracket, BroadcastMatchCard, TeamRow(), TONE_STROKES, fullBracket, BROADCAST_METRICS, BROADCAST_REFERENCE, buildBracketColumns() (+13 more)

### Community 28 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, chart.js, fflate, firebase, @fontsource/barlow, @fontsource/barlow-condensed, html2canvas, jspdf (+9 more)

### Community 29 - "RecordTable"
Cohesion: 0.17
Nodes (4): writeField(), fieldMap(), RecordTable, serializeBinDatabase()

### Community 30 - "Changelog"
Cohesion: 0.10
Nodes (20): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), [0.1.8](https://github.com/supabase/agent-skills/compare/v0.1.7...supabase-v0.1.8) (2026-09-24), [0.1.9](https://github.com/supabase/agent-skills/compare/v0.1.8...supabase-v0.1.9) (2026-09-28), Bug Fixes (+12 more)

### Community 31 - "session.js"
Cohesion: 0.20
Nodes (16): sha256Hex(), replayOperations(), buildWorkspace(), classifyFiles(), KNOWN_BIN, pathOf(), readSources(), restoreWorkingCopy() (+8 more)

### Community 32 - "RESUMEN REUNION.md"
Cohesion: 0.20
Nodes (9): 1\. Formato de Competencia y Estructura del Torneo, 2\. Mercado de Pases, Presupuestos y Regulación de Planteles, 3\. Dinámica del Draft (Jugadores Especiales / Promesas), 4\. Logística, Sede y Fechas, 5\. Puntos Pendientes / Acciones Inmediatas, A. Opción 1: Formato en 2 Zonas (Estilo Copa de la Liga), B. Opción 2: Mantener el Formato Anterior (Liga / Sistema Suizo), C. Copa de Plata (+1 more)

### Community 33 - "kitDecals.js"
Cohesion: 0.14
Nodes (27): composeKitTexture(), drawCell(), drawDigits(), drawName(), FONT_LABEL, fontNote(), KitFont, decalLayout() (+19 more)

### Community 34 - "package.json"
Cohesion: 0.13
Nodes (14): name, private, type, version, autoprefixer, html2canvas, jose, jszip (+6 more)

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
Cohesion: 0.29
Nodes (9): accept(), call(), catalog, firestore, read(), readAll(), seed(), setMarket() (+1 more)

### Community 41 - "FormationModal.jsx"
Cohesion: 0.16
Nodes (30): TacticalStateBar, dedupeLineup(), FormationModal, FormationPlayerItem, formationReducer(), formatRolePlayerOption(), initialFormationState, RolesPanel (+22 more)

### Community 42 - "PesKit3DViewer.jsx"
Cohesion: 0.17
Nodes (22): CollarPicker(), kitPixels(), fallbackKitTexture(), KitEnv, KitGL, lightState(), sharedThumbRenderer(), useKitGL() (+14 more)

### Community 43 - "vitest"
Cohesion: 0.10
Nodes (37): decodeWesys(), encodeWesys(), isWesys(), MAGIC, WESYS_HEADER_SIZE, loadBinDatabase(), loadEditDatabase(), readTeamTactics() (+29 more)

### Community 44 - "PES 2021 database & kit engine"
Cohesion: 0.14
Nodes (13): 1. Supported input (explicit), 2. Investigation summary, 3. Field evidence (`pes/formats/pes2021/binLayout.js`), 4. Architecture, 4b. Draft → PES (`pes/draftTransfer.js`, tab "Draft → PES"), 4c. Shared sources, 4d. Kits: 3D preview, fabric maps, new kits, 5. Authorization (+5 more)

### Community 45 - "PesPlayersPanel.jsx"
Cohesion: 0.19
Nodes (26): BinPlayer(), EditPlayer(), PesPlayersPanel(), ConfidenceBadge(), FieldInput(), SearchInput(), PesPlayerList(), IdentityForm() (+18 more)

### Community 46 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, autoprefixer, fake-indexeddb, firebase-admin, @firebase/rules-unit-testing, jose, @opentelemetry/api, postcss (+4 more)

### Community 47 - "PWA Manifest"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 48 - "editDatabase.js"
Cohesion: 0.12
Nodes (19): COACH_BY_NAME, COACH_FLAG, FORMAT_ID, isSlot(), PLAYER_BY_NAME, TEAM_BY_NAME, validateSquadSpec(), BODY_FIELDS (+11 more)

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

### Community 53 - "usePesWorkspace.js"
Cohesion: 0.16
Nodes (29): usePesAccess(), readActive(), usePesWorkspace(), writeActive(), capabilitiesOf(), resetLocalStore(), clean(), createWorkspace() (+21 more)

### Community 54 - "kitConfig.js"
Cohesion: 0.17
Nodes (20): parseKitConfig(), parseRangeComment(), setKitValue(), validateKitValue(), BADGE_KEYS, describeConstraint(), isBadgeOff(), keyConstraint() (+12 more)

### Community 55 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 56 - "useKitAssets.js"
Cohesion: 0.25
Nodes (16): canPickFolder(), filesReader(), handleReader(), idb(), kitServerReader(), pickGameFolder(), readerFromFiles(), rememberedGameFolder() (+8 more)

### Community 57 - "BaseModal"
Cohesion: 0.10
Nodes (24): SuggestionsModal, SuggestionsModal, BaseModal(), openDialogs, SIZE_MAP, ConflictBanner, KeyboardShortcutsHelp(), SHORTCUTS (+16 more)

### Community 58 - "LoginScreen.jsx"
Cohesion: 0.26
Nodes (12): AuthLayout(), Brand(), GoogleButton(), Button, IconButton, SIZES, VARIANTS, googleProvider (+4 more)

### Community 59 - "formationStates.test.js"
Cohesion: 0.16
Nodes (14): AdvancedInstructionsPanel, SIDE_META, EDIT_ADVANCED_CODES, findElement(), ADVANCED_INSTRUCTIONS, CODES, EMPTY_INSTRUCTIONS, instructionByCode() (+6 more)

### Community 64 - "Auditoría integral — Supercontinental Draft (14/10/2026)"
Cohesion: 0.18
Nodes (10): 1. Qué se ejecutó, 2. Corregido en esta auditoría, 3. Pendiente — requiere decisión o trabajo mayor, 4. Dependencias, 5. No verificado, Alta, Auditoría integral — Supercontinental Draft (14/10/2026), Baja (+2 more)

### Community 65 - "BroadcastOverlay.jsx"
Cohesion: 0.38
Nodes (6): BroadcastOverlay, DEFAULT_BROADCAST_OVERLAY, getTeam(), SCENE_LABELS, StatRows(), TOURNAMENT_THEME

### Community 66 - "Third-party notices — PES engine"
Cohesion: 0.29
Nodes (6): bcdec (Sergii Kudlai) — MIT / public domain, Libraries, PES 2020 Editor V0.12.8 by Ejogc327, PES Editor Rebuilt (BSD 3-Clause), Third-party notices — PES engine, Upstream work carried through PES Editor Rebuilt

### Community 67 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 68 - "Caveman Mode — Antigravity Adaptation"
Cohesion: 0.40
Nodes (4): Caveman Mode — Antigravity Adaptation, Levels, Persistence, Rules

### Community 102 - "getFlagUrl"
Cohesion: 0.20
Nodes (14): CARD_INFO_ESTIMATE, lockInfo(), useScrollMargin(), VirtualPlayerResults(), brokenImageIds, PlayerCard, FIELD_STATS, GK_STATS (+6 more)

### Community 103 - "constants.js"
Cohesion: 0.11
Nodes (28): filterColors, FilterSection(), FiltrosModal, RangeInputs(), RANGES, ToggleButton, ActiveFilterChips(), numberFormat (+20 more)

### Community 104 - "Función del mercado (Supabase Edge Function `market`)"
Cohesion: 0.40
Nodes (4): Función del mercado (Supabase Edge Function `market`), Mantenimiento, Probar localmente, Puesta en marcha (una vez)

### Community 105 - "CartModal.jsx"
Cohesion: 0.21
Nodes (19): CartModal, CLOSED_STATUSES, getOfferSenderName(), getOfferStatusLabel(), getOfferTargetName(), NegotiationCard, OfferTimeline, STATUS_TONE (+11 more)

### Community 106 - "pes/index.js"
Cohesion: 0.14
Nodes (19): fieldByteSpan(), baseName(), BIN_TABLES, FORMAT_ID, PASSTHROUGH_FILES, spanOf(), ASSIGNMENT_FIELDS, ASSIGNMENT_RECORD_SIZE (+11 more)

### Community 107 - "simulate_t3.py"
Cohesion: 0.23
Nodes (8): cargar_jugadores(), contar_por_posicion(), costo_banco(), generar_reporte(), main(), mejor_xi(), precios_medianos(), presupuesto()

### Community 108 - "PesValidationError"
Cohesion: 0.15
Nodes (10): PesValidationError, readField(), EditDatabase, u16(), u32(), w16(), w32(), assignmentsOf() (+2 more)

### Community 109 - "firebase"
Cohesion: 0.22
Nodes (13): formatMessageTime(), ProposalChat, BudgetMeter(), TopHeader, OnlineIndicator, FIVE_MINUTES_MS, getTimestampMillis(), HEARTBEAT_INTERVAL_MS (+5 more)

### Community 110 - "tournamentEngine.js"
Cohesion: 0.24
Nodes (7): buildAutomaticTournamentData(), buildAutomaticTournamentReport(), getMatchesWithNewResults(), RESULT_FIELDS, ZERO_STATS, FakeTimestamp, tournament

### Community 111 - "calcular_modificadores_meta"
Cohesion: 0.23
Nodes (5): calcular_modificadores_meta(), _columnas_numericas(), _desvios_contra_pares(), imprimir_control_precios(), _puntaje_por_posicion()

### Community 112 - "main.py"
Cohesion: 0.22
Nodes (7): calcular_modificador_edad(), calcular_modificador_edad_t2(), calcular_modificador_posicion(), calcular_modificador_reputacion_t2(), calcular_precio_t2(), calcular_precios(), calcular_valor_base_t2()

### Community 113 - "positionRules.test.js"
Cohesion: 0.24
Nodes (15): PositionPicker, DEPTH_LINES, FALLBACK, gameDepth(), isOutfieldRole(), isRoleAllowedAt(), KNOWN_ROLES, OUTFIELD_ROLES (+7 more)

### Community 114 - "procesar_datos_para_json"
Cohesion: 0.18
Nodes (4): cargar_lista_exclusion(), cargar_mapeo_paises(), normalizar_nombre(), procesar_datos_para_json()

### Community 115 - "pesTextureStorage.js"
Cohesion: 0.25
Nodes (15): refreshFirebaseClaims(), supabase, supabaseConfigured, TEXTURE_BUCKET, @supabase/supabase-js, deleteWorkspaceFiles(), download(), downloadTexture() (+7 more)

### Community 116 - "kitAdd.test.js"
Cohesion: 0.36
Nodes (10): fabricPreview(), fabricTextures(), pixelsToCanvas(), fabricOf(), FABRICS, fabricTile(), luminance(), normalMapPixels() (+2 more)

### Community 117 - "Auditoría integral — Supercontinental Draft (15/10/2026)"
Cohesion: 0.18
Nodes (10): 1. Qué se ejecutó, 2. Corregido en esta sesión (C1 + C3 + C2), 4. Pendiente — Media y baja (resumen), 5. Funcionalidades nuevas propuestas (por valor y esfuerzo), 6. Hoja de ruta, Auditoría integral — Supercontinental Draft (15/10/2026), C1: los traspasos no llegaban al plantel del comprador (CRÍTICO, CONFIRMADO), C2: ofertas con monto negativo saltaban el presupuesto (CRÍTICO, CONFIRMADO) (+2 more)

### Community 118 - "useRemoteConflict.js"
Cohesion: 0.17
Nodes (14): Architecture, Commands, Gotchas, 3. Pendiente — Alta, useAuth(), useFirebaseData(), computeSignature(), isDocumentDifferent() (+6 more)

### Community 120 - "Simulación T3"
Cohesion: 0.29
Nodes (6): Pool de Jugador Franquicia, Pool del Draft de promesas, Presupuesto por POV, Simulación T3, XI máximo con piso de banco 73, XI máximo con piso de banco 74

### Community 121 - "ManagerChat.jsx"
Cohesion: 0.47
Nodes (8): getMessageDate(), ManagerChat, getMentionedTeamIds(), getMentionHandle(), getTeamMentionOptions(), hasTransferIntent(), normalizeChatText(), transferWords

### Community 123 - "ComparisonModal.jsx"
Cohesion: 0.17
Nodes (22): Bars(), clampPercent(), compareStats(), ComparisonContent(), ComparisonModal, lastName(), Legend(), PROFILE_ROWS (+14 more)

### Community 124 - "budgetCalculations.test.js"
Cohesion: 0.32
Nodes (9): Una sola cuenta de presupuesto para la app y el servidor (parte de H6), calculateBudget(), useBudget(), committedInOffers(), heldAmount(), isFranchiseLock(), spentOnLocks(), getCommittedFunds() (+1 more)

### Community 125 - "ToastStack.jsx"
Cohesion: 0.12
Nodes (21): showAtOnce(), StatusAlert, TONES, SigningToast(), ToastFrame, ToastStack, Archivos a tocar (fase 1), Estado (16/10/2026) (+13 more)

### Community 126 - "react"
Cohesion: 0.18
Nodes (12): OBS_SOURCE_GROUPS, ObsSources(), TournamentBroadcastAdminSection, TournamentSummary(), BracketBoard, boardWidth(), CupBracketView, TONE_STYLES (+4 more)

### Community 127 - "TutorialModal.jsx"
Cohesion: 0.47
Nodes (5): TutorialModal, APP_TUTORIAL_STEPS, getTooltipStyle(), TutorialModal, formatBudget()

### Community 128 - "marketService.js"
Cohesion: 0.52
Nodes (6): acceptOffer(), callMarket(), loadMarketClient(), readFunctionError(), releasePlayer(), signPlayer()

### Community 129 - "PlayerModal.jsx"
Cohesion: 0.24
Nodes (14): buildConfetti(), CelebrationPopup, CONFETTI_COLORS, getSimilarPlayers(), PlayerModal, PosicionHeatmap, POSITIONS_LAYOUT, RadarChart (+6 more)

### Community 130 - "parseOpenTime"
Cohesion: 0.36
Nodes (5): MarketClosedBanner, LEAGUE_UTC_OFFSET, parseOpenTime(), formatCountdown(), pad()

### Community 131 - "prefetch.js"
Cohesion: 0.40
Nodes (5): ./Foo.jsx, isPrefetchSafe(), makePrefetchable(), prefetchedKeys, schedulePrefetchOnIdle()

### Community 132 - "recommendations.js"
Cohesion: 0.40
Nodes (5): calculateSmartRecommendations(), getPlayerGroup(), GROUP_LABELS, GROUP_TARGETS, POS_GROUPS

### Community 133 - "react-router-dom"
Cohesion: 0.50
Nodes (4): LeftSidebar, NAV_GROUPS, NavItem(), react-router-dom

### Community 134 - "pesExport.js"
Cohesion: 0.36
Nodes (12): exportVariants(), toGameCoords(), alignStarters(), csvText(), exportTeamToPesZip(), generateAppearancesCsv(), generateCoachCsv(), generateFormationCsv() (+4 more)

### Community 136 - "PesTeamWorkspace.jsx"
Cohesion: 0.11
Nodes (26): modifiedKeys(), opKey(), accessNote(), headerMeta(), TEAM_SECTIONS, TeamDetail(), AdvancedSection(), ELSEWHERE (+18 more)

### Community 137 - "Tabs"
Cohesion: 0.17
Nodes (16): inkOn(), luminance(), SIZES, TeamBadge(), TeamColourBand(), TeamHeader(), FILTERS, RowState() (+8 more)

### Community 138 - "getStatAndOvrColorClass"
Cohesion: 0.29
Nodes (11): MiniPlayerCard, Conventions, CartMiniPlayerCard, CommandPalette(), PlayerHeader(), PlayerMarquee(), PlayerTile, SHOWCASE_PLAYERS (+3 more)

### Community 139 - "kitRenderer.test.js"
Cohesion: 0.40
Nodes (3): LIGHT, MESH, scene

### Community 140 - "Pitch.jsx"
Cohesion: 0.24
Nodes (9): getLastName(), KEY_STEP, Pitch, PitchSlot, FormationViewScreen(), clamp(), clampPosition(), clientToPitch() (+1 more)

### Community 141 - "ftex.js"
Cohesion: 0.27
Nodes (12): adler32(), alphaBlock(), c565(), colorBlock(), encodeDxt(), encodeFtex(), FTEX_FORMATS, isPow2() (+4 more)

### Community 142 - "AdminModal.jsx"
Cohesion: 0.36
Nodes (8): AdminModal, ADMIN_TABS, AdminModal, ADMIN_TAB_IDS, LEGACY_TABS, normalizeAdminTab(), readStoredAdminTab(), storeAdminTab()

### Community 143 - "build-players-compact.mjs"
Cohesion: 0.15
Nodes (9): compact, players, root, source, sourceHash, sourceStat, sourceText, stampFile (+1 more)

### Community 144 - "PesFormatError"
Cohesion: 0.13
Nodes (20): PesError, PesFormatError, PesPermissionError, buildExport(), EDIT_PATH, PESDB_DIR, same(), verifyGenerated() (+12 more)

### Community 145 - "Alert"
Cohesion: 0.23
Nodes (11): FranchiseMarketNotice(), MarketplaceView(), ResultsSkeleton(), TeamSaveBar(), Alert(), TONES, getPreviewPosition(), useHoverPreview() (+3 more)

### Community 146 - "fields.js"
Cohesion: 0.29
Nodes (10): decoder, encoder, fieldRange(), validateFieldValue(), binIssues(), editIssues(), issue(), kitIssues() (+2 more)

### Community 147 - "PlayerPreview.jsx"
Cohesion: 0.25
Nodes (8): FIELD_STATS, GK_STATS, PlayerPreview(), PreviewCard(), react-dom, player, props(), render()

### Community 148 - "ErrorBoundary"
Cohesion: 0.15
Nodes (4): ErrorBoundary, rootElement, @fontsource/barlow, @fontsource/barlow-condensed

### Community 149 - "normalizeFormationStates"
Cohesion: 0.25
Nodes (6): TemplateAdminSection, jspdf, jspdf-autotable, fresh(), fresh(), normalizeFormationStates()

### Community 150 - "RecommendationsAccordion.jsx"
Cohesion: 0.33
Nodes (7): FIT_CONFIG, readInitialExpanded(), RecommendationsAccordion, Badge(), SIZE_MAP, VARIANT_MAP, formatPriceCompact()

### Community 151 - "loadKitTextures.js"
Cohesion: 0.36
Nodes (7): glossFromAlpha(), assetCache, decode(), decoded, loadKitTextures(), MAX_WIDTH, decodeTexture()

### Community 152 - "Architecture map"
Cohesion: 0.29
Nodes (6): Architecture map, Formation editor: states, positions, instructions, Kit viewer: from `config.txt` to pixels, Known structural risks, Layers, The dependency graph

### Community 153 - "tournamentRename.js"
Cohesion: 0.60
Nodes (5): isPlainObject(), renameDeep(), renameTeamInTournament(), sameName(), TEAM_NAME_KEYS

## Knowledge Gaps
- **6 isolated node(s):** `html2canvas`, `@opentelemetry/api`, `autoprefixer`, `postcss`, `tailwindcss` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 716 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `lucide-react`, `teamView.js`, `app.jsx`, `parseOpenTime`, `kits.test.js`, `TeamsAdminSection.jsx`, `react-router-dom`, `PlayerModal.jsx`, `PesTeamWorkspace.jsx`, `Tabs`, `getStatAndOvrColorClass`, `LandingPage.jsx`, `TeamsModal.jsx`, `Pitch.jsx`, `AdminModal.jsx`, `TournamentModal.jsx`, `ScoutAssignmentsPanel.jsx`, `Alert`, `helpers.js`, `PlayerPreview.jsx`, `ErrorBoundary`, `normalizeFormationStates`, `OverlayAdminSection.jsx`, `RecommendationsAccordion.jsx`, `formatPriceShort`, `KitViewerPanels.jsx`, `bracketModel.js`, `package.json`, `squadSync.test.js`, `FormationModal.jsx`, `PesKit3DViewer.jsx`, `PesPlayersPanel.jsx`, `PlatformDemo.jsx`, `NotificationsPanel.jsx`, `usePesWorkspace.js`, `useKitAssets.js`, `BaseModal`, `LoginScreen.jsx`, `formationStates.test.js`, `BroadcastOverlay.jsx`, `getFlagUrl`, `constants.js`, `CartModal.jsx`, `firebase`, `positionRules.test.js`, `useRemoteConflict.js`, `ManagerChat.jsx`, `useScrollRestore.test.js`, `ComparisonModal.jsx`, `budgetCalculations.test.js`, `ToastStack.jsx`, `TutorialModal.jsx`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **What connects `html2canvas`, `@opentelemetry/api`, `autoprefixer` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lucide-react` be split into smaller, more focused modules?**
  _Cohesion score 0.12081632653061225 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `teamView.js`, `parseOpenTime`, `kits.test.js`, `TeamsAdminSection.jsx`, `pesExport.js`, `permissions.js`, `sessionHint.test.js`, `helpers.js`, `Tabs`, `kitRenderer.test.js`, `AdminModal.jsx`, `ref_node_fs`, `ScoutAssignmentsPanel.jsx`, `index.ts`, `PlayerPreview.jsx`, `kitAssetResolver.test.js`, `playerCatalog.test.js`, `OverlayAdminSection.jsx`, `localStore.js`, `textureDecode.js`, `bracketModel.js`, `session.js`, `kitDecals.js`, `package.json`, `squadSync.test.js`, `rules/marketFunction.test.js`, `PlatformDemo.jsx`, `kitConfig.js`, `BaseModal`, `formationStates.test.js`, `constants.js`, `CartModal.jsx`, `firebase`, `tournamentEngine.js`, `positionRules.test.js`, `kitAdd.test.js`, `useRemoteConflict.js`, `useScrollRestore.test.js`, `budgetCalculations.test.js`, `ToastStack.jsx`, `react`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `teamView.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10150375939849623 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `teamView.js`, `app.jsx`, `parseOpenTime`, `kits.test.js`, `TeamsAdminSection.jsx`, `react-router-dom`, `PlayerModal.jsx`, `PesTeamWorkspace.jsx`, `Tabs`, `getStatAndOvrColorClass`, `LandingPage.jsx`, `TeamsModal.jsx`, `Pitch.jsx`, `AdminModal.jsx`, `TournamentModal.jsx`, `ScoutAssignmentsPanel.jsx`, `Alert`, `helpers.js`, `ErrorBoundary`, `normalizeFormationStates`, `OverlayAdminSection.jsx`, `RecommendationsAccordion.jsx`, `formatPriceShort`, `KitViewerPanels.jsx`, `bracketModel.js`, `package.json`, `FormationModal.jsx`, `PesKit3DViewer.jsx`, `PesPlayersPanel.jsx`, `PlatformDemo.jsx`, `NotificationsPanel.jsx`, `BaseModal`, `LoginScreen.jsx`, `formationStates.test.js`, `getFlagUrl`, `constants.js`, `CartModal.jsx`, `firebase`, `positionRules.test.js`, `ManagerChat.jsx`, `ComparisonModal.jsx`, `ToastStack.jsx`, `react`, `TutorialModal.jsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `app.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06274509803921569 - nodes in this community are weakly interconnected._