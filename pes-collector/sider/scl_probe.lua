--[[
SCL match probe (diagnostic, READ-ONLY). Part of the Supercontinental PES 2021 collector research.

Never writes game memory. Every read goes through ReadProcessMemory (fails instead of faulting on freed or
invalid memory), and the module turns itself off after the first error instead of risking the game.

Output: <sider dir>\scl_probe\<session>\
  events.ndjson   one JSON object per line (every event carries c = {period, minute, second})
  NNNN_<label>_<region>.bin   raw memory snapshots for offline analysis (pes-collector/tools/probe-diff.mjs)

What it records (see docs/PES_MATCH_DATA_RESEARCH.md):
  - match.stats(): score, PK score, period, clock, added time (L1, confirmed live)
  - goal_scored: scorer id, scorer side, player_offset = squad index * 0x128 (L2–L3, confirmed live)
  - squads from MATCH_INFO (ctx.mis): (id u32, marker u32) pairs at +0x288 (+0x690 for away) (L5)
  - pstats: per-player match stats (S1–S4). The block is found by its region signature; every SAMPLE_EVERY_MS
    the changed stat kinds of each player are emitted as 9 u32 (1st half x3, 2nd half x3, ET1, ET2, slot 8).
  - lineup: the 11 squad indices on the pitch per team (S5–S6), emitted when they change. A changed slot is
    reported as slot_changes; whether it is a substitution or a position swap is left to the analysis.
  - possession: the two team ball-time counters (S9), the match-time counter and the home percentage, when the
    counters change. Some matches leave the counters at 0: the collector then reports possession as unknown.
  - formation: each team's game plan as the match uses it, from MATCH_INFO (S12–S13): the plan block (3 fluid
    variants of 0x21 bytes: unknown byte, roles of slots 1–10, 11 x (depth, lateral); then the strategy bytes)
    and the 40-byte order (roster slots; the first 11 = XI by formation slot). Emitted at kick-off and whenever
    the bytes change (the game copies them there when a menu change is confirmed).
  - pos (v5): the game's position snapshot (S15), 22 x (x, z) in metres, entry i = XI slot i (0–10 home), emitted
    when it changes. The game refreshes one team at a time, each player every 2–3 s: not a per-frame track.

Requires in sider.ini: lua.enabled = 1, luajit.ext.enabled = 1, match-stats.enabled = 1.
--]]

local m = {}

local SAMPLE_EVERY_MS = 2000
local SNAPSHOT_EVERY_MS = 60000
-- Raw region dumps (NNNN_*.bin, for probe-diff.mjs) are research only: 1.6 MB copied and written to disk on the game
-- thread every minute made the game stutter (2026-10-29: 42 MB in one match). Off unless a search needs them.
local RESEARCH_DUMPS = false
-- Events are written as they come but flushed to disk once per sample, not once per line.
local FLUSH_EVERY_MS = SAMPLE_EVERY_MS
local STATS_SEARCH_EVERY_MS = 5000

local ID_MASK = 0x3FFFF            -- ids are < 2^18; higher bits of the packed dword are flags (F8)

-- MATCH_INFO squad list (L5).
local MIS_TEAM_STRIDE = 0x690
local MIS_SQUAD_OFFSET = 0x288
local MIS_END_MARKER = 65535
local MAX_SQUAD = 40

-- MATCH_INFO game plans (S12, live 2026-10-22): plan at +0xE98 (home) / +0x10F0 (away), the order 0x1E0 after it.
local MIS_PLAN_OFFSET = 0xE98
local MIS_PLAN_STRIDE = 0x258
local PLAN_BYTES = 0xA0
local PLAN_VARIANT_BYTES = 0x21
local PLAN_VARIANTS = 3
local ORDER_OFFSET = 0x1E0
local ORDER_BYTES = 40
local MAX_ROLE = 12

-- Stats block (S2, S4): private region of exactly STATS_REGION_SIZE bytes starting with u64 {0, 0x18FFE0, 1}.
local STATS_REGION_SIZE = 0x190000
local STATS_HEADER = { 0, 0x18FFE0, 1 }
local STATS_RECORDS_OFFSET = 0x18 + 0x750D0 + 0x64D8
local SIDE_STRIDE = 0x59650
local RECORD_SIZE = 0x2134
local RECORD_WORDS = RECORD_SIZE / 4
local KIND_WORDS = 9
local KIND_FIRST_WORD = 2
local KINDS = math.floor((RECORD_SIZE - 8) / (KIND_WORDS * 4))
-- Record words outside the kind array (2 header words, 8 tail words): meaning unknown, reported raw.
local EXTRA_WORDS = { 0, 1 }
for i = KIND_FIRST_WORD + KINDS * KIND_WORDS, RECORD_WORDS - 1 do EXTRA_WORDS[#EXTRA_WORDS + 1] = i end

-- Possession (S9): two u32 ball-time counters (home, away) at this offset from the region base; their sum equals
-- the match-time counter. Their share matched the screen in 2 of 3 matches (a point off in the third), but in some
-- matches the game never fills them (both 0 while the clock runs). The match time goes with every event so the
-- collector can tell a filled pair from an empty one. The match time is +0x7B518: it equals the pair's sum in all
-- 230 stored dumps; +0xD4B68 and +0xD4B80 hold the same value but one of the two stays 0 in each match.
local POSSESSION_OFFSET = 0x181A10
local MATCH_TIME_OFFSET = 0x7B518

-- Team tables (S5–S6): [MATCH_MANAGER] + 0x1978 + side * 0x28. The pointers are only set at some moments,
-- so the last valid table is kept and re-validated on every read.
local MATCH_MANAGER = 0x1436F3DC8
local TEAM_PTR_OFFSET = 0x1978
local TEAM_PTR_STRIDE = 0x28
local TEAM_SLOTS_OFFSET = 0x04
local TEAM_ID_OFFSET = 0xDC
local ENTRY_STRIDE = 0x128
local PITCH_SLOTS = 11

-- Position snapshot (S15, live 2026-10-29): private region of 0xF0000 bytes starting with u64 {0, 0xEFFE0, 1};
-- 22 x f32 (x, y, z) at +0x253FC. Read every POS_EVERY_MS; only changes are emitted.
local POS_REGION_SIZE = 0xF0000
local POS_HEADER = { 0, 0xEFFE0, 1 }
local POS_OFFSET = 0x253FC
local POS_ENTRIES = 22
local POS_EVERY_MS = 100

local MEM_COMMIT, MEM_PRIVATE, PAGE_READWRITE = 0x1000, 0x20000, 0x04
local MAX_USER_ADDRESS = 0x7FFFFFFEFFFF

-- Regions dumped per full snapshot: name, function returning base address, size.
local REGIONS

local enabled = true
local context
local out_dir, session_dir
local ev_file
local seq = 0
local last_sample_ms, last_snapshot_ms, last_search_ms = 0, 0, 0
local last_state = {}
local in_match = false
local squads = {}
local stats_region
local pos_region, pos_buf, last_pos
local last_pos_ms, last_pos_search_ms = 0, 0
local stats_cur, stats_prev = {}, {}
local team_cache, lineups = {}, {}
local last_possession = {}
local last_formation = {}

local C
local NTDLL
local CURRENT_PROCESS
local last_flush_ms = 0

local function init_ffi()
    -- Sider modules get no pcall, so a clashing cdef cannot be caught: every name is prefixed (SCLP_) and
    -- bound to the real Win32 symbol with __asm__, as PCCEFootballDetails.lua does.
    ffi.cdef[[
        typedef struct {
            void *BaseAddress; void *AllocationBase; uint32_t AllocationProtect; uint16_t PartitionId;
            size_t RegionSize; uint32_t State; uint32_t Protect; uint32_t Type;
        } SCLP_mbi_t;
        size_t __stdcall SCLP_VirtualQuery(const void *, SCLP_mbi_t *, size_t) __asm__("VirtualQuery");
        int __stdcall SCLP_ReadProcessMemory(void *, const void *, void *, size_t, size_t *) __asm__("ReadProcessMemory");
        int __stdcall SCLP_CreateDirectoryA(const char *, void *) __asm__("CreateDirectoryA");
        uint64_t __stdcall SCLP_GetTickCount64(void) __asm__("GetTickCount64");
        size_t __stdcall SCLP_RtlCompareMemory(const void *, const void *, size_t) __asm__("RtlCompareMemory");
    ]]
    C = ffi.C
    -- ntdll is mapped in every process; RtlCompareMemory compares two stat records natively, so the Lua diff only
    -- runs for the few records that changed since the last sample.
    NTDLL = ffi.load("ntdll")
    CURRENT_PROCESS = ffi.cast("void*", -1)
end

-- Reads go through ReadProcessMemory on our own process instead of memory.read (a plain pointer copy).
-- A check-then-read (VirtualQuery, then memory.read) crashed the game on 2026-10-21: at kick-off the game frees
-- memory on another thread between the check and the copy. ReadProcessMemory fails cleanly instead of faulting.
local function read_into(addr, buf, n)
    if type(addr) ~= "number" or addr < 0x10000 or addr + n > MAX_USER_ADDRESS or n <= 0 then return 0 end
    local got = ffi.new("size_t[1]")
    if C.SCLP_ReadProcessMemory(CURRENT_PROCESS, ffi.cast("const void*", addr), buf, n, got) == 0 then return 0 end
    return tonumber(got[0])
end

local function read(addr, n)
    local buf = ffi.new("uint8_t[?]", n)
    if read_into(addr, buf, n) ~= n then return nil end
    return ffi.string(buf, n)
end

-- 64-bit values come back as LuaJIT cdata; tonumber keeps every value a plain Lua number.
local function u32(addr)
    local b = ffi.new("uint32_t[1]")
    if read_into(addr, b, 4) ~= 4 then return nil end
    return tonumber(b[0])
end

local function u64(addr)
    local b = ffi.new("uint64_t[1]")
    if read_into(addr, b, 8) ~= 8 then return nil end
    return tonumber(b[0])
end

local function now_ms()
    return tonumber(C.SCLP_GetTickCount64())
end

-- Minimal JSON encoder: numbers, booleans, strings, nested tables (arrays when keys are 1..n).
local function json(v)
    if type(v) == "cdata" then v = tonumber(v) end
    local t = type(v)
    if t == "number" then
        if v ~= v or v == math.huge or v == -math.huge then return "null" end
        return (v == math.floor(v)) and string.format("%d", v) or string.format("%.6g", v)
    elseif t == "boolean" then
        return tostring(v)
    elseif t == "string" then
        return '"' .. v:gsub('[%c"\\]', function(c)
            return string.format("\\u%04x", string.byte(c))
        end) .. '"'
    elseif t == "table" then
        local n = #v
        if n > 0 then
            local parts = {}
            for i = 1, n do parts[i] = json(v[i]) end
            return "[" .. table.concat(parts, ",") .. "]"
        end
        local keys = {}
        for k in pairs(v) do keys[#keys + 1] = tostring(k) end
        table.sort(keys)
        local parts = {}
        for _, k in ipairs(keys) do parts[#parts + 1] = json(k) .. ":" .. json(v[k]) end
        return "{" .. table.concat(parts, ",") .. "}"
    end
    return "null"
end

local function emit(kind, data)
    if not ev_file then return end
    data = data or {}
    data.t = kind
    data.ts = os.date("!%Y-%m-%dT%H:%M:%SZ")
    data.ms = now_ms()
    local st = match.stats()
    if st then data.c = { st.period or 0, st.clock_minutes or 0, st.clock_seconds or 0 } end
    ev_file:write(json(data), "\n")
end

local function flush_events(force)
    if not ev_file then return end
    local t = now_ms()
    if force or t - last_flush_ms >= FLUSH_EVERY_MS then
        last_flush_ms = t
        ev_file:flush()
    end
end

local function hex(n)
    return n and string.format("0x%X", tonumber(n)) or nil
end

local function mis_address()
    return context and context.mis and tonumber(ffi.cast("uint64_t", context.mis)) or nil
end

local function stats_ptr()
    local s = match.stats()
    return s and s.ptr and tonumber(ffi.cast("uint64_t", s.ptr)) or nil
end

-- Squad ids in MATCH_INFO order (L5); this is also the index order of the stats records and team tables.
local function read_squad(side)
    local mis = mis_address()
    if not mis then return {} end
    local base = mis + side * MIS_TEAM_STRIDE + MIS_SQUAD_OFFSET
    local ids = {}
    for i = 0, MAX_SQUAD - 1 do
        local id, marker = u32(base + i * 8), u32(base + i * 8 + 4)
        if not id or not marker or marker == MIS_END_MARKER then break end
        ids[#ids + 1] = id
    end
    return ids
end

local function write_region(label, name, base, size, index)
    local data = base and base ~= 0 and read(base, size)
    if not data then return end
    local file = string.format("%04d_%s_%s.bin", seq, label, name)
    local f = io.open(session_dir .. "\\" .. file, "wb")
    if f then
        f:write(data)
        f:close()
        index.regions[name] = { file = file, base = hex(base), size = size }
    end
end

local function snapshot(label)
    if not RESEARCH_DUMPS then return end
    seq = seq + 1
    local index = { seq = seq, label = label, regions = {} }
    local st = match.stats()
    if st then index.score = string.format("%d-%d", st.home_score or 0, st.away_score or 0) end
    for _, r in ipairs(REGIONS) do
        write_region(label, r.name, r.base(), r.size, index)
    end
    emit("snapshot", index)
end

-- Committed private read/write regions. Only metadata is queried here.
local function list_regions()
    local regions = {}
    local mbi = ffi.new("SCLP_mbi_t")
    local addr = 0x10000
    while addr < MAX_USER_ADDRESS do
        if C.SCLP_VirtualQuery(ffi.cast("const void*", addr), mbi, ffi.sizeof(mbi)) == 0 then break end
        local base = tonumber(ffi.cast("uint64_t", mbi.BaseAddress))
        local size = tonumber(mbi.RegionSize)
        if size == 0 then break end
        if mbi.State == MEM_COMMIT and mbi.Type == MEM_PRIVATE and mbi.Protect == PAGE_READWRITE then
            regions[#regions + 1] = { base = base, size = size }
        end
        addr = base + size
    end
    return regions
end

local function has_header(base, header)
    local h = ffi.new("uint64_t[3]")
    if read_into(base, h, 24) ~= 24 then return false end
    for i = 1, 3 do
        if tonumber(h[i - 1]) ~= header[i] then return false end
    end
    return true
end

local function has_stats_header(base)
    return has_header(base, STATS_HEADER)
end

local function find_pos_region()
    for _, r in ipairs(list_regions()) do
        if r.size == POS_REGION_SIZE and has_header(r.base, POS_HEADER) then
            pos_region, last_pos = r.base, nil
            pos_buf = pos_buf or ffi.new("float[?]", POS_ENTRIES * 3)
            emit("pos_block", { region = hex(pos_region) })
            return
        end
    end
end

-- x and z of the 22 entries, one decimal (10 cm), only when the game rewrote the block.
local function sample_positions()
    local n = POS_ENTRIES * 12
    if read_into(pos_region + POS_OFFSET, pos_buf, n) ~= n then
        pos_region = nil
        return
    end
    local raw = ffi.string(pos_buf, n)
    if raw == last_pos then return end
    last_pos = raw
    local p = {}
    for i = 0, POS_ENTRIES - 1 do
        p[#p + 1] = math.floor(pos_buf[i * 3] * 10 + 0.5) / 10
        p[#p + 1] = math.floor(pos_buf[i * 3 + 2] * 10 + 0.5) / 10
    end
    emit("pos", { p = p })
end

local function find_stats_region()
    local found = {}
    for _, r in ipairs(list_regions()) do
        if r.size == STATS_REGION_SIZE and has_stats_header(r.base) then found[#found + 1] = r.base end
    end
    if #found == 0 then return end
    stats_region = found[1]
    local all = {}
    for i, base in ipairs(found) do all[i] = hex(base) end
    emit("stats_block", { region = hex(stats_region), candidates = all })
    for side = 0, 1 do
        stats_cur[side] = ffi.new("uint32_t[?]", SIDE_STRIDE / 4)
        stats_prev[side] = ffi.new("uint32_t[?]", SIDE_STRIDE / 4)
    end
    snapshot("stats_found")
end

-- Changed kinds of one record (full 9 values each); words outside the kind array go to `x` by word index.
local function diff_record(cur, prev, first)
    local kinds, extra
    for k = 0, KINDS - 1 do
        local w = first + KIND_FIRST_WORD + k * KIND_WORDS
        for j = 0, KIND_WORDS - 1 do
            if cur[w + j] ~= prev[w + j] then
                local values = {}
                for i = 0, KIND_WORDS - 1 do values[i + 1] = cur[w + i] end
                kinds = kinds or {}
                kinds[tostring(k)] = values
                break
            end
        end
    end
    for _, i in ipairs(EXTRA_WORDS) do
        if cur[first + i] ~= prev[first + i] then
            extra = extra or {}
            extra[tostring(i)] = cur[first + i]
        end
    end
    return kinds, extra
end

local function sample_stats(side)
    local players = #(squads[side] or {})
    if players == 0 then return end
    local cur, prev = stats_cur[side], stats_prev[side]
    local n = players * RECORD_SIZE
    if read_into(stats_region + STATS_RECORDS_OFFSET + side * SIDE_STRIDE, cur, n) ~= n then return end
    local changed
    for idx = 0, players - 1 do
        local first = idx * RECORD_WORDS
        if NTDLL.SCLP_RtlCompareMemory(cur + first, prev + first, RECORD_SIZE) ~= RECORD_SIZE then
            local kinds, extra = diff_record(cur, prev, first)
            if kinds or extra then
                changed = changed or {}
                changed[tostring(idx)] = { id = squads[side][idx + 1], k = kinds, x = extra }
            end
        end
    end
    ffi.copy(prev, cur, n)
    if changed then emit("pstats", { side = side, p = changed }) end
end

local function sample_all_stats()
    if not stats_region then return end
    if not has_stats_header(stats_region) then
        emit("stats_block_lost", { region = hex(stats_region) })
        stats_region = nil
        return
    end
    sample_stats(0)
    sample_stats(1)
    local home, away = u32(stats_region + POSSESSION_OFFSET), u32(stats_region + POSSESSION_OFFSET + 4)
    if home and away and (home ~= last_possession[1] or away ~= last_possession[2]) then
        last_possession = { home, away }
        local total = home + away
        emit("possession", { home = home, away = away, time = u32(stats_region + MATCH_TIME_OFFSET),
            home_pct = total > 0 and math.floor(home * 1000 / total + 0.5) / 10 or nil })
    end
end

local function team_pointer(side)
    local mgr = u64(MATCH_MANAGER)
    local team = mgr and mgr ~= 0 and u64(mgr + TEAM_PTR_OFFSET + side * TEAM_PTR_STRIDE)
    return team and team ~= 0 and team or nil
end

-- Squad indices of the 11 on the pitch, or nil when the table does not belong to this team's squad.
local function read_lineup(side, team)
    local ids = squads[side]
    local first = u32(team + TEAM_ID_OFFSET)
    if not ids or not ids[1] or not first or bit.band(first, ID_MASK) ~= ids[1] then return nil end
    local b = ffi.new("uint32_t[?]", PITCH_SLOTS)
    if read_into(team + TEAM_SLOTS_OFFSET, b, PITCH_SLOTS * 4) ~= PITCH_SLOTS * 4 then return nil end
    local slots = {}
    for i = 0, PITCH_SLOTS - 1 do
        local idx = tonumber(b[i])
        if idx >= MAX_SQUAD then return nil end
        slots[i + 1] = idx
    end
    return slots
end

local function slot_changes(side, old, new)
    local changes = {}
    for i = 1, PITCH_SLOTS do
        if old[i] ~= new[i] then
            changes[#changes + 1] = {
                slot = i - 1, from_idx = old[i], to_idx = new[i],
                from_id = squads[side][old[i] + 1], to_id = squads[side][new[i] + 1],
            }
        end
    end
    return changes
end

local function sample_lineup(side)
    local live = team_pointer(side)
    local team = live or team_cache[side]
    if not team then return end
    local slots = read_lineup(side, team)
    if not slots then
        if team == team_cache[side] then team_cache[side] = nil end
        return
    end
    if team ~= team_cache[side] then
        team_cache[side] = team
        emit("team_table", { side = side, table = hex(team), side_field = u32(team) })
    end
    local old = lineups[side]
    if old and table.concat(old, ",") == table.concat(slots, ",") then return end
    local ids = {}
    for i, idx in ipairs(slots) do ids[i] = squads[side][idx + 1] end
    emit("lineup", { side = side, slots = slots, ids = ids, slot_changes = old and slot_changes(side, old, slots) })
    lineups[side] = slots
end

-- True when the bytes look like a game plan: roles 0..12, depth 1..60 and lateral 0..100 in every variant, and an
-- order of 40 roster slots below 40. Anything else (MATCH_INFO not ready, freed) is not emitted.
local function plan_is_valid(plan, order)
    for v = 0, PLAN_VARIANTS - 1 do
        local base = v * PLAN_VARIANT_BYTES
        for i = 1, 10 do
            if plan:byte(base + 1 + i) > MAX_ROLE then return false end
        end
        for i = 0, 10 do
            local depth, lateral = plan:byte(base + 12 + i * 2), plan:byte(base + 13 + i * 2)
            if depth < 1 or depth > 60 or lateral > 100 then return false end
        end
    end
    for i = 1, ORDER_BYTES do
        if order:byte(i) >= MAX_SQUAD then return false end
    end
    return true
end

local function sample_formation(side)
    local mis = mis_address()
    if not mis then return end
    local base = mis + MIS_PLAN_OFFSET + side * MIS_PLAN_STRIDE
    local plan, order = read(base, PLAN_BYTES), read(base + ORDER_OFFSET, ORDER_BYTES)
    if not plan or not order or not plan_is_valid(plan, order) then return end
    local key = plan .. order
    if key == last_formation[side] then return end
    last_formation[side] = key
    local slots = {}
    for i = 1, ORDER_BYTES do slots[i] = order:byte(i) end
    local plan_hex = plan:gsub(".", function(c) return string.format("%02x", c:byte()) end)
    emit("formation", { side = side, plan = plan_hex, order = slots })
end

local function sample()
    local st = match.stats()
    if not st then
        if in_match then
            in_match = false
            sample_all_stats()
            snapshot("end")
            emit("stats_gone", {})
            flush_events(true)
        end
        return
    end
    local t = now_ms()
    if not in_match then
        in_match = true
        squads = { [0] = read_squad(0), [1] = read_squad(1) }
        emit("stats_appeared", { sci = hex(stats_ptr()), squad_home = squads[0], squad_away = squads[1] })
        stats_region, lineups, team_cache, last_formation = nil, {}, {}, {}
        pos_region, last_pos, last_pos_search_ms = nil, nil, 0
        last_search_ms = 0
        last_snapshot_ms = t
    end
    if not stats_region and t - last_search_ms >= STATS_SEARCH_EVERY_MS then
        last_search_ms = t
        find_stats_region()
    end
    if pos_region and not has_header(pos_region, POS_HEADER) then
        emit("pos_block_lost", { region = hex(pos_region) })
        pos_region = nil
    end
    if not pos_region and t - last_pos_search_ms >= STATS_SEARCH_EVERY_MS then
        last_pos_search_ms = t
        find_pos_region()
    end
    sample_all_stats()
    sample_lineup(0)
    sample_lineup(1)
    sample_formation(0)
    sample_formation(1)
    local state = {
        home = st.home_score, away = st.away_score,
        pk_home = st.pk_home_score, pk_away = st.pk_away_score,
        period = st.period, added = st.added_minutes,
    }
    local changed = false
    for k, v in pairs(state) do
        if last_state[k] ~= v then changed = true end
    end
    if changed then
        local period_changed = last_state.period ~= state.period
        emit("state", state)
        last_state = state
        if period_changed then snapshot("period") end
    end
end

-- No pcall in Sider modules: Sider itself catches and logs a handler error. A handler that errors never
-- clears `busy`, so the next call sees it still set and turns the probe off instead of failing every frame.
local busy = false
local function guarded(fn)
    return function(...)
        if not enabled then return end
        if busy then
            enabled = false
            log("scl_probe disabled: the previous handler call failed (see the lua ERROR above)")
            emit("probe_error", { error = "handler failed; see sider.log" })
            return
        end
        busy = true
        fn(...)
        busy = false
    end
end

local SESSION_REUSE_MS = 10000
local session_opened_ms = 0

local function open_session(ctx)
    -- The game fires after_set_conditions twice in a row before a match: keep one session for both.
    if ev_file and now_ms() - session_opened_ms < SESSION_REUSE_MS then return end
    session_opened_ms = now_ms()
    if ev_file then ev_file:close() end
    session_dir = out_dir .. "\\" .. os.date("%Y%m%d_%H%M%S")
    C.SCLP_CreateDirectoryA(session_dir, nil)
    ev_file = io.open(session_dir .. "\\events.ndjson", "a")
    seq, last_state, in_match, squads = 0, {}, false, {}
    stats_region, lineups, team_cache, last_possession, last_formation = nil, {}, {}, {}, {}
    pos_region, last_pos, last_pos_search_ms = nil, nil, 0
    emit("session", {
        home_team = ctx.home_team, away_team = ctx.away_team, tournament_id = ctx.tournament_id,
        match_time = ctx.match_time, extra_time = ctx.extra_time, penalties = ctx.penalties,
        substitutions = ctx.substitutions, difficulty = ctx.difficulty, mis = hex(mis_address()),
        probe_version = 5,
    })
end

function m.after_set_conditions(ctx)
    open_session(ctx)
end

function m.goal_scored(ctx, gi)
    local st = match.stats()
    emit("goal_scored", {
        player_id = gi.player_id, player_offset = gi.player_offset, home_or_away = gi.home_or_away,
        name_on_shirt = gi.player_name_on_shirt,
        home = st and st.home_score, away = st and st.away_score,
    })
end

function m.display_frame(ctx)
    if not ev_file then return end
    local t = now_ms()
    if in_match and pos_region and t - last_pos_ms >= POS_EVERY_MS then
        last_pos_ms = t
        sample_positions()
    end
    if t - last_sample_ms < SAMPLE_EVERY_MS then return end
    last_sample_ms = t
    sample()
    flush_events()
    if in_match and t - last_snapshot_ms >= SNAPSHOT_EVERY_MS then
        last_snapshot_ms = t
        snapshot("tick")
    end
end

function m.context_reset(ctx)
    if ev_file then
        emit("context_reset", {})
        ev_file:close()
        ev_file = nil
    end
end

function m.init(ctx)
    if not ffi or not bit then
        error('scl_probe needs LuaJIT ffi/bit: set "luajit.ext.enabled = 1" in sider.ini')
    end
    init_ffi()
    context = ctx
    out_dir = ctx.sider_dir .. "scl_probe"
    C.SCLP_CreateDirectoryA(out_dir, nil)
    REGIONS = {
        { name = "sci", size = 0x200, base = stats_ptr },
        { name = "mis", size = 0x1000, base = mis_address },
        { name = "stats", size = STATS_REGION_SIZE, base = function() return stats_region end },
    }
    -- Sider keeps registered handlers in a separate lua_State (luaL_newstate + lua_xmove, sider.cpp), which
    -- the main state's GC does not see. A closure referenced only there gets collected and the next call
    -- jumps into freed memory (crash in sider.dll's LuaJIT VM). Keep every wrapper in the module table.
    for _, event in ipairs({ "after_set_conditions", "goal_scored", "display_frame", "context_reset" }) do
        local handler_name = "on_" .. event
        m[handler_name] = guarded(m[event])
        ctx.register(event, m[handler_name])
    end
    log("scl_probe ready (v5), output: " .. out_dir)
end

return m
