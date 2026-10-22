"""Hold-out check of the glyph reader on REAL game captures (not synthetic): screens not used by train_glyphs.py.
Expected values were read by hand from each capture. Skipped when the captures are not on this machine.

    py -m unittest test_screens   (from pes-collector/ocr; set PES_CAPTURES to another folder if needed)
"""
from __future__ import annotations

import os
import unittest
from pathlib import Path

from PIL import Image

from glyphs import GlyphReader
from screens import TEAM_STATS_MENU, TEAM_STATS_PANEL, read_layout

CAPTURES = Path(os.environ.get("PES_CAPTURES", r"E:\eFootball PES 2021"))
LABELS = TEAM_STATS_MENU.labels


def team(home: list[str], away: list[str]) -> dict[str, dict[str, str]]:
    return {"home": dict(zip(LABELS, home)), "away": dict(zip(LABELS, away))}


HOLD_OUT = [
    ("PES2021 2026-10-21 16-12-26_1.png", TEAM_STATS_MENU, team(
        ["82%", "1 (1)", "0 (0)", "0", "1", "7 (6)", "0", "0", "0", "0"],
        ["18%", "0 (0)", "1 (0)", "0", "0", "1 (1)", "0", "1", "0", "0"])),
    ("PES2021 2026-10-21 16-13-24_3.png", TEAM_STATS_MENU, team(
        ["42%", "1 (1)", "1 (0)", "0", "1", "13 (11)", "0", "1", "0", "0"],
        ["58%", "1 (0)", "1 (0)", "0", "0", "17 (16)", "1", "2", "0", "0"])),
    ("PES2021 2026-10-21 16-15-56_4.png", TEAM_STATS_MENU, team(
        ["50%", "3 (2)", "4 (0)", "0", "1", "29 (24)", "0", "3", "0", "1"],
        ["50%", "2 (1)", "1 (0)", "1", "3", "31 (27)", "2", "3", "0", "1"])),
    ("PES2021 2026-10-21 16-28-16_6.png", TEAM_STATS_MENU, team(
        ["46%", "3 (2)", "2 (0)", "0", "0", "54 (46)", "0", "6", "4", "0"],
        ["54%", "1 (1)", "0 (0)", "0", "2", "58 (47)", "2", "3", "3", "1"])),
    ("PES2021 2026-10-21 16-16-48_5.png", TEAM_STATS_PANEL, team(
        ["53%", "4 (2)", "4 (0)", "0", "1", "40 (32)", "0", "4", "0", "1"],
        ["47%", "2 (1)", "1 (0)", "1", "3", "35 (30)", "3", "3", "0", "1"])),
    ("PES2021 2026-10-21 16-30-16_7.png", TEAM_STATS_PANEL, team(
        ["48%", "3 (2)", "3 (0)", "0", "0", "74 (58)", "0", "13", "4", "1"],
        ["52%", "2 (2)", "0 (0)", "0", "3", "78 (58)", "3", "7", "4", "1"])),
]


class HoldOutCaptures(unittest.TestCase):
    reader: GlyphReader

    @classmethod
    def setUpClass(cls) -> None:
        cls.reader = GlyphReader.load()

    def test_team_stats_read_exactly(self) -> None:
        for file, layout, expected in HOLD_OUT:
            path = CAPTURES / file
            if not path.exists():
                self.skipTest(f"capture not available: {path}")
            with self.subTest(capture=file):
                got = read_layout(Image.open(path), layout, self.reader)
                mismatches = {(side, label): (got[side][label], want)
                              for side, values in expected.items() for label, want in values.items()
                              if got[side][label] != want}
                self.assertEqual(mismatches, {})


if __name__ == "__main__":
    unittest.main()
