"""Read-only live search for the formation and pre-match XI of a running PES2021.exe
(docs/PES_MATCH_DATA_RESEARCH.md S12+). Signatures come from formationPlan.mjs (a team's saved plan).

Opens the process with PROCESS_QUERY_INFORMATION | PROCESS_VM_READ only, like live_scan.py: it cannot write.

    py formation_scan.py find    <pid> <plan.json> <out_dir> [--only NAMES] [--extra name=kind:v1,v2,...]
                                 [--regions-of candidates.json]   (search only the regions of earlier hits)
    py formation_scan.py reread  <pid> <candidates.json> [--out FILE]
    py formation_scan.py watch   <pid> <candidates.json> <seconds> <count>
    py formation_scan.py ptr     <pid> <address> [--back 0x4000]

Needs numpy (installed for the default py, user site: so not `py -I`).
    py formation_scan.py anchors <pid> [--mis 0x...]

Kinds for --extra: u8, u16, u32 (values), ids (u32 player ids, masked), hex (raw bytes).
"""
import ctypes
import importlib.util
import json
import os
import struct
import sys
import time
from pathlib import Path

# live_scan.py lives next to this file; -I keeps the script folder off sys.path, so load it by path.
_spec = importlib.util.spec_from_file_location("live_scan", Path(__file__).with_name("live_scan.py"))
live_scan = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(live_scan)
kernel32, MBI, read = live_scan.kernel32, live_scan.MBI, live_scan.read

MEM_COMMIT = 0x1000
WRITABLE = {0x04, 0x08, 0x40, 0x80}  # RW, WRITECOPY, RWX, RWX-COPY: every page that can hold live data
MAX_ADDRESS = live_scan.MAX_ADDRESS
CHUNK = live_scan.CHUNK
ID_MASK = live_scan.ID_MASK
CONTEXT = 0x100
WINDOW = 0x4000
MAX_HITS_PER_SIG = 64
IMAGE_BASE = 0x140000000
MATCH_MANAGER = 0x1436F3DC8
TEAM_PTR_OFFSET, TEAM_PTR_STRIDE = 0x1978, 0x28
STATS_SIGNATURE = struct.pack("<QQQ", 0, 0x18FFE0, 1)
STATS_REGION_SIZE = 0x190000


def open_process(pid):
    handle = kernel32.OpenProcess(live_scan.PROCESS_QUERY_INFORMATION | live_scan.PROCESS_VM_READ, False, pid)
    if not handle:
        sys.exit(f"OpenProcess failed: {ctypes.get_last_error()}")
    return handle


def writable_regions(handle):
    """(base, size, type) of every committed writable region: private heap, mapped views and image .data."""
    mbi, addr = MBI(), 0x10000
    while addr < MAX_ADDRESS:
        if not kernel32.VirtualQueryEx(handle, ctypes.c_void_p(addr), ctypes.byref(mbi), ctypes.sizeof(mbi)):
            break
        base, size = mbi.BaseAddress or 0, mbi.RegionSize
        if size == 0:
            break
        if mbi.State == MEM_COMMIT and (mbi.Protect & 0xFF) in WRITABLE and not mbi.Protect & 0x100:
            yield base, size, {0x20000: "private", 0x40000: "mapped", 0x1000000: "image"}.get(mbi.Type, hex(mbi.Type))
        addr = base + size


def chunks(handle, overlap, only_bases=None):
    """(region_base, region_size, region_type, chunk_address, bytes) over all writable memory, or only over the
    regions whose base is in only_bases (a full pass over a running match takes minutes)."""
    for base, size, kind in writable_regions(handle):
        if only_bases is not None and base not in only_bases:
            continue
        offset = 0
        while offset < size:
            n = min(CHUNK, size - offset)
            data = read(handle, base + offset, n)
            if data:
                yield base, size, kind, base + offset, data
            if offset + n >= size:
                break
            offset += n - overlap


def u64(handle, addr):
    data = read(handle, addr, 8)
    return struct.unpack("<Q", data)[0] if data and len(data) == 8 else None


# --- signatures --------------------------------------------------------------------------------------------------

def pack(kind, values):
    if kind == "hex":
        return bytes.fromhex(values)
    fmt = {"u8": "B", "u16": "H", "u32": "I"}[kind]
    return struct.pack(f"<{len(values)}{fmt}", *values)


def signatures_from_plan(plan):
    """name → (kind, values). Exact byte patterns except 'ids', matched with the id mask."""
    roles = plan["roles"][1:]
    pos = [v for pair in plan["pos"] for v in pair]
    sigs = {
        "xi_ids": ("ids", plan["lineup"]),
        "order40": ("u8", plan["order"]),
        "order11": ("u8", plan["order"][:11]),
        "slots_u32": ("u32", plan["order"][:11]),
        "slots_u16": ("u16", plan["order"][:11]),
        "variant0": ("hex", plan["variants"][0][2:]),  # 32 bytes after the unknown first byte
        "roles_u8": ("u8", roles),
        "roles_u16": ("u16", roles),
        "roles_u32": ("u32", roles),
        "pos_u8": ("u8", pos),
        "pos_u16": ("u16", pos),
        "pos_u32": ("u32", pos),
    }
    for v, variant in enumerate(plan["variants"][1:], start=1):
        sigs[f"variant{v}"] = ("hex", variant[2:])
    return sigs


def find_ids(words, ids, stride):
    """Offsets of len(ids) masked u32 ids `stride` bytes apart. `words` is the chunk as an aligned u32 numpy view:
    a 2-byte needle search (live_scan.py) is far too slow over the 2 GB of a running match."""
    import numpy as np
    step = stride // 4
    span = step * (len(ids) - 1)
    masked = words & ID_MASK
    starts = np.nonzero(masked[:len(masked) - span] == ids[0])[0] if len(masked) > span else []
    hits = []
    for start in starts:
        if all(int(masked[start + k * step]) == ids[k] for k in range(1, len(ids))):
            hits.append(int(start) * 4)
    return hits


def find_exact(data, needle):
    hits, i = [], data.find(needle)
    while i != -1:
        hits.append(i)
        i = data.find(needle, i + 1)
    return hits


def scan(handle, sigs, only_bases=None):
    found = {name: [] for name in sigs}
    needles = {name: None if kind == "ids" else pack(kind, values) for name, (kind, values) in sigs.items()}
    started, scanned = time.time(), 0
    import numpy as np
    for base, size, rkind, addr, data in chunks(handle, overlap=0x200, only_bases=only_bases):
        scanned += len(data)
        words = np.frombuffer(data[:len(data) - len(data) % 4], dtype="<u4")
        for name, (kind, values) in sigs.items():
            if len(found[name]) >= MAX_HITS_PER_SIG:
                continue
            if kind == "ids":
                offsets = [(o, s) for s in (4, 8) for o in find_ids(words, values, s)]
            else:
                offsets = [(o, None) for o in find_exact(data, needles[name])]
            for o, stride in offsets:
                hit = addr + o
                if any(h["addr"] == hit for h in found[name]):
                    continue
                found[name].append({"name": name, "addr": hit, "stride": stride, "regionBase": base,
                                    "regionSize": size, "regionType": rkind, "offset": hit - base})
    return found, scanned, time.time() - started


def decode(entry, handle):
    """Current value at a candidate, in the signature's own format."""
    kind, values = entry["kind"], entry["values"]
    if kind == "ids":
        stride = entry["stride"] or 4
        data = read(handle, entry["addr"], stride * len(values))
        if not data:
            return None
        return [struct.unpack_from("<I", data, k * stride)[0] & ID_MASK for k in range(len(values))]
    length = len(pack(kind, values))
    data = read(handle, entry["addr"], length)
    if not data:
        return None
    if kind == "hex":
        return data.hex()
    fmt = {"u8": "B", "u16": "H", "u32": "I"}[kind]
    return list(struct.unpack(f"<{len(values)}{fmt}", data))


def diff(old, new):
    if new is None:
        return "unreadable"
    if old == new:
        return "same"
    if isinstance(old, str):
        a, b = bytes.fromhex(old), bytes.fromhex(new)
        return "changed bytes " + ",".join(str(i) for i in range(len(a)) if a[i] != b[i])
    return "changed at " + ",".join(str(i) for i in range(len(old)) if old[i] != new[i])


# --- commands ----------------------------------------------------------------------------------------------------

def cmd_find(pid, plan_file, out_dir, only=None, extra=(), regions_of=None):
    handle = open_process(pid)
    only_bases = None
    if regions_of:
        only_bases = {c["regionBase"] for c in json.loads(Path(regions_of).read_text(encoding="utf-8"))}
    plan = json.loads(Path(plan_file).read_text(encoding="utf-8"))
    sigs = signatures_from_plan(plan)
    for spec in extra:
        name, rest = spec.split("=", 1)
        kind, raw = rest.split(":", 1)
        sigs[name] = (kind, raw if kind == "hex" else [int(v, 0) for v in raw.split(",")])
    if only:
        sigs = {k: v for k, v in sigs.items() if k in only}
    plain = dict(sigs)
    found, scanned, seconds = scan(handle, sigs, only_bases)
    os.makedirs(out_dir, exist_ok=True)
    candidates = []
    for name, hits in found.items():
        kind, values = plain[name]
        for hit in hits:
            entry = {**hit, "kind": kind, "values": values}
            context = read(handle, hit["addr"] - CONTEXT, 2 * CONTEXT)
            window = read(handle, hit["addr"] - WINDOW, 2 * WINDOW)
            entry["context"] = context.hex() if context else None
            if window:
                Path(out_dir, f"{name}_{hit['addr']:X}.bin").write_bytes(window)
            entry["value"] = decode(entry, handle)
            candidates.append(entry)
    Path(out_dir, "candidates.json").write_text(json.dumps(candidates, indent=1), encoding="utf-8")
    print(f"scanned {scanned / 2**20:.0f} MB in {seconds:.1f}s")
    for name in plain:
        hits = found[name]
        listed = " ".join(f"0x{h['addr']:X}({h['regionType']} base 0x{h['regionBase']:X}+0x{h['offset']:X}"
                          f"{' s' + str(h['stride']) if h['stride'] else ''})" for h in hits[:12])
        print(f"  {name:10} {len(hits):3} {listed}{' …' if len(hits) > 12 else ''}")
    print(f"-> {Path(out_dir, 'candidates.json')}")


def cmd_reread(pid, candidates_file, out_file=None):
    handle = open_process(pid)
    candidates = json.loads(Path(candidates_file).read_text(encoding="utf-8"))
    for entry in candidates:
        new = decode(entry, handle)
        print(f"  {entry['name']:10} 0x{entry['addr']:X} {diff(entry['value'], new):28} {new}")
        entry["previous"], entry["value"] = entry["value"], new
    if out_file:
        Path(out_file).write_text(json.dumps(candidates, indent=1), encoding="utf-8")


def cmd_watch(pid, candidates_file, seconds, count):
    handle = open_process(pid)
    candidates = json.loads(Path(candidates_file).read_text(encoding="utf-8"))
    for n in range(count):
        changed = []
        for entry in candidates:
            new = decode(entry, handle)
            if new != entry["value"]:
                changed.append(f"{entry['name']}@0x{entry['addr']:X} {diff(entry['value'], new)}")
                entry["value"] = new
        print(f"[{n * seconds:4d}s] {'stable' if not changed else '; '.join(changed)}", flush=True)
        if n + 1 < count:
            time.sleep(seconds)


def cmd_ptr(pid, target, back):
    """Every qword pointing into [target-back, target], and whether it lives in the image (static)."""
    import numpy as np  # heap pointers share their high dword with millions of others: a byte search is too slow
    handle = open_process(pid)
    low, hits = target - back, []
    for base, size, kind, addr, data in chunks(handle, overlap=0):
        usable = len(data) - len(data) % 8
        words = np.frombuffer(data[:usable], dtype="<u8")
        for index in np.nonzero((words >= low) & (words <= target))[0]:
            hits.append((addr + int(index) * 8, int(words[index]), kind, base))
    for where, value, kind, base in sorted(set(hits)):
        static = " STATIC" if kind == "image" else ""
        print(f"  [0x{where:X}] = 0x{value:X} (target-0x{target - value:X}) {kind} base 0x{base:X}{static}")
    print(f"{len(set(hits))} pointers")


def cmd_anchors(pid, mis=None):
    handle = open_process(pid)
    mgr = u64(handle, MATCH_MANAGER)
    print(f"mgr [0x{MATCH_MANAGER:X}] = {hex(mgr) if mgr is not None else 'unreadable'}")
    if mgr:
        for side in (0, 1):
            team = u64(handle, mgr + TEAM_PTR_OFFSET + side * TEAM_PTR_STRIDE)
            slots = read(handle, team + 4, 44) if team else None
            shown = list(struct.unpack("<11I", slots)) if slots and len(slots) == 44 else None
            print(f"  team[{side}] = {hex(team) if team is not None else 'unreadable'} slots {shown}")
    for base, size, kind in writable_regions(handle):
        if size == STATS_REGION_SIZE and read(handle, base, 24) == STATS_SIGNATURE:
            print(f"stats region 0x{base:X} (block 0x{base + 0x18:X})")
    if mis:
        print(f"mis 0x{mis:X} squad head {read(handle, mis + 0x288, 32).hex() if read(handle, mis + 0x288, 32) else 'unreadable'}")


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    command, pid = argv[1], int(argv[2])
    rest = argv[3:]
    flag = lambda name: rest[rest.index(name) + 1] if name in rest else None
    if command == "find":
        only = flag("--only")
        extra = [rest[i + 1] for i, a in enumerate(rest) if a == "--extra"]
        cmd_find(pid, rest[0], rest[1], only.split(",") if only else None, extra, flag("--regions-of"))
    elif command == "reread":
        cmd_reread(pid, rest[0], flag("--out"))
    elif command == "watch":
        cmd_watch(pid, rest[0], int(rest[1]), int(rest[2]))
    elif command == "ptr":
        cmd_ptr(pid, int(rest[0], 0), int(flag("--back") or "0x4000", 0))
    elif command == "anchors":
        cmd_anchors(pid, int(flag("--mis"), 0) if flag("--mis") else None)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
