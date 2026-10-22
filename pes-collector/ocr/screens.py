"""Layouts of the PES 2021 stats screens at 1920x1080 and readers for their values.

Coordinates were measured on the user's captures of 2026-10-21 (Spanish UI, UML 2026 patch, Premier League
scoreboard skin). Another resolution, language or scoreboard mod needs its own layout.
"""
from __future__ import annotations

from dataclasses import dataclass

from PIL import Image

from glyphs import Cell, GlyphReader

SCREEN_SIZE = (1920, 1080)

PLAYER_STAT_LABELS = [
    "goals", "penalty_goals", "free_kick_goals", "assists", "shots", "passes", "crosses", "fouls",
    "free_kicks", "corners", "interceptions", "minutes", "touches", "dribble_distance_m", "avg_speed_kmh",
    "duels", "clearances",
]
GOALKEEPER_LABELS = ["shots_faced", "saves"]
TEAM_STAT_LABELS = [
    "possession", "shots", "fouls", "corners", "free_kicks", "passes", "crosses", "interceptions", "tackles", "saves",
]


@dataclass(frozen=True)
class Layout:
    name: str
    labels: list[str]
    columns: dict[str, tuple[int, int]]   # column name -> (left, right)
    row_tops: list[int]
    above: int
    below: int
    polarity: str
    threshold: int

    def cell(self, column: str, row: int) -> Cell:
        left, right = self.columns[column]
        top = self.row_tops[row]
        return Cell((left, top - self.above, right, top + self.below), self.polarity, self.threshold)


# "Estadisticas ind. del jugador" (post-match menu): one player at a time, light text on a translucent panel.
PLAYER_STATS = Layout("player_stats", PLAYER_STAT_LABELS, {"value": (1040, 1230)},
                      [208 + 42 * k for k in range(17)], 6, 34, "light", 170)
GOALKEEPER_STATS = Layout("goalkeeper_stats", GOALKEEPER_LABELS, {"value": (1640, 1780)},
                          [208, 250], 6, 34, "light", 170)
# "Estadisticas del equipo" in the pause / post-match menu: white text over the live pitch and crowd. 'white'
# (all channels >= 215, near grey) read 120/120 hold-out cells; plain luminance >= 215 read 113/120 (2026-10-21).
TEAM_STATS_MENU = Layout("team_stats_menu", TEAM_STAT_LABELS, {"home": (140, 320), "away": (880, 1050)},
                         [round(377 + 39.2 * k) for k in range(10)], 8, 30, "white", 215)
# Half-time / full-time "Match Stats" panel: dark text on white with red bars under each row.
TEAM_STATS_PANEL = Layout("team_stats_panel", TEAM_STAT_LABELS, {"home": (690, 830), "away": (1090, 1215)},
                          [round(412 + 42.1 * k) for k in range(10)], 8, 30, "dark", 75)


def read_layout(image: Image.Image, layout: Layout, reader: GlyphReader) -> dict[str, dict[str, str]]:
    if image.size != SCREEN_SIZE:
        raise ValueError(f"expected a {SCREEN_SIZE} capture, got {image.size}")
    return {
        column: {label: reader.read(image, layout.cell(column, row)) for row, label in enumerate(layout.labels)}
        for column in layout.columns
    }
