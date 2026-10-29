# PES 2021 live match data: research log

Target: `E:\eFootball PES 2021\PES2021.exe` 1.1.0.0, 458,739,200 bytes, x64, fixed image base `0x140000000`
(UML 2026 patch), Sider 7.4.3. Static analysis uses a slice of the runtime image
(`content\memdump\pes2021_140000000.bin`, taken with Sider hooks installed) built by
`D:\tools\reva_tmp\scripts\mkslice_match.py` (`.text` `0x140400000`–`0x140C00000`, `.rdata`, `.data`) and
loaded in Ghidra 12.1.3 / ReVa as `/pes2021_match.exe`.

Every row says what kind of evidence backs it. **Static** means read from code; it says nothing about
whether a value holds at runtime. **Live** means observed in a real match on this install.

## Findings

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| F1 | `match.stats()` gives home/away score, PK score, period (0–5), clock min/sec, announced added time. | Sider docs §12; Sider source `sider.cpp` `SCOREBOARD_INFO`/`SCOREBOARD_INFO2`, hook `copy_clock` | Documented; not yet sampled live by our module |
| F2 | Sider fires an undocumented Lua event **`goal_scored(ctx, gi)`** with `player_id`, `player_offset`, `home_or_away`, `player_name_on_shirt`. | Sider source `sider.cpp` `module_goal_scored`; installed `sider.log` line 6880: `{home_or_away=0, player_id=126918, player_name_on_shirt=GYÖKERES, player_offset=6216}` in Arsenal (101) vs Liverpool (103), 2026-10-21 02:27 | **Live** (one goal) |
| F3 | `player_id` is the game player id (126918 = Gyökeres), same id space as Player.bin / `public/jugadores.json`. | F2 + team 101 = Arsenal | Live, one sample |
| F4 | Own goals: the goal routine resolves a scorer only when `0x140A632F0(slot)` returns 0 (bit 18 of the slot's packed dword). Sider's asm calls its 2nd arg "not_an_own_goal" but the C code calls it `player_offset` and the live value was 6216. What `goal_scored` reports for an own goal is **unknown**. | Static: `0x140478190` lines 78–84; Sider `util.asm` vs `sider.cpp` | Open — needs a live own goal |
| F5 | Global match manager at `[0x1436F3DC8]`. | Static: read by `0x140478190`, `0x140A62D90`, `0x140A62EA0` | Static |
| F6 | Team object: `[mgr + 0x518 + side*8]` (side 0 home, 1 away); `mgr+0x1978` for side ≥ 2. | Static: `0x140A489D0` disassembly | Static |
| F7 | Team layout: `+0x00` side; `+0x04 + slot*4` roster index for 11 pitch slots; roster entries at `+0xA8 + index*0x128`, max 40. Global slot numbers 0–10 home, 11–21 away (`slot % 11`). | Static: `0x140A3AF90`, `0x140A3B2A0` | Static — lineup reading is a hypothesis until live |
| F8 | Player id = `u32(entry + 0x34) & 0x8FFBFFFF` (mode 2 of `0x140A62D90`); mode 0 reads `+0xE8` of an object from `0x141B59E20` (not analysed). | Static: `0x140A62D90` | Static |
| F9 | "Last ball event" record in `[mgr + 0x270]`: team at `+0x15C8`, slot at `+0x15CC`, alternate slot at `+0x1590` when `+0x1588 == 1`. | Static: `0x140478190` lines 231–235, 329–334 | Static |
| F10 | The dump at `content\memdump` was taken pre-match: `[0x1436F3DC8] == 0`. No live structure values can be read from it. | Dump read | Observed |
| F11 | At kick-off (first sample, clock 00:38, 2026-10-21 16:06) `[0x1436F3DC8]` = `0x6522FE60` held text (`ARGET_00`, `CAMERA_T`), and `+0x518/+0x520` held non-pointers. Either the global is set later than kick-off or the layout in F5–F7 is wrong. Reading through it crashed the game (freed memory, check-then-read race), now prevented by `ReadProcessMemory` + validation. | Live probe session `20261021_160527` | **Live: F5–F7 not confirmed** |

### Live sessions 2026-10-21 16:11 and 16:20 (Arsenal 101 vs Liverpool 103, 5 min; second with ET + PKs)

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| L1 | Score, clock, period 1–5, added time and PK score are all correct, through extra time and a 2–4 shootout. One sample after the shootout reported period 4 again (needs debounce). | `20261021_162012/events.ndjson` state lines | **Live** |
| L2 | `goal_scored` fired for every goal (5/5), with scorer id and side. | both sessions | **Live** |
| L3 | **Own goal**: Raya (Arsenal GK, 101520) `home_or_away=0` while the *away* score went 1-0 → 1-1. So `home_or_away` is the scorer's side, and an own goal = scorer side ≠ side whose score rose. Resolves F4 (one sample). | `20261021_161100` 19:15:37 | **Live**, 1 sample |
| L4 | `player_offset` = squad index × `0x128` (Gyökeres index 21 → 6216, Isak index 26 → 7696, Raya index 0 → 0). The 0x128-byte per-player records of F7 exist; per-player match data most likely lives there. | L5 order + offsets | Live, inferred |
| L5 | `MATCH_INFO` (`ctx.mis`) holds each team's full squad as `(player_id u32, marker u32)` pairs from `+0x288` (home) / `+0x918` (away), marker 65533/65534, 65535 ends. Order never changed during either match and Gyökeres (scorer at 3') is index 21, so it is the squad order, **not** the starting XI. | snapshots | **Live** |
| L6 | The `[0x1436F3DC8]` → `+0x518` path (F5/F6) gave invalid team objects for both full matches. The path from the global to the per-player records is still unknown. | lineup events "team side field is …" | **Live: F5/F6 refuted as read** |
| L7 | Team stats are **not** in any region those sessions dumped (mgr, mis, sci, sci2, team1): searched snapshots 7 (paused at 04:05) and 11 (paused at 15:52) of `20261021_161100` for the pause-menu values (passes 7→13 / 1→17, completed 6→11 / 1→16, possession 82→42, interceptions 1→2) as u8/u16/u32. Reference screenshots: `PES2021 2026-10-21 16-12-26_1.png` … `16-32-10_8.png` (team stats at 4:05, 15:52, 40:35, half-time, 95:52, after extra time, full time). | offline search | Negative, bounded to those regions |

### External read-only scan of the running game (post-match screen of session 162012, pid 14308)

Tool: `pes-collector/tools/live_scan.py` (OpenProcess with PROCESS_VM_READ | PROCESS_QUERY_INFORMATION only).
Reference values: screenshots `PES2021 2026-10-21 16-42-33_9.png` … `16-42-57_14.png` (individual and team stats).

| # | Finding | Status |
|---|---------|--------|
| L8 | The game keeps full **individual stats** (goals, penalty/free-kick goals, **assists**, shots, passes, crosses, fouls, minutes, touches, dribble distance, speed, duels, clearances, rating, heat map) and the list of players who played with their position, subs included. Saka's assist on Gyökeres' goal is recorded. | Seen on screen |
| L9 | The per-player table of L4 is found in 5 s by scanning for three squad ids 0x128 apart: home at `0x7E00F4`, away at `0x7E5F04` this run, each with a second identical copy `+0x2F00`. Entry = hit − 0xDC; name on shirt at entry+0x174; id at entry+0xDC and entry+0x1C0. It holds player data, **not** match stats: no field matched touches 17/4, passes 7/4, completed 6/4 or the ratings (as u8/u16/u32/float). | **Live** |
| L10 | Bounded negative searches over all private RW memory (2.1 GB): (a) records near each occurrence of Gyökeres'/Saka's id (±0x600) with touches/passes/completed pairs; (b) home/away blocks at a common distance ≤ 0x800 holding the final team stats as u32/u16 — only trivial-value pairs matched, none of (58,58), (13,7), (48,52), (94,94), (7,4); (c) float32 dribble 77.1 m near speed 13.7 km/h — only geometry. Stats are not stored as plain, fixed-layout counters next to each other, or are derived at display time. | Negative, bounded |

### Match stats in memory: found (2026-10-21, static + live, game pid 14308 on the post-match screen)

Route: the game exposes stat getters to its internal Lua by name. A `{const char* name, getter}` table at
`0x1425D4640` lists `StatsPlayerGoal` … `UnqStatsPlayerShootLong`; each getter calls `0x1406A7850(ctx, kind)`.

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| S1 | Stat kinds (getter immediates): goal 0, own goal 1, FK goal 2, PK goal 3, **assist 4**, shot 6, shot success 12, shot in frame 17, PK shot 21, pass 22, pass success 23, short 24/25, through 26/27, long 28/29, cross 30/31, tackle 49, tackle success 50, dispossess 51/52, clear 54, foul 55, offside 56, yellow 57, red 58, FK 61, indirect FK 62, corner 63, dribble 65/66, ball touch 67, snatch 77, pass cut (interception) 78, block 86, wedge 87, snatched 89/91/94, GK shots faced 131, in frame 132, saves 133, shots from PA 134. Up to 0xB0 kinds. | objdump of each getter | Static |
| S2 | Storage: `stats = [[ctx]+0xD0] + 0x750D0` (`0x140A3E8A0`); record(side, idx) = `stats + 0x64D8 + side*0x59650 + idx*0x2134` (`0x1408C7210`, idx = squad index 0–39); kind k = 9 u32 at `record + 8 + k*0x24`; `0x1408CA920` scopes: 0 = first half (u32 0–2), 1 = second half (3–5), 2 = ET1 (6), 3 = ET2 (7), 4 = (8, not the shootout: away scored 4 PKs, sum here 2 — meaning open), 5 = match total (0–7). | objdump `0x1408C7210`, `0x1408CA920` + jump table at `0x1408CA9DC` | Static |
| S3 | **Live check**: one unique block in 2.1 GB where Saka (home 18) and Gyökeres (home 21) match 10 values from the screenshots. Team sums equal the final team screen for passes 74 (58) / 78 (58), shots 3 (2) / 2 (2), fouls 3 / 0, interceptions (kind 78) 13 / 7, crosses 0 / 3, FKs 0 / 3, corners 0 / 0, saves 1 / 1; Isak 1 goal. Tackles (kind 49) 8 / 12 vs screen 4 / 4 — the screen probably shows another kind (50?), open. | `stats_find.py`, dump | **Live** |
| S4 | The stats block lives in its own private region of exactly 0x190000 bytes starting with u64 `{0, 0x18FFE0, 1}`; `[[ctx]+0xD0]` = region + 0x18. Unique among 1,743 regions, found in 0.16 s. No static pointer chain found yet (globals → X with X+0xD0 = block: none; BFS depth 2 from `[0x1436F3DC8]` post-match: none). | live scan | Live, **one match only** |
| S5 | Correction of F6: `0x140A489D0` is `[mgr + (side + 0xA3) * 0x28]` (an `lea rax,[rax+rax*4]` was missed) → home team `mgr+0x1978`, away `mgr+0x19A0`. In session 162012 these held `0x7E0018` / `0x7E5E28` = the tables of L9 (id at +0xDC, name at +0x174, + idx*0x128). The pointers are only set at some moments (0 in many snapshots and post-match). | objdump, probe mgr dumps | Live |
| S7 | **Second live match** (probe v2, session `20261021_180553`, Arsenal 1-1 Liverpool, 90'): signature found the block again (one candidate, at kick-off 0:41, so it exists during play); kick-off XI read from the team tables (validated by first squad id); subs seen live as slot changes at 74:14 away (Kerkez, Frimpong, Gakpo off; Robertson, Bradley, Chiesa on) and 87:37 home (Saka, Ødegaard, Gyökeres off; Madueke, Eze, Havertz on), matching the user's notes. Final pstats equal the post-match individual screen (OCR) for all 26 players who played: goals, FK goal (kind 2, Szoboszlai), assist (Havertz), shots (in frame), passes (completed), crosses, FKs, corners, interceptions (78), touches, clearances (54). Screen "Duelos X (Y)" = tackle kind 49 (50) (Calafiori 4 (1)); screen "Faltas (fuera de lugar)" = kind 55 (56). Yellow (kind 57) recorded at 74:14 on Zubimendi's foul, as noted by the user. | `probe_stats.py`, OCR of 28 captures | **Live** |
| S8 | The 3 u32 per half are 15-minute buckets: fouls at 31' and 33' land in word 2, 49' in word 3, 74' in word 4, 87' in word 5 (S7 session). | pstats timing | Live |
| S9 | **Possession candidate** (team-only stat): u32 pair at stats region `+0x181A10` (home) / `+0x181A14` (away), nothing else non-zero around them. Their sum equals a match-time counter (`+0xD4B80`, 16607 at full time). Home share over session `20261021_180553`: 69.1 → 61.6 → 54.1 → 51.3 % at 89:33; the counters stop at the final whistle (8680 / 8468 after stoppage time, unchanged in the 13 post-match dumps). Full-time team screen of that match: 50 % / 50 %, consistent with home = floor(50.62) and away = 100 − home (one data point; the rounding rule is inferred). Same screen vs memory sums: shots 7 (6) / 2 (1), fouls 3 (0) / 2 (0), corners 3 / 0, FKs 2 / 3, passes 60 (49) / 62 (48), crosses 0 / 1, interceptions 9 / 6, saves 0 / 5, and team-screen "Entradas" 1 / 0 = tackle success kind 50. Probe v3 emits possession as `possession`. **Third match** (session `20261021_183131`, Bayern 0-2 Real Madrid): counters 7560 / 9531 = 44.2 % but the screen shows 45 % / 55 %, so this pair is close (±1 point) but is **not** the screen's source. Code: the result screen draws `trunc(f * 100)` (`cvttss2si`, constant 100.0 at `0x14253EE30`) from float `f` at `[[ui+0x38]+0x940]` (function at `0x1420FE940`, near the `setPossessionGraph` string ref); who writes `f` is unknown. That draw function belongs to the class with vtable `0x142BECEB0` (which also binds `possession_home`/`possession_away` in `0x1420FF640`); no object of that class exists on the full-time result screen (live scan, pid 14392), so it is the in-match/half-time stats panel. No `movss` store to `+0x940` exists in the image (the data object is probably filled by a copy). Next step: open the half-time stats panel, find the live object by its vtable (`poss_vt_live.py`), read `f`, then match it against counters sampled at two moments. No float in [0.45, 0.46) / [0.50, 0.51) at the same offset of the stats region in both matches; no other u32 pair or 15-min bucket pair fits both screens. Same match vs memory: all other team stats equal; own goal (Neuer, kind 1), in-play PK goal (kind 3, period 5 shown during the kick), straight red after 2 yellows (kinds 57/58) recorded; a sent-off player does not change the team-table slots. **2026-10-22/23 (session `20261022_222536`, Arsenal 1-1 Real Madrid, paused at 76:53):** pair 6536 / 7553 (46.39 %), pause-menu stats screen 46 % / 54 %: third data point, consistent with home = trunc, away = 100 − home (2 of 3; Bayern–Real stays a point off). In every stored dump where the pair works, home + away = the time counter exactly. In the dumps of the two matches that left it at 0 (`20261021_183131` 2nd match, `20261021_190934` at 26:06 with the screen at 49 / 51) the time counter runs, no adjacent u32 pair in the 1.6 MB region sums to it (±3), and no pair grows at the pace of the time counter (ratio of sum growth to time growth ≈ 1) — the game does not write it in that region in those matches. Ruled out live (pid 21280, read-only `ReadProcessMemory`, stats screen open): no game pointer to the pair (the 8 qwords pointing at it are LuaJIT FFI cdata of the probe itself); no live object with vtable `0x142BECEB0` on the pause-menu stats screen; the exact share 0.463908 / 46.3908 (f32/f64) appears only in vertex buffers and noise; f32 pairs in [0.46, 0.47) summing to 1 are hundreds of unrelated hits. Scripts: `poss_dumps.py`, `poss_growth.py`, `poss_value.py`, `poss_panel.py`, `poss_wide.py`, `poss_exact.py` (session scratchpad, not in the repo). **2026-10-23 (session `20261023_003333`, probe v4, Arsenal vs team 108):** fourth data point: pair 5993 / 6179 = 49.24 %, stats screen 49 % / 51 % (home = trunc holds in 3 of 4). **Match time is `+0x7B518`:** it equals the pair's sum in all 230 stored dumps and live (12172); `+0xD4B68` and `+0xD4B80` hold the same value but one of the two stays 0 in each match (the first v4 build read `+0xD4B80` and sent `time: 0`). **Two-pause full-memory scan validated** (`poss_hunt_live.py`, read-only): pause 1 keeps every adjacent u32/f32 pair whose sum is ¼–4× the match time (19.1 M candidates, 3 min 44 s), pause 2 keeps pairs that both grew at that pace; the known pair came out first (rate 1.000). The runner-up, an f32 pair in seconds in a private 4 MB region, matched 51.3 % once but read 52.9 % against the screen's 49 % and reset between pauses: a timer, ruled out. Search closed (user, 2026-10-23): the pair works in the league's matches; a match that leaves it at 0 shows possession as unavailable. | `poss_hunt.py`, objdump of the runtime dump, dumps + live scan | Counter **used when filled** (collector `possession.js`), approximate ±1; source for the other matches open |
| S10 | A shot's counters rise together: shot (kind 6), shot in frame (17), goal (0), PK shot (21) and the opposing keeper's save (133) change in the **same** 2 s pstats sample. Shot lists derived per sample reconcile with the team totals (shots, on target, PK shots) and goals + own goals = score in all 5 recorded matches. Pass types add up: 24+26+28+30 = passes (22) and 25+27+29+31 = completed (23) in 3 of 3 full matches. Kinds 10/11/19/20/70/134/173 do not reconcile with anything and stay unused. | `pstats` replay of sessions `180553`, `183131` (×2), `190934`, `202647` | **Live** (recordings) |
| S11 | The probe's kick-off XI (team-table slots, S6) equals the save's lineup slot by slot in 7 of 8 team-matches, and each player's registered position equals the formation role of that slot. The team-table slot values **are** the save's `order` bytes (Arsenal 202647: `[0,2,3,8,6,10,12,18,17,14,21]` both), and the `ctx.mis` squad (L5) is the save roster in roster-slot order, so squad index = EDIT roster slot. The game's save is `Documents\KONAMI\eFootball PES 2021 SEASON UPDATE\<id>\save\EDIT00000000` (matches 5/6; the 6th, a Konami Cup lineup, was changed in game without saving). | Offline: `events.ndjson` vs `editDatabase.readTactics` | Offline (recordings + save) |
| S12 | **Pre-match XI and formation live in `ctx.mis` (MATCH_INFO)**: each team's game plan is copied there in the save's layout — plan (3 fluid variants × 0x21 bytes: unknown byte, roles of slots 1–10 as u8, 11 × (depth, lateral) u8) at **mis+0xE98** (home) / **mis+0x10F0** (away, +0x258), and the 40-byte `order` (roster slots; first 11 = XI by formation slot) at **+0x1E0** from the plan: **mis+0x1078** / **mis+0x12D0**. Changes on the pre-match screen (1 sub, then 2 swaps, then 1 sub + 2 swaps) go only to the menu's editing copy; at **kick-off** they were copied to `ctx.mis`, and the probe's first `lineup` event matched it exactly (same ids, same order). `ctx.mis` did not move between two probe sessions of the same game run. | `formation_scan.py` find/reread, Arsenal–Real Madrid friendly, PID 21280, log `scl_probe\_research\formation\LOG.md` A1–A5 | **Live, one session** |
| S13 | **Mid-match changes**: a new formation (kick-off variant → 3-5-2) and a moved player are written to `ctx.mis` + 0xE98 when leaving the Strategy menu (variants 1/2 untouched, so variant 0 = kick-off state). A position swap in the pause menu reached `ctx.mis` order on resume, but the **team tables and the slot copy in the stats region kept the kick-off order** for the next 90 s and the probe emitted no `lineup` (subs do change them, S7). Roles stay with the slot; players move between slots. Fluid play does not rewrite the plan: `ctx.mis` variants were stable over 90 s of play. Depth grows toward the rival goal; lateral 8 = left (moving a CF left: lateral 40 → 26). | Same session, LOG B1–B5 | **Live, one session** |
| S14 | Other copies, all in the save layout or as u32: the save image in memory (one big region), two plan pairs (home, away +0x248) in menu heap, a pre-match/pause **menu struct** (11 slot u32 + roles u32 at +0x34) freed when the menu closes, loose `order` copies (two, 0x81 apart) freed at kick-off, low-heap plan copies overwritten during play (one later held the probe's own JSON text), the team tables (+0x2F00 twin) and a slot copy in the stats region at block-relative `+0xCE5C8` (home) / `+0x127C18` (away, +0x59650 = side stride of S2). None of them followed the mid-match formation change except `ctx.mis`. Not found anywhere: the XI as 11 consecutive u32 player ids, roles or positions as u16/u32 (except the menu struct), positions as float. | Same session | **Live, one session** |
| S6 | Team table `+0x04 + slot*4` = squad index of each of the 11 players **on the pitch now**. Post-match it lists the final XI incl. the 4 subs who came on (Havertz, Madueke, Martinelli, G. Jesus) and not the 4 who went off (Rice, Trossard, Saka, Gyökeres), matching the ratings list. Substitutions = slot changes over time. | live read | Live (end state) |

### Post-match screens (OCR route, option 3 part 1, 2026-10-21)

`pes-collector/ocr/` reads the game's own stats screens from 1920x1080 captures:
- `captures.py <png...>`: screen type, team, roster (who played, subs included) with ratings, the selected player
  (blue row) and its 17 stats incl. **assists**, goalkeeper box, and both teams' stats with the clock or header.
- Text (titles, names, ratings) via Windows OCR (`pes-collector/tools/ocr.ps1`, es-ES). Digits via glyph templates
  (`glyphs.py`, `glyph_templates.json` built by `train_glyphs.py` from 4 labelled captures): Windows OCR skipped
  isolated digits such as "0" even on clean binarised crops.
- Hold-out test on **real captures** (`test_screens.py`, 6 team-stats captures never used in training, pause menu
  over live play and half/full-time panels): 120/120 cells exact. Individual-stats screens: only 2 captures exist and
  both are training data, so that screen is **not yet validated** on unseen captures.
- Known limits: one player per capture (the user scrolls the list); the selected player's rating is blue and not
  read (taken from any other capture of the same team); OCR misreads some letters ("Ø"→"U", "ö"→"ô"), so names
  must be matched against the squad ids (L5) rather than trusted; layout is specific to this resolution, language
  and scoreboard mod.

## Capability matrix (current)

| Metric | Source | Status |
|--------|--------|--------|
| Score, PK score, period, clock, added time | F1, L1 | **Confirmed live** (incl. ET and shootout) |
| Goal events + scorer id + side | F2/F3, L2 | **Confirmed live** (5 goals) |
| Own goals | L3 | **Confirmed live** (1 sample) |
| Assists | S1–S3, S7 (kind 4) | **Confirmed live** (2 matches); also on the post-match screen (OCR) |
| Squad of each team (ids) | L5 | **Confirmed live** (squad order, not XI) |
| Lineups (on-pitch XI), bench | S5–S7 | **Confirmed live**: kick-off XI and end XI |
| Substitutions | S6–S7 | **Confirmed live** (6 subs, minute to within the 2 s sample); slot change = sub when the new index was not on the pitch |
| Per-player match stats (goals, assists, shots, passes, touches, fouls, offsides, cards, tackles, saves…) | S1–S3, S7–S8 | **Confirmed live** (2 matches, 15-minute buckets) |
| Team stats | S3, S7 (sum of players) | **Confirmed live**; possession not located |
| Possession (team only) | S9 | **Partial**: the `+0x181A10` pair is used when the game fills it (`pes-collector/collector/possession.js`: home = trunc, away = 100 − home, last pair before the shootout; probe v4 adds the time counter to check the pair). It stayed 0 in the Bayern–Real replay and Como–Leipzig; there the summary says `possession: null`. Search for another source closed by the user (2026-10-23): the pair works in the league's matches |
| Formation / roles / positions (game plan) | S12–S13: `ctx.mis` + 0xE98 / + 0x10F0 | **Found live (one session)**: pre-match XI, kick-off formation and mid-match formation changes; not yet read by the probe |
| Pre-match confirmed XI | S12: `ctx.mis` order + 0x1078 / + 0x12D0 | **Found live (one session)**; equals the probe's first `lineup` |
| Players' real positions on the pitch (x, y) | S15: position snapshot block | **Found live (one session)**: all 22, refreshed one team at a time, ~2–3 s per player. Not per frame. Not read by the probe yet |
| Match ratings | S15 | Not found (stats record has no rating-like field during play) |
| Team ids, match length, subs allowed, ET/PK flags | Sider ctx (`set_match_settings`) | Confirmed live (sider.log 6396–6405) |

Nothing here is used by the website yet.

## Collector (match summary)

`pes-collector/collector/matchSummary.js` turns `events.ndjson` into one `scl.match/1` summary per match
(`splitMatches` → `summarizeMatch`); `toTournamentFields` writes the fields the tournament engine reads
(`homeGoals: "Name x2, Name"`, own goals left out). CLI: `node pes-collector/tools/summarize.mjs <session> [--json]`.
Not connected to Firestore or the tournament yet.

Rules: goals = score rises in `state`; scorer = the preceding `goal_scored` within 60 s whose pre-goal score matches
(the Neuer own goal came 18 s before the score change); penalty / FK / assist = the stat that rose with the goal
(assist only when exactly one team-mate gained one); shootout from `pk_*`, never goals; substitution = slot taken by
a player not on the pitch; status `finished` when the clock holds at 90:00 / 120:00 for 30 s or the match ends
after 90', `abandoned` when it ends before, else `live`.

Tests: `tests/pesCollector/matchSummary.test.js` (synthetic) and `matchSummary.sessions.test.js` (the four real
recordings, skipped when `E:\eFootball PES 2021\scl_probe` is missing). The abandoned replay of session
`20261021_183131` also matches the half-time screen (shots 5 (5) / 1 (0), passes 32 (27) / 28 (22), saves 0 / 5).

## Local bridge

`node pes-collector/bridge/bridge.mjs [--teams teams.json] [--once]` follows the newest recording every 2 s and
writes `<scl_probe>/_bridge/live.json` (match in progress) and `_bridge/matches/<start>_<home>-<away>.json` (one per
finished or abandoned match). `--teams` takes the Draft → PES assignment `{ "draftMap": { draftTeamId: gameTeamId },
"names": {…} }` (`pes_workspaces/{ws}.draftMap`, edited in `PesDraftPanel.jsx`); matches with a team outside it are
ignored. Sider's `home_team`/`away_team` are Team.bin ids (101 Arsenal FC, 103 Liverpool FC, 127 Bayern, 109 Real
Madrid, 4219 Como 1907, 5010 RB Leipzig, checked against `vendor/UML_Database` Team.bin), so the assignment applies
as is. Nothing is uploaded yet: destination and authentication are open (security audit).

Open: how in-game competitions show up. Friendlies recorded `tournament_id` 17 and 65535; a Konami Cup match has
not been recorded yet.

## Live validation procedure (scl_probe)

`pes-collector/sider/scl_probe.lua` is installed as `modules\scl_probe.lua` and registered in `sider.ini`
(backup `sider.ini.bak-before-scl-probe`; remove the `lua.module = "scl_probe.lua"` line to disable).
It only reads memory, checks every read with `VirtualQuery`, and turns itself off after any error.

1. Play an exhibition match (5 minutes is enough). Output goes to `E:\eFootball PES 2021\scl_probe\<session>\`.
2. Do these, pressing **F9** right after each and writing down the order:
   a shot on target; a shot off target; a foul; a corner; a substitution; a goal; if possible an own goal.
3. At 2–3 F9 marks, open the pause menu stats and note the values shown (shots, possession, passes…).
4. Then: `node pes-collector/tools/probe-diff.mjs list <session>` and
   `node pes-collector/tools/probe-diff.mjs find <session> team0 <seq>=<home shots> <seq>=<home shots> u8`.

What one session settles: F1 live, F7/F8 lineup layout (compare logged ids with the lineup screen),
substitution detection, and candidate offsets for the pause-menu counters.

## Konami Cup and friendlies (2026-10-21, static only)

League matches are played as friendlies and the knockouts in the Konami Cup. `Competition.bin` (decoded read-only from
`vendor/UML_Database/common/etc/pesdb`, 36-byte records: id at +5, type at +6, internal name at +8) lists
`FAKE_KONAMI` (37), `KONAMI_LEAGUE` (86), `SPE_FRIENDLY_MATCH` (45), `SPE_PRACTICE_MATCH` (46). Sider's
`tournament_id` was 17 and 65535 in the friendlies recorded so far, so it does not identify a friendly by itself, and
Sider modules use ids above 1024 for later stages (e.g. 1026 = 2 + 1024). **Live (2026-10-21, Arsenal vs 1230): a Konami Cup match reports `tournament_id` 48**, an id absent from
Competition.bin (it jumps 47 → 49). The collector tags summaries `match.competition` = konami_cup / friendly / other. Editing the cup from the PES editor would
need `CompetitionEntry.bin` / `CompetitionRegulation.bin` decoded (not supported); probably unnecessary if the cup's
teams are chosen inside the game's Cup mode.

## Formation in the probe (probe v4: implemented in the repo, not yet run in a match)

Tools of S12–S14: `pes-collector/tools/formationPlan.mjs` (a team's plan from the save, as search signatures) and
`pes-collector/tools/formation_scan.py` (read-only, `PROCESS_QUERY_INFORMATION | PROCESS_VM_READ`: find / reread /
watch / ptr / anchors). Step-by-step log of the session: `E:\eFootball PES 2021\scl_probe\_research\formation\LOG.md`.

- `scl_probe.lua` v4 reads, per side, the 0xA0-byte plan at `mis + 0xE98 + side*0x258` and the 40-byte order
  0x1E0 after it (with `ReadProcessMemory`, like the stats), checks the ranges (roles ≤ 12, depth 1–60,
  lateral ≤ 100, order < 40) and emits `{"t":"formation","side":s,"plan":hex,"order":[…40]}` at kick-off and
  whenever the bytes change. The strategy bytes after the variants are emitted raw but not used: only the variants
  and the order were checked live.
- The collector (`pes-collector/collector/formations.js`) keeps the kick-off state and each change with its clock
  as `summary.formations`; the match page draws the kick-off formation from it and lists the changes, and falls
  back to the save's plan only when that plan matches the XI (old recordings).
- The repo copy is v4; the copy installed in the game (`E:\eFootball PES 2021\modules\scl_probe.lua`) is still v3.
  To try it: back up the installed file, copy the new one, play a match, check `events.ndjson` for `formation`.
- External access (without Sider): the only static pointer to `ctx.mis` is Sider's own global at
  `sider.dll + 0x1C0638`; none from the PES2021.exe image into `[mis-0x40, mis]` (40 heap pointers). An external
  reader can take `mis` from the probe's `session` event, as `formation_scan.py anchors --mis` does.
- Still to validate: a second match and other teams (only Arsenal was edited; Real Madrid was only read);
  the away side under edits (the friendly did not let us edit the rival); a substitution during play (does `ctx.mis`
  order follow, as the team tables do?); the Konami Cup; whether the engine places players by `ctx.mis` order or by
  the team tables after a mid-match swap (S13; needs players' real positions or a visual check); the first byte of
  each variant (0 in every case seen); whether `mis` keeps its address across a game restart (it did across two
  probe sessions of one run).

## Player positions (S15, 2026-10-29, live, sessions 20261029_001439 and an unrecorded one)

Tool: `pes-collector/tools/pitch_scan.py` (read-only). Scans in metres with (x, height, z) found nothing per frame
(the first run fell before kick-off; the second gave 7 M moving triples, mostly bones and render data). A pair scan of
the game's high heap found the **position snapshot**:

- Private region of 0xF0000 bytes with header `{0, 0xEFFE0, 1}` (same allocator header as the stats region; the only
  region with it). Block at region + 0x253FC: 22 × f32 (x, y, z), 12 bytes each.
- Entry i = XI slot i in the order of the probe's `lineup` event (= formation order): 0–10 home, 11–21 away.
  Checked against the kick-off plan: GK at (−44.9, 0.1), CBs at z ±7, full-backs ±21, striker on the spot.
- Units: metres, origin at the centre spot, x = length (±52.5, home attacks +x in the first half), z = width
  (±34). y is small (0–1.5) and not a clean height.
- Refresh: not every frame. Each update rewrites ~10 entries of one team, alternating teams; 277 updates in 353 s
  (130 touches in the same window). Median speed between updates 3.5 m/s. Frozen during pauses. At kick-off only
  the home half is filled. What triggers an update is unknown (it is not shots, not touches).
- Shots: shooter's last snapshot position at the 3 shots of session 20261029_001439 was 23 m, 36 m and 12 m from the
  attacked goal (plausible), with the snapshot 0.6–2 s older than the probe's 2 s stats sample.
- No pointer to the block within 0x800 before it; the only `0x253FC` constant in the slice is in `.rdata` unwind
  data. The writer (and the per-frame source) is not found.
- Ratings: no f32 3–10 / u8 or u16 30–100 field common to the 22 records of the stats block during play.
