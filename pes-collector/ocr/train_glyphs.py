"""Builds glyph_templates.json from captures whose values were read by hand (the training set below).

    py train_glyphs.py <captures dir>

Captures not listed here are the hold-out set used by the tests; keep them out of training.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from glyphs import GlyphReader, ink_mask
from screens import GOALKEEPER_STATS, PLAYER_STATS, TEAM_STATS_MENU, TEAM_STATS_PANEL

TEAM_FINAL = {"possession": ("48%", "52%"), "shots": ("3 (2)", "2 (2)"), "fouls": ("3 (0)", "0 (0)"),
              "corners": ("0", "0"), "free_kicks": ("0", "3"), "passes": ("74 (58)", "78 (58)"),
              "crosses": ("0", "3"), "interceptions": ("13", "7"), "tackles": ("4", "4"), "saves": ("1", "1")}

TRAINING = [
    # Gyokeres, Arsenal 1-1 Liverpool (2-4 pens)
    ("PES2021 2026-10-21 16-42-38_10.png", PLAYER_STATS, {"value": [
        "1", "0", "0", "0", "2 (2)", "7 (6)", "0", "0 (0)", "0", "0", "0", "94", "17", "77.1 m", "13.7 km/h",
        "1 (1)", "0"]}),
    # Saka, same match
    ("PES2021 2026-10-21 16-42-33_9.png", PLAYER_STATS, {"value": [
        "0", "0", "0", "1", "0 (0)", "4 (4)", "0", "0 (0)", "0", "0", "0", "94", "4", "0.0 m", "15.7 km/h",
        "0 (0)", "0"]}),
    # Outfield players show "-" in the goalkeeper box
    ("PES2021 2026-10-21 16-42-38_10.png", GOALKEEPER_STATS, {"value": ["-", "-"]}),
    ("PES2021 2026-10-21 16-42-33_9.png", GOALKEEPER_STATS, {"value": ["-", "-"]}),
    ("PES2021 2026-10-21 16-42-57_14.png", TEAM_STATS_MENU,
     {side: [TEAM_FINAL[label][i] for label in TEAM_STATS_MENU.labels] for i, side in enumerate(("home", "away"))}),
    ("PES2021 2026-10-21 16-32-10_8.png", TEAM_STATS_PANEL,
     {side: [TEAM_FINAL[label][i] for label in TEAM_STATS_PANEL.labels] for i, side in enumerate(("home", "away"))}),
]


def main(captures: Path) -> None:
    reader = GlyphReader()
    for file, layout, columns in TRAINING:
        image = Image.open(captures / file)
        for column, values in columns.items():
            for row, text in enumerate(values):
                reader.learn(ink_mask(image, layout.cell(column, row)), text)
    reader.save()
    print({char: len(entries) for char, entries in sorted(reader.templates.items())})


if __name__ == "__main__":
    main(Path(sys.argv[1]))
