"""Reads short numeric strings ("7 (6)", "77.1 m", "48%") from PES 2021 stats screens by glyph templates.

The game renders these values in one fixed font at a fixed size per screen, so cutting a cell into glyphs and
comparing each glyph with labelled templates is more reliable than a general OCR: Windows OCR skips isolated
digits such as "0" even on a clean, binarised crop (tried 2026-10-21, docs/PES_MATCH_DATA_RESEARCH.md).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

NORM_W, NORM_H = 14, 20
MAX_DISTANCE = 0.22      # mismatch fraction above which a glyph is reported as unknown ("?")
UNIT_START = {"m", "k"}  # "m", "km/h"
UNIT_CHARS = {"k", "m", "/", "h"}
TEMPLATES_PATH = Path(__file__).with_name("glyph_templates.json")


@dataclass(frozen=True)
class Cell:
    """A screen region holding one value. polarity: 'light' = light text on a dark panel, 'dark' = the opposite,
    'white' = pure white text over a busy background (all channels >= threshold and nearly grey)."""
    box: tuple[int, int, int, int]  # left, top, right, bottom
    polarity: str = "light"
    threshold: int = 170


WHITE_MAX_CHROMA = 40   # max - min channel: the UI text is grey/white, the crowd and pitch behind it are coloured


def ink_mask(image: Image.Image, cell: Cell) -> np.ndarray:
    if cell.polarity == "white":
        rgb = np.asarray(image.convert("RGB").crop(cell.box), dtype=np.int16)
        chroma = rgb.max(axis=2) - rgb.min(axis=2)
        return (rgb.min(axis=2) >= cell.threshold) & (chroma <= WHITE_MAX_CHROMA)
    gray = np.asarray(image.convert("L").crop(cell.box), dtype=np.int16)
    return gray >= cell.threshold if cell.polarity == "light" else gray <= cell.threshold


def _bounds(flags: np.ndarray) -> list[tuple[int, int]]:
    runs, start = [], None
    for i, on in enumerate(flags):
        if on and start is None:
            start = i
        elif not on and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(flags)))
    return runs


MAX_STROKE_RUN = 16   # widest glyph stroke is ~14 px ("4"); longer horizontal runs are background (stadium) lines
MIN_GLYPH_AREA = 6    # specks of background (1-2 px) are dropped; "." is about 3x3
MAX_GLYPH_SIZE = (34, 26)  # height, width


def _remove_long_runs(mask: np.ndarray) -> np.ndarray:
    """Clears horizontal runs longer than any glyph stroke: stadium lines behind the translucent menu panel
    cross the digits and would merge them into one blob."""
    out = mask.copy()
    for y in range(mask.shape[0]):
        for left, right in _bounds(mask[y]):
            if right - left > MAX_STROKE_RUN:
                out[y, left:right] = False
    return out


def segment(mask: np.ndarray) -> list[tuple[int, int, np.ndarray]]:
    """Glyphs as (left, right, cropped mask), split on empty columns, each trimmed to its own ink rows."""
    mask = _remove_long_runs(mask)
    rows = _bounds(mask.any(axis=1))
    if not rows:
        return []
    # the text line is the tallest band of ink rows; stray pixels above/below (panel borders) are dropped
    top, bottom = max(rows, key=lambda r: r[1] - r[0])
    line = mask[top:bottom]
    glyphs = []
    for left, right in _bounds(line.any(axis=0)):
        part = line[:, left:right]
        r = _bounds(part.any(axis=1))
        glyph = part[r[0][0]:r[-1][1]]
        h, w = glyph.shape
        if glyph.sum() < MIN_GLYPH_AREA or h > MAX_GLYPH_SIZE[0] or w > MAX_GLYPH_SIZE[1]:
            continue
        glyphs.append((left, right, glyph))
    return _main_cluster(glyphs)


def _main_cluster(glyphs: list[tuple[int, int, np.ndarray]]) -> list[tuple[int, int, np.ndarray]]:
    """Keeps the value's own glyphs: the widest group of full-height glyphs with small gaps between them, plus
    dot-sized glyphs inside that group ("77.1"). Background specks beside the value are dropped."""
    if not glyphs:
        return []
    max_h = max(g[2].shape[0] for g in glyphs)
    tall = [g for g in glyphs if g[2].shape[0] >= 0.5 * max_h]   # 0.5 keeps "m" (14 px next to a 25 px "/")
    groups, current = [], [tall[0]]
    for prev, cur in zip(tall, tall[1:]):
        if cur[0] - prev[1] <= 1.2 * max_h:
            current.append(cur)
        else:
            groups.append(current)
            current = [cur]
    groups.append(current)
    group = max(groups, key=lambda g: (len(g), g[-1][1] - g[0][0]))
    start, end = group[0][0], group[-1][1]
    kept = {g[0] for g in group}
    return [g for g in glyphs
            if g[0] in kept or (start < g[0] and g[1] < end and g[2].shape[0] <= 0.25 * max_h)]


def normalize(glyph: np.ndarray) -> np.ndarray:
    img = Image.fromarray((glyph * 255).astype(np.uint8)).resize((NORM_W, NORM_H), Image.BILINEAR)
    return np.asarray(img) >= 128


def _features(glyph: np.ndarray, cell_height: int) -> tuple[np.ndarray, float, float]:
    # Height relative to the cell (fixed per screen), not to the row's tallest glyph: "(" is taller than a digit,
    # so a row-relative height would make the same "2" look different in "2" and in "2 (2)".
    h, w = glyph.shape
    return normalize(glyph), w / max(h, 1), h / max(cell_height, 1)


class GlyphReader:
    def __init__(self, templates: dict[str, list[dict]] | None = None):
        self.templates = templates if templates is not None else {}

    @classmethod
    def load(cls, path: Path = TEMPLATES_PATH) -> "GlyphReader":
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        return cls(data)

    def save(self, path: Path = TEMPLATES_PATH) -> None:
        path.write_text(json.dumps(self.templates, indent=0, sort_keys=True), encoding="utf-8")

    def learn(self, mask: np.ndarray, text: str) -> None:
        """Adds the glyphs of a cell whose content is known. Spaces in `text` are ignored (they are gaps)."""
        chars = [c for c in text if c != " "]
        glyphs = segment(mask)
        if len(glyphs) != len(chars):
            raise ValueError(f"{len(glyphs)} glyphs for {text!r}")
        for char, (_, _, glyph) in zip(chars, glyphs):
            bitmap, aspect, rel_h = _features(glyph, mask.shape[0])
            entry = {"bits": "".join("1" if b else "0" for b in bitmap.ravel()), "aspect": aspect, "height": rel_h}
            known = self.templates.setdefault(char, [])
            if entry["bits"] not in {k["bits"] for k in known}:
                known.append(entry)

    def _classify(self, glyph: np.ndarray, cell_height: int) -> tuple[str, float]:
        bitmap, aspect, rel_h = _features(glyph, cell_height)
        best, best_score = "?", 1.0
        for char, entries in self.templates.items():
            for t in entries:
                bits = np.frombuffer(t["bits"].encode(), dtype=np.uint8).reshape(NORM_H, NORM_W) == ord("1")
                score = np.mean(bits != bitmap) + 0.5 * abs(aspect - t["aspect"]) + 0.5 * abs(rel_h - t["height"])
                if score < best_score:
                    best, best_score = char, score
        return (best, best_score) if best_score <= MAX_DISTANCE else ("?", best_score)

    def read_mask(self, mask: np.ndarray) -> str:
        chars = [self._classify(glyph, mask.shape[0])[0] for _, _, glyph in segment(mask)]
        # Values on these screens only have a space before "(" ("7 (6)") and before a unit ("77.1 m", "13.7 km/h").
        # Placing it by rule beats measuring gaps: a narrow "1" leaves a gap as wide as a real space ("1 3").
        out = []
        for i, char in enumerate(chars):
            if i > 0 and (char == "(" or (char in UNIT_START and chars[i - 1] not in UNIT_CHARS)):
                out.append(" ")
            out.append(char)
        return "".join(out)

    def read(self, image: Image.Image, cell: Cell) -> str:
        return self.read_mask(ink_mask(image, cell))
