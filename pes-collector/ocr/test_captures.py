"""Pure-function tests (no captures needed): value parsing and screen classification."""
from __future__ import annotations

import unittest

from captures import classify, parse_value


class ParseValue(unittest.TestCase):
    def test_plain_count(self) -> None:
        self.assertEqual(parse_value("17"), {"value": 17})

    def test_count_with_secondary(self) -> None:
        self.assertEqual(parse_value("74 (58)"), {"value": 74, "secondary": 58})

    def test_percentage(self) -> None:
        self.assertEqual(parse_value("48%"), {"value": 48, "unit": "%"})

    def test_decimal_with_unit(self) -> None:
        self.assertEqual(parse_value("77.1 m"), {"value": 77.1, "unit": "m"})
        self.assertEqual(parse_value("0.0 m"), {"value": 0.0, "unit": "m"})
        self.assertEqual(parse_value("13.7 km/h"), {"value": 13.7, "unit": "km/h"})

    def test_unreadable_or_not_applicable_is_none(self) -> None:
        for text in ("-", "?", "4??)", ""):
            self.assertIsNone(parse_value(text), text)


class Classify(unittest.TestCase):
    def lines(self, *texts: str) -> list[dict]:
        return [{"text": t, "x": 0, "y": 0, "w": 0} for t in texts]

    def test_player_stats(self) -> None:
        self.assertEqual(classify(self.lines("Estadísticas ind. del jugador", "Valoración de jugadores")), "player_stats")

    def test_team_stats_menu_and_panel(self) -> None:
        self.assertEqual(classify(self.lines("Menú de pausa", "Estadísticas del equipo")), "team_stats_menu")
        self.assertEqual(classify(self.lines("Descanso", "Premier League", "Match Stats")), "team_stats_panel")

    def test_other_screens(self) -> None:
        self.assertIsNone(classify(self.lines("Zonas de ataque")))
        self.assertIsNone(classify(self.lines()))


if __name__ == "__main__":
    unittest.main()
