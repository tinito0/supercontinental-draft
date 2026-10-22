"""Reads PES 2021 stats screen captures (1920x1080) into structured JSON.

    py captures.py <capture.png> [<capture.png> ...]      one JSON object per capture on stdout

Screen type, team and player names come from Windows OCR (ocr.ps1), which reads text well; numbers come from
the glyph templates (glyphs.py), which read the game's digits where Windows OCR skips them.
Every value is raw text as shown on screen; parse_value() turns it into numbers.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from glyphs import GlyphReader
from screens import GOALKEEPER_STATS, PLAYER_STATS, TEAM_STATS_MENU, TEAM_STATS_PANEL, read_layout

OCR_SCRIPT = Path(__file__).resolve().parent.parent / "tools" / "ocr.ps1"

ROSTER_TOP, ROSTER_STEP, ROSTER_ROWS = 186, 42, 15
ROSTER_NAME_X = (215, 470)
ROSTER_RATING_X = (550, 620)
SELECTED_MIN_BLUE_PIXELS = 100   # the selected player's row is drawn in blue (482 px vs 0 on other rows)


def windows_ocr(path: Path) -> list[dict]:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(OCR_SCRIPT), str(path)],
        capture_output=True, text=True, encoding="utf-8", check=True)
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip().startswith("{")]


def classify(lines: list[dict]) -> str | None:
    texts = " | ".join(line["text"].lower() for line in lines)
    if "ind. del jugador" in texts and "valoraci" in texts:
        return "player_stats"
    if "estadísticas del equipo" in texts or "estadisticas del equipo" in texts:
        return "team_stats_menu"
    if "match stats" in texts:
        return "team_stats_panel"
    return None


def _line_at(lines: list[dict], x: tuple[int, int], y: tuple[int, int]) -> str | None:
    hits = [line for line in lines if x[0] <= line["x"] <= x[1] and y[0] <= line["y"] <= y[1]]
    return min(hits, key=lambda line: line["x"])["text"] if hits else None


def selected_row(image: Image.Image) -> int | None:
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    best, best_count = None, 0
    for row in range(ROSTER_ROWS):
        top = ROSTER_TOP + row * ROSTER_STEP
        region = rgb[top:top + 26, ROSTER_NAME_X[0]:ROSTER_NAME_X[1]]
        blue = int(((region[:, :, 2] > 180) & (region[:, :, 0] < 120) & (region[:, :, 1] < 170)).sum())
        if blue > best_count:
            best, best_count = row, blue
    return best if best_count >= SELECTED_MIN_BLUE_PIXELS else None


def roster(lines: list[dict]) -> list[dict]:
    """Players listed under "Valoracion de jugadores" (those who played, subs included) with their rating."""
    rows = []
    for row in range(ROSTER_ROWS):
        top = ROSTER_TOP + row * ROSTER_STEP
        name = _line_at(lines, ROSTER_NAME_X, (top - 8, top + 12))
        if name is None:
            continue
        rating = _line_at(lines, ROSTER_RATING_X, (top - 8, top + 12))
        rows.append({"row": row, "name": name.rstrip(" _"), "rating": rating})
    return rows


def read_capture(path: Path, reader: GlyphReader) -> dict:
    image = Image.open(path)
    lines = windows_ocr(path)
    screen = classify(lines)
    out: dict = {"file": path.name, "screen": screen}
    if screen == "player_stats":
        players = roster(lines)
        row = selected_row(image)
        out["team"] = _line_at(lines, (100, 450), (50, 110))
        out["roster"] = players
        out["selected"] = next((p for p in players if p["row"] == row), None)
        out["stats"] = read_layout(image, PLAYER_STATS, reader)["value"]
        out["goalkeeper"] = read_layout(image, GOALKEEPER_STATS, reader)["value"]
    elif screen in ("team_stats_menu", "team_stats_panel"):
        layout = TEAM_STATS_MENU if screen == "team_stats_menu" else TEAM_STATS_PANEL
        out["clock"] = next((line["text"] for line in lines if re.fullmatch(r"\d{1,3}:\d{2}", line["text"])), None)
        out["header"] = _line_at(lines, (700, 1250), (180, 230))
        out["stats"] = read_layout(image, layout, reader)
    return out


VALUE_RE = re.compile(r"^(?P<a>\d+(?:\.\d+)?)\s*(?:\((?P<b>\d+)\))?\s*(?P<unit>%|m|km/h)?$")


def parse_value(text: str) -> dict | None:
    """"7 (6)" -> {"value": 7, "secondary": 6}; "48%" -> {"value": 48, "unit": "%"}; "-" or unreadable -> None."""
    match = VALUE_RE.match(text.strip())
    if not match:
        return None
    number = float(match["a"])
    parsed = {"value": int(number) if number.is_integer() and "." not in match["a"] else number}
    if match["b"] is not None:
        parsed["secondary"] = int(match["b"])
    if match["unit"]:
        parsed["unit"] = match["unit"]
    return parsed


def main(paths: list[str]) -> None:
    sys.stdout.reconfigure(encoding="utf-8")   # player names have accents; the Windows console default is cp1252
    reader = GlyphReader.load()
    for path in paths:
        print(json.dumps(read_capture(Path(path), reader), ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
