# Formation depth calibration (PES 2021)

Where each game depth (the `LocationY`-style value of a formation slot, 3 = own goal line side … 48) falls on the
game's own strategy pitch, measured live on 2026-11-06, to make the formation modal place the CF/SS switch where
the game does. Bands in `utils/positionRules.js` are game data and are not changed by this document.

## Method

- Game: PES2021.exe, Exhibition match, Spain (team 7, plain 4-3-3, no fluid formation) at home, screen
  *Alineación/Editar posición*. Window client area 1844 × 1038 captured with `CopyFromScreen` (game window only).
- Memory: read-only (`PROCESS_VM_READ`). `formation_scan.py find` with the plan from
  `formationPlan.mjs 7` found 5 copies of Spain's plan (3 identical variants each). The menu's editing copy is the
  one that changes while a slot is dragged; all copies matched the save before editing.
  Note: `find` reports the `variant0` hit at the roles byte; the variant itself starts 1 byte earlier.
- The editing copy is written while dragging and on release; the slot's **role is updated 1–2 s after the cursor
  stops**, so a role was only recorded when the slot stayed still for ≥ 3 s.
- Pixel positions: centre of the dark role chip under each photo (connected-component search); pitch lines:
  narrow brightness peaks along clear rows/columns. Scripts were throwaway (session scratchpad).

Captures (game pitch only):

| file | content |
| --- | --- |
| `calibration/depth-baseline-433.png` | Spain's 4-3-3 as saved (CF 43, wingers 39, CMF 25/26, DMF 19, FB 13, CB 11) |
| `calibration/depth-drag-zone-shade.png` | dragging the CF: the game shades the zones the slot's current line does not cover |
| `calibration/depth-ss39-rmf34.png` | SS at depth 39 and RMF at depth 34 after the role update |

## Role boundaries observed in the game

| move | result | status |
| --- | --- | --- |
| CF slot held at depth 40 (lateral 53) for 2 min → 39 | CF at 40, **SS at 39** | verified in game |
| centre slot 42 / 38 | CF / SS | verified in game |
| centre slot 37 / 34 | SS / AMF | verified in game |
| centre slot 33 (lateral 51) | CMF changed to **AMF** by itself | verified in game |
| right wing (lateral 85) 35 ↔ 34, held 6 s | **RWF at 35, RMF at 34** | verified in game |
| right wing 33 | RMF | verified in game |

So the band edges 39/40 (centre) and 34/35 (wing) of `positionRules.js` are the game's own. While dragging, the
shaded zone's edges fall at depth 40.57 and 15.63 and lateral 20.5 and 83.5 (pixel model below): the 40/41,
15/16, 20/21 and 83/84 edges of the partition table below, within 0.1 unit.

## The game's position tables (PES2021.exe `.data`)

Found in the running process (read-only), in the Game Plan menu's data (right after the formation names
`4-5-1 ( 4-2-3-1 )` … and the `gmPlanMain` layout names). Each entry is four `int32`:
`{ depthMin, depthMax, lateralMin, lateralMax }`, inclusive.

| address | entries | content |
| --- | --- | --- |
| `0x1434A1560` | 1 | outfield area `(4, 47, 5, 99)` |
| `0x1434A1570` | 12 | zones: GK `(0,3,52,56)`, CB `(4,15,21,83)`, LB `(4,15,0,20)`, RB `(4,15,84,104)`, DMF `(16,25,21,83)`, LMF `(16,34,0,20)`, RMF `(16,34,84,104)`, AMF `(26,34,21,83)`, LWF `(35,47,0,20)`, RWF `(35,47,84,104)`, SS `(35,47,21,83)`, CF `(40,47,21,83)` |
| `0x1434A1630` | 13 | area per role, EDIT role order: GK `(0,3,52,56)`, CB `(4,15,5,99)`, LB `(4,15,5,20)`, RB `(4,15,84,99)`, DMF `(16,25,21,83)`, CMF `(16,34,5,99)`, LMF `(16,34,5,20)`, RMF `(16,34,84,99)`, AMF `(26,34,21,83)`, LWF `(35,47,5,20)`, RWF `(35,47,84,99)`, SS `(35,47,5,99)`, CF `(40,47,21,83)` |
| `0x1434A1700` | 12 | pitch partition: GK row `(0,3,0,104)`, then per line left/centre/right, with the attacking centre split `(35,40)` / `(41,47)` |

Code: the only references from the real code section are in `0x1408EC2AB` … `0x1408EDF92` (Game Plan menu).
`0x1408EDEC0` takes a role (1 = CB … 12 = CF) and a position, picks a zone from `0x1434A1570` by role and side
(e.g. a CB with lateral ≤ 20 uses the LB zone, ≥ 84 the RB zone) and returns whether the position lies inside it.
`0x1408EC2AB` loads the per-role table, `0x1408ED36A` the partition (used for the drag shading), `0x1408EDB75` …
`0x1408EDD02` the outfield area.

Consequences:
- `positionRules.js` bands and overlaps are the game's (CB/CMF/SS allowed on the wings, CF only from 40, AMF only
  in the centre 26–34). Verified by code and data, not only by behaviour.
- Outfield depth is **4–47** (the EDIT uses 7–47 over 21,120 slots) and lateral **5–99** (the EDIT uses 5–99), centre
  **52** (GK at 52; the range 0–104 is symmetric around it). The app clamps to depth 3–48 and lateral 8–92 and
  treats x = 50 as the centre, so its side bands are 2 units off (x = 19 is "centre" in the app, LB zone in the game).

## Pixel model of the game's pitch

Chip centres (capture pixels, y down) against the plan values, 6 chips:

- `y_px = 731.87 − 9.782 × depth` (residuals −0.8 … +0.3 px, i.e. ≤ 0.09 depth units)
- `x_px = 351.5 + 4.083 × (lateral − 52)` (lateral 52 = the pitch's horizontal centre; residuals ≤ 0.5 px)

Lines drawn by the game, converted to depth with that model:

| game line | y px | depth | real distance from own goal line |
| --- | --- | --- | --- |
| own goal line (edge of the view, inferred) | ≈ 756 | ≈ −2.0 | 0 m |
| own goal-area edge | 725.5 | 0.65 | 5.5 m |
| own penalty-area edge | 662.5 | 7.09 | 16.5 m |
| halfway line | 485 | 25.24 | 52.5 m |
| rival penalty-area edge | 302 | 43.94 | 88.5 m |
| rival goal-area edge | 239.5 | 50.33 | 99.5 m |
| rival goal line (edge of the view, inferred) | ≈ 208 | ≈ 52.9 | 105 m |

## Depth → metres

Least squares over the five drawn lines:

**metres from own goal line = 3.79 + 1.914 × depth** (residuals −0.86 … +0.61 m)

Error: ±0.9 m from the fit. The marker anchor is the chip centre: the drag shading (partition table edges 40.5,
15.5, 20.5, 83.5) lands at 40.57, 15.63, 20.5 and 83.5 in the chip model, within 0.1 unit (0.2 m). Total ≈ ±1 m.
The game's drawing is close to, not exactly, to scale (penalty area drawn ~12 % deep).

| depth | metres from own goal | metres from rival goal |
| --- | --- | --- |
| 3 (GK) | 9.5 | 95.5 |
| 15.5 (DF/MF edge) | 33.5 | 71.5 |
| 25.5 | 52.6 (halfway) | 52.4 |
| 34.5 (MF/attack edge) | 69.8 | 35.2 |
| **39.5 (SS/CF edge)** | **79.4** | **25.6** |
| 43 (Konami's usual CF) | 86.1 | 18.9 (penalty-area edge) |
| 48 (max) | 95.7 | 9.3 |

## The app today (`toGameCoords`: depth = round((90 − y) × 0.46 + 3))

The app's pitch draws 105 m over y = 3 … 97 (`components/Pitch.jsx`). With the current formula:

| depth | app y | app metres from own goal | game metres | gap |
| --- | --- | --- | --- | --- |
| 3 | 90.0 | 7.8 | 9.5 | −1.7 m |
| 25.2 (game halfway) | 41.7 | 61.8 | 52.5 | +9.3 m |
| 40 | 9.6 | 97.7 | 80.3 | +17.4 m |
| 43 | 3.0 | 105 (goal line) | 86.1 | +18.9 m |

The app stretches depth by ~30 % and the error grows toward the rival goal. Also `PITCH_BOUNDS.minY = 6` caps the
reachable depth at 42, so a CF at Konami's usual 43–45 cannot be placed in the app at all.

## Options

**A. Keep `toGameCoords`, redraw `PitchMarkings` in the game's scale.** Saved formations and exports unchanged.
With the current formula the game's lines land at app y: halfway 41.6, rival penalty-area edge **0.9** and rival
goal-area edge **−13**, i.e. above the drawn field (which starts at y = 3); the own goal line would be at y ≈ 101.
The pitch cannot show the rival box, and depth > 42 stays unreachable. Cost: small (one component + a test), but
it does not reach the goal: the CF/SS switch would sit 1.6 units below a box edge that is off screen.

**B. Correct the mapping: `depth = (93.61 − y) / 1.7133`, i.e. `y = 93.61 − 1.7133 × depth`** (goal lines at depth
−2.0 and 52.9 on y = 97 and 3). Depth 40 → y 25.1, 43 → 20.0, 48 → 11.4, GK 3 → 88.5, halfway → 50.4. The
markings already drawn by `PitchMarkings` (real proportions) then match the game within ±2 m.
Cost:
- `toGameCoords` (`utils/formationStates.js`), `gameDepth` (`utils/positionRules.js`), `PITCH_BOUNDS` (y range for
  depth 3 … 48); `pes/draftTransfer.js` and `utils/pesExport.js` only call `toGameCoords`.
- Default layouts in `utils/constants.js` (`FORMATIONS`, 176 `y:` values), templates, landing sample data
  (`components/landing/sampleData.js`, `tests/landingSampleData.test.js`): convert each y so its exported depth
  stays the same (`y_new = 93.61 − 1.7133 × depth_old`), so exports of untouched teams do not change.
- Saved `formationStates` in Firestore: convert on read (a `coordsVersion` field; old values converted in
  `normalizeFormationStates`, written back on the next save) instead of a batch migration. Read-only views
  (`FormationViewScreen`, `TeamScreen`) go through the same normalisation.
- Tests: `formationStates`, `positionRules` (`yForDepth`), `pesExport`, `fluidFormation`, `autoLineup`,
  `landingSampleData`.
- Risk: rounding at .5 can move an exported depth by 1 for a converted value; a test can pin every default layout's
  export before/after.

B should also fix the ranges found in the game's tables: outfield depth 4–47 (not 3–48), lateral 5–99 (not
8–92), lateral centre 52 (app x = 50 today), so `WIDE_OFFSET` bands line up with the game's 20/21 and 83/84 edges.
Changing the lateral mapping also changes exports of wide players and needs the same convert-on-read treatment.

## Implemented (option B, 2026-11-06)

- `utils/pitchGeometry.js` holds the only mapping: `depth = (97 − y) × 54.86 / 94 − 1.98` (goal lines y 97 / 3 at
  depth −1.98 / 52.88) and `lateral = (x − 4) × 104 / 92` (centre x 50 = lateral 52). Exports clamp to the game's
  outfield area (4–47, 5–99); the keeper always exports (3, 52). `PITCH_BOUNDS` are that area's corners.
- `utils/positionRules.js` zones use it: side bands are lateral ≤ 20 / ≥ 84, as in the game's tables.
- Firestore keeps the older y encoding (`depth = (90 − y) × 0.46 + 3`); `normalizeFormationStates` and
  `serializeFormationStates` convert, so saved boards, `firestore.rules` and open older tabs stay valid, and every
  saved slot exports the same depth as before. Laterals now use the game's centre (a slot at x 82 exports 88, not 82).
- Default layouts (`utils/constants.js`, 176 slots) were converted the same way: every exported depth unchanged.
  The keeper is drawn on the goal-area line (y 92.3), where the game draws him.
- `components/Pitch.jsx`: markers are anchored at the centre of the role chip, as the game anchors them; a drag keeps
  the grab point under the pointer; while dragging, the marker shows the role it will play where it is dropped.
- Match centre (`utils/matchAnalysis.js`): laterals drawn with the same scale and centre.
- Tests: `tests/formationStates.test.js` "calibration against the game pitch" pins the CF/SS edge at 79.4 m from the
  own goal (±1 m), the halfway and penalty-area lines, the saved-data conversion and the default depths.

Captures of the app (synthetic names, no account data): `calibration/app-before-after.png` (before, after, and the
game's CF/SS edge dashed), `calibration/app-drag-cf-to-ss.png` (the CF dragged across the edge shows SD).

## Not verified / open

- The depth → screen mapping is the game's drawing measured in one capture set; the tables give the zones, not the
  drawing scale. The tables were read at runtime (addresses for this build, image base 0x140000000).
- Goal lines are inferred from the drawn box proportions (they sit at the edges of the view); not visible as lines.
- Lateral scale: 4.08 px per unit vs 5.70 px/m across → 0.72 m per lateral unit; not used by either option.
- One team, one screen, one game session. Other screens (in-match strategy) were not measured.
