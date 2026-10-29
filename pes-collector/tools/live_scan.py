"""Read-only scan of a running PES2021.exe for the per-player match table (docs/PES_MATCH_DATA_RESEARCH.md L4).

Opens the process with PROCESS_QUERY_INFORMATION | PROCESS_VM_READ only (it cannot write), walks its committed
private read/write memory and looks for three squad ids, in squad order, 0x128 bytes apart (low 18 bits of each
dword). Every hit is dumped with a window around it for offline analysis.

    py -I live_scan.py <pid> <out_dir> <home_id1,home_id2,home_id3> <away_id1,away_id2,away_id3>
"""
import ctypes
import ctypes.wintypes as wt
import os
import struct
import sys
import time

PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_VM_READ = 0x0010
MEM_COMMIT, MEM_PRIVATE, PAGE_READWRITE = 0x1000, 0x20000, 0x04

ENTRY_STRIDE = 0x128
ID_MASK = 0x3FFFF
WINDOW_BEFORE = 0x8000
WINDOW_AFTER = 40 * ENTRY_STRIDE + 0x8000
CHUNK = 64 * 1024 * 1024
OVERLAP = 3 * ENTRY_STRIDE
MAX_ADDRESS = 0x7FFFFFFEFFFF


class MBI(ctypes.Structure):
    _fields_ = [("BaseAddress", ctypes.c_void_p), ("AllocationBase", ctypes.c_void_p),
                ("AllocationProtect", wt.DWORD), ("PartitionId", wt.WORD), ("RegionSize", ctypes.c_size_t),
                ("State", wt.DWORD), ("Protect", wt.DWORD), ("Type", wt.DWORD)]


kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
kernel32.OpenProcess.restype = wt.HANDLE
kernel32.VirtualQueryEx.argtypes = [wt.HANDLE, ctypes.c_void_p, ctypes.POINTER(MBI), ctypes.c_size_t]
kernel32.VirtualQueryEx.restype = ctypes.c_size_t
kernel32.ReadProcessMemory.argtypes = [wt.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t,
                                       ctypes.POINTER(ctypes.c_size_t)]
kernel32.ReadProcessMemory.restype = wt.BOOL


def regions(handle):
    mbi, addr = MBI(), 0x10000
    while addr < MAX_ADDRESS:
        if not kernel32.VirtualQueryEx(handle, ctypes.c_void_p(addr), ctypes.byref(mbi), ctypes.sizeof(mbi)):
            break
        base, size = mbi.BaseAddress or 0, mbi.RegionSize
        if size == 0:
            break
        if mbi.State == MEM_COMMIT and mbi.Type == MEM_PRIVATE and mbi.Protect == PAGE_READWRITE:
            yield base, size
        addr = base + size


def read(handle, addr, size):
    buf = ctypes.create_string_buffer(size)
    got = ctypes.c_size_t()
    if not kernel32.ReadProcessMemory(handle, ctypes.c_void_p(addr), buf, size, ctypes.byref(got)):
        return None
    return buf.raw[:got.value]


def find_hits(data, ids):
    """Offsets where the three ids (masked) sit ENTRY_STRIDE apart. Candidates come from a fast search of the
    id's low 16 bits, then the full masked check."""
    a, b, c = ids
    needle = struct.pack("<H", a & 0xFFFF)
    hits, i = [], data.find(needle)
    limit = len(data) - 2 * ENTRY_STRIDE - 4
    while i != -1 and i <= limit:
        if i % 4 == 0:
            if (struct.unpack_from("<I", data, i)[0] & ID_MASK == a
                    and struct.unpack_from("<I", data, i + ENTRY_STRIDE)[0] & ID_MASK == b
                    and struct.unpack_from("<I", data, i + 2 * ENTRY_STRIDE)[0] & ID_MASK == c):
                hits.append(i)
        i = data.find(needle, i + 1)
    return hits


def main(pid, out_dir, home, away):
    os.makedirs(out_dir, exist_ok=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
    if not handle:
        sys.exit(f"OpenProcess failed: {ctypes.get_last_error()}")
    started, scanned, found = time.time(), 0, []
    for base, size in regions(handle):
        offset = 0
        while offset < size:
            n = min(CHUNK, size - offset)
            data = read(handle, base + offset, n)
            if data:
                scanned += len(data)
                for side, ids in (("home", home), ("away", away)):
                    for h in find_hits(data, ids):
                        found.append((side, base + offset + h))
            if offset + n >= size:
                break
            offset += n - OVERLAP
    found = sorted(set(found), key=lambda f: f[1])
    print(f"scanned {scanned / 2**20:.0f} MB in {time.time() - started:.1f}s, {len(found)} hits")
    for k, (side, addr) in enumerate(found):
        window = read(handle, addr - WINDOW_BEFORE, WINDOW_BEFORE + WINDOW_AFTER)
        name = f"hit{k}_{side}_{addr:X}.bin"
        if window:
            with open(os.path.join(out_dir, name), "wb") as f:
                f.write(window)
        print(f"  {side} 0x{addr:X} -> {name if window else 'window unreadable'}")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    parse = lambda s: tuple(int(x) for x in s.split(","))
    main(int(sys.argv[1]), sys.argv[2], parse(sys.argv[3]), parse(sys.argv[4]))
