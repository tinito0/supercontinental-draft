"""Final per-player stats from a scl_probe v2 session (pstats diffs replayed in order).

    py probe_stats.py <session dir> [--all]

Each kind is 9 u32: 1st half x3, 2nd half x3, ET1, ET2, slot 8 (research doc S2). The total printed is the sum of
the first 8 (scope 5 of 0x1408CA920). Kind names come from the Lua getter table (S1).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

KIND_NAMES = {
    0: "goal", 1: "own_goal", 2: "fk_goal", 3: "pk_goal", 4: "assist", 6: "shot", 12: "shot_success",
    17: "shot_in_frame", 21: "pk_shot", 22: "pass", 23: "pass_ok", 24: "short", 25: "short_ok", 26: "through",
    27: "through_ok", 28: "long", 29: "long_ok", 30: "cross", 31: "cross_ok", 49: "tackle", 50: "tackle_ok",
    51: "dispossess", 52: "dispossess_ok", 54: "clear", 55: "foul", 56: "offside", 57: "yellow", 58: "red",
    61: "fk", 62: "indirect_fk", 63: "corner", 65: "dribble", 66: "dribble_ok", 67: "touch", 77: "snatch",
    78: "interception", 86: "block", 87: "wedge", 131: "gk_faced", 132: "gk_in_frame", 133: "gk_save",
    134: "shot_from_pa",
}


def replay(events_path: Path) -> dict:
    """{(side, idx): {"id": id, "kinds": {k: [9 values]}}} after the last pstats event."""
    players: dict = {}
    for line in events_path.read_text(encoding="utf-8").splitlines():
        event = json.loads(line)
        if event.get("t") != "pstats":
            continue
        for idx, change in event["p"].items():
            entry = players.setdefault((event["side"], int(idx)), {"id": change.get("id"), "kinds": {}})
            for k, values in (change.get("k") or {}).items():
                entry["kinds"][int(k)] = values
    return players


def total(values: list[int]) -> int:
    return sum(values[:8])


def main(session: Path, show_all: bool) -> None:
    players = replay(session / "events.ndjson")
    for (side, idx), entry in sorted(players.items()):
        named = {KIND_NAMES.get(k, f"k{k}"): total(v) for k, v in sorted(entry["kinds"].items())
                 if show_all or k in KIND_NAMES}
        shown = {name: value for name, value in named.items() if value}
        print(f"side {side} idx {idx:2d} id {entry['id']}: {shown}")
    team = {side: {} for side in (0, 1)}
    for (side, _), entry in players.items():
        for k, values in entry["kinds"].items():
            if k in KIND_NAMES:
                team[side][KIND_NAMES[k]] = team[side].get(KIND_NAMES[k], 0) + total(values)
    for side in (0, 1):
        print(f"team {side}: {dict(sorted(team[side].items()))}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), "--all" in sys.argv)
