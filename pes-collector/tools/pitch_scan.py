"""Read-only hunt for match ratings and on-pitch positions in a running PES2021.exe (research doc S15–).

Opens the game with PROCESS_QUERY_INFORMATION | PROCESS_VM_READ only (formation_scan.open_process).

  py pitch_scan.py anchors <pid>
  py pitch_scan.py ratings <pid> <out_dir> [shown ratings, e.g. 6.5,7,5.5]
        stats-region dump + every offset of the per-player record whose value looks like a rating for the 22
        players on the pitch (f32 3..10, or u8/u16 30..100 = rating x10). With shown ratings, also every place in
        memory where those values sit at one stride (f32, or u8 x10).
  py pitch_scan.py mark  <pid> <out_dir>     pass 1, while playing: every f32 triple (x, y, z) that fits the pitch
        in metres (|x| <= 60, -1 <= y <= 4, |z| <= 40, x and z not 0)
  py pitch_scan.py check <pid> <out_dir>     pass 2, while playing: candidates that still fit and moved
  py pitch_scan.py watch <pid> <out_dir> <samples> <interval_s>   rereads the survivors and groups them into
        entities: candidates that move with plausible player speed in every sample
  py pitch_scan.py snaps <pid> <out_file> <minutes>
        logs every change of the 22-position snapshot block (S15) with the wall clock, one JSON line each, to
        line it up with the probe's events (which moment makes the game take the snapshot?)
"""
import json
import os
import struct
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import formation_scan as fs  # noqa: E402

RECORD_BASE = 0x18 + 0x750D0 + 0x64D8
SIDE_STRIDE = 0x59650
RECORD_STRIDE = 0x2134
# Units: metres by default; PITCH_SCALE=100 searches centimetres.
SCALE = float(os.environ.get('PITCH_SCALE', '1'))
# PITCH_MODE=pair: the position is two adjacent floats (x, z) with no height between them.
PAIR = os.environ.get('PITCH_MODE') == 'pair'
# PITCH_MIN_ADDR=0x7FF400000000 limits pass 1 to the game's own high heap (the stats region lives there).
MIN_ADDR = int(os.environ.get('PITCH_MIN_ADDR', '0'), 0)
X_MAX, Z_MAX, Y_MIN, Y_MAX = 60.0 * SCALE, 40.0 * SCALE, -1.0 * SCALE, 4.0 * SCALE
MIN_MOVE, MAX_SPEED = 0.05 * SCALE, 12.0 * SCALE  # metres; metres per second


def stats_region(h):
    for base, size, kind in fs.writable_regions(h):
        if size == fs.STATS_REGION_SIZE and fs.read(h, base, 24) == fs.STATS_SIGNATURE:
            return base
    sys.exit('stats region not found: is a match loaded?')


def on_pitch(h):
    """{side: [11 squad indices]} from the team tables, or None for a side whose table is not set."""
    mgr = fs.u64(h, fs.MATCH_MANAGER)
    out = {}
    for side in (0, 1):
        team = fs.u64(h, mgr + fs.TEAM_PTR_OFFSET + side * fs.TEAM_PTR_STRIDE) if mgr else None
        raw = fs.read(h, team + 4, 44) if team else None
        slots = list(struct.unpack('<11I', raw)) if raw and len(raw) == 44 else None
        out[side] = slots if slots and all(s < 64 for s in slots) else None
    return out


def cmd_anchors(pid):
    h = fs.open_process(pid)
    print(f'stats region 0x{stats_region(h):X}')
    print(f'on pitch {on_pitch(h)}')


def records(region, slots):
    return [(side, idx, region + RECORD_BASE + side * SIDE_STRIDE + idx * RECORD_STRIDE)
            for side in (0, 1) for idx in (slots[side] or range(11))]


def cmd_ratings(pid, out, shown):
    h = fs.open_process(pid)
    region = stats_region(h)
    data = fs.read(h, region, fs.STATS_REGION_SIZE)
    os.makedirs(out, exist_ok=True)
    stamp = time.strftime('%H%M%S')
    open(os.path.join(out, f'stats_{stamp}.bin'), 'wb').write(data)
    slots = on_pitch(h)
    recs = [(side, idx, addr - region) for side, idx, addr in records(region, slots)]
    print(f'stats region 0x{region:X}, on pitch {slots}, dump stats_{stamp}.bin')
    hits = []
    for off in range(0, RECORD_STRIDE - 4):
        for fmt, lo, hi in (('<f', 3.0, 10.0), ('<B', 30, 100), ('<H', 30, 100)):
            if fmt != '<B' and off % 2:
                continue
            values = [struct.unpack_from(fmt, data, r + off)[0] for _, _, r in recs]
            if all(lo <= v <= hi for v in values) and len(set(values)) > 2:
                hits.append((off, fmt, values))
    for off, fmt, values in hits:
        shown_values = ' '.join(f'{v:.2f}' if fmt == '<f' else str(v) for v in values)
        print(f'  record+0x{off:X} {fmt}: {shown_values}')
    print(f'{len(hits)} record offsets look like ratings')
    if shown:
        search_shown(h, shown)


def search_shown(h, shown):
    """Places where the shown ratings sit at one stride, in either order of appearance (f32, or u8 rating x10)."""
    targets_f = np.array(shown, dtype=np.float32)
    targets_b = np.array([round(v * 10) for v in shown], dtype=np.uint8)
    found = 0
    for base, size, kind, addr, data in fs.chunks(h, overlap=0x400):
        arr = np.frombuffer(data[:len(data) - len(data) % 4], dtype='<f4')
        first = np.nonzero(np.abs(arr - targets_f[0]) < 0.051)[0]
        for i in first:
            for stride in range(1, 0x200):
                j = i + stride
                if j + stride >= len(arr):
                    break
                if abs(arr[j] - targets_f[1]) < 0.051 and (len(shown) < 3 or abs(arr[j + stride] - targets_f[2]) < 0.051):
                    print(f'  f32 0x{addr + i * 4:X} stride 0x{stride * 4:X}: {arr[i:i + 3 * stride:stride]}')
                    found += 1
        b = np.frombuffer(data, dtype=np.uint8)
        first = np.nonzero(b == targets_b[0])[0]
        for i in first[:200000]:
            for stride in range(1, 0x400):
                j = i + stride
                if j + stride >= len(b):
                    break
                if b[j] == targets_b[1] and (len(shown) < 3 or b[j + stride] == targets_b[2]):
                    if found < 400:
                        print(f'  u8 0x{addr + i:X} stride 0x{stride:X}')
                    found += 1
    print(f'{found} stride hits for the shown ratings')


def triples(data, addr):
    n = len(data) - len(data) % 4
    f = np.frombuffer(data[:n], dtype='<f4')
    if len(f) < 3:
        return np.empty(0, dtype=np.int64)
    x, y, z = f[:-2], f[1:-1], f[2:]
    if PAIR:
        with np.errstate(invalid='ignore'):
            ok = ((np.abs(x) <= X_MAX) & (np.abs(y) <= X_MAX) & (np.abs(x) > 0.5 * SCALE) & (np.abs(y) > 0.5 * SCALE)
                  & (x != np.round(x)) & (y != np.round(y)))
        return addr + np.nonzero(ok)[0].astype(np.int64) * 4
    with np.errstate(invalid='ignore'):
        ok = ((np.abs(x) <= X_MAX) & (np.abs(z) <= Z_MAX) & (y >= Y_MIN) & (y <= Y_MAX)
              & (np.abs(x) > 1e-3 * SCALE) & (np.abs(z) > 1e-3 * SCALE))
    return addr + np.nonzero(ok)[0].astype(np.int64) * 4


def cmd_mark(pid, out):
    h = fs.open_process(pid)
    t0 = time.time()
    parts, bases = [], []
    for base, size, kind, addr, data in fs.chunks(h, overlap=8):
        if kind == 'image' or base < MIN_ADDR:
            continue
        found = triples(data, addr)
        if len(found):
            parts.append(found)
            bases.append(np.full(len(found), base, dtype=np.int64))
    cand = np.unique(np.concatenate(parts))
    os.makedirs(out, exist_ok=True)
    np.save(os.path.join(out, 'mark.npy'), cand)
    np.save(os.path.join(out, 'mark_values.npy'), reread(h, cand))
    json.dump({'t': t0}, open(os.path.join(out, 'mark.json'), 'w'))
    print(f'{len(cand)} pitch-like triples in {time.time() - t0:.0f} s')


def reread(h, cand):
    """(n, 3) f32 values at each candidate address, NaN where unreadable. Reads each run of nearby candidates once."""
    vals = np.full((len(cand), 3), np.nan, dtype=np.float32)
    i = 0
    while i < len(cand):
        j = i
        while j + 1 < len(cand) and cand[j + 1] - cand[i] < 0x100000:
            j += 1
        start, end = int(cand[i]), int(cand[j]) + 12
        data = fs.read(h, start, end - start)
        if data and len(data) == end - start:
            arr = np.frombuffer(data[:len(data) - len(data) % 4], dtype='<f4')
            k = ((cand[i:j + 1] - start) // 4).astype(np.int64)
            third = np.zeros(len(k), dtype=np.float32) if PAIR else arr[k + 2]
            second, last = (third, arr[k + 1]) if PAIR else (arr[k + 1], arr[k + 2])
            vals[i:j + 1] = np.stack([arr[k], second, last], axis=1)
        i = j + 1
    return vals


def fits(v):
    with np.errstate(invalid='ignore'):
        if PAIR:
            return (np.abs(v[:, 0]) <= X_MAX) & (np.abs(v[:, 2]) <= X_MAX)
        return ((np.abs(v[:, 0]) <= X_MAX) & (np.abs(v[:, 2]) <= Z_MAX) & (v[:, 1] >= Y_MIN) & (v[:, 1] <= Y_MAX))


def cmd_check(pid, out):
    h = fs.open_process(pid)
    cand = np.load(os.path.join(out, 'mark.npy'))
    old = np.load(os.path.join(out, 'mark_values.npy'))
    new = reread(h, cand)
    move = np.hypot(new[:, 0] - old[:, 0], new[:, 2] - old[:, 2])
    keep = fits(new) & fits(old) & (move > MIN_MOVE)
    np.save(os.path.join(out, 'moved.npy'), cand[keep])
    print(f'{keep.sum()} of {len(cand)} still fit the pitch and moved')


def cmd_watch(pid, out, samples, interval):
    h = fs.open_process(pid)
    cand = np.load(os.path.join(out, 'moved.npy'))
    track = []
    for s in range(samples):
        t = time.time()
        track.append(reread(h, cand))
        print(f'sample {s + 1}/{samples} ({time.time() - t:.2f} s read)', flush=True)
        time.sleep(max(0.0, interval - (time.time() - t)))
    track = np.stack(track)  # (samples, n, 3)
    step = np.hypot(np.diff(track[:, :, 0], axis=0), np.diff(track[:, :, 2], axis=0))
    ok = fits(track.reshape(-1, 3)).reshape(samples, -1).all(axis=0)
    ok &= (step <= MAX_SPEED * interval * 1.5).all(axis=0) & ((step > MIN_MOVE).sum(axis=0) >= samples // 3)
    np.save(os.path.join(out, 'track.npy'), track[:, ok])
    np.save(os.path.join(out, 'track_addr.npy'), cand[ok])
    print(f'{ok.sum()} candidates move like a body on the pitch')
    # Group by 4 KB-aligned struct neighbourhood and report strides between neighbours that move alike.
    addrs = cand[ok]
    gaps = np.diff(addrs)
    values, counts = np.unique(gaps[(gaps >= 0x40) & (gaps <= 0x4000)], return_counts=True)
    order = np.argsort(-counts)[:20]
    print('most common gaps between moving triples:', ', '.join(f'0x{values[i]:X} x{counts[i]}' for i in order))


SNAP_SIGNATURE = struct.pack('<QQQ', 0, 0xEFFE0, 1)
SNAP_REGION_SIZE = 0xF0000
SNAP_OFFSET, SNAP_COUNT = 0x253FC, 22


def snap_region(h):
    for base, size, kind in fs.writable_regions(h):
        if size == SNAP_REGION_SIZE and fs.read(h, base, 24) == SNAP_SIGNATURE:
            return base
    return None


def cmd_snaps(pid, out_file, minutes):
    h = fs.open_process(pid)
    end, region, last = time.time() + minutes * 60, None, None
    with open(out_file, 'a', encoding='utf-8') as out:
        while time.time() < end:
            region = region or snap_region(h)
            if region is None:
                time.sleep(2)
                continue
            raw = fs.read(h, region + SNAP_OFFSET, SNAP_COUNT * 12)
            if raw is None:
                region = None
                continue
            if raw != last:
                pos = np.frombuffer(raw, '<f4').reshape(SNAP_COUNT, 3)
                out.write(json.dumps({'t': round(time.time(), 3), 'p': [[round(float(v), 2) for v in row] for row in pos]}) + '\n')
                out.flush()
                last = raw
            time.sleep(0.02)


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    cmd, pid, rest = argv[1], int(argv[2]), argv[3:]
    if cmd == 'anchors':
        cmd_anchors(pid)
    elif cmd == 'ratings':
        shown = [float(v) for v in rest[1].split(',')] if len(rest) > 1 else []
        cmd_ratings(pid, rest[0], shown)
    elif cmd == 'mark':
        cmd_mark(pid, rest[0])
    elif cmd == 'check':
        cmd_check(pid, rest[0])
    elif cmd == 'snaps':
        cmd_snaps(pid, rest[0], float(rest[1]))
    elif cmd == 'watch':
        cmd_watch(pid, rest[0], int(rest[1]), float(rest[2]))
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main(argv=sys.argv)
