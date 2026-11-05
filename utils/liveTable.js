// Tabla en vivo: la tabla oficial (tournament.league) más los partidos de liga que se están jugando, como si
// terminaran con el marcador de ahora. Un empate suma el partido y los goles pero no puntos: los define la tanda
// de penales, que todavía no se jugó. Ordena con los desempates del reglamento (competitionRules.rankStandings).
// Puro; tests/liveTable.test.js.
import { LEAGUE_POINTS, rankStandings, teamKey } from './competitionRules.js';

const n = value => Number(value) || 0;

function applyLive(row, scored, conceded) {
  const won = scored > conceded;
  const lost = scored < conceded;
  return {
    ...row,
    pj: n(row.pj) + 1,
    gf: n(row.gf) + scored,
    gc: n(row.gc) + conceded,
    pg: n(row.pg) + (won ? 1 : 0),
    pp: n(row.pp) + (lost ? 1 : 0),
    pts: n(row.pts) + (won ? LEAGUE_POINTS.REGULATION_WIN : LEAGUE_POINTS.LOSS),
    isLive: true,
    pendingShootout: !won && !lost,
  };
}

/**
 * @param {object[]} league filas oficiales en su orden ({ name, pj, pg, gpen, pp, pts, gf, gc })
 * @param {object[]} fixtures buildFixtures (utils/leagueFixtures.js)
 * @returns {object[]|null} filas proyectadas con `isLive` y `move` (puestos ganados, negativo si baja); null sin
 *   partidos de liga en vivo
 */
export function projectLiveTable(league, fixtures) {
  const live = (fixtures || []).filter(f => f.competition === 'liga' && f.status === 'live' && f.liveScore);
  const rows = (league || []).filter(r => r?.name);
  if (!live.length || !rows.length) return null;
  const byKey = new Map(rows.map(r => [teamKey(r.name), { ...r, isLive: false, pendingShootout: false }]));
  for (const fixture of live) {
    const home = byKey.get(teamKey(fixture.home.name));
    const away = byKey.get(teamKey(fixture.away.name));
    if (!home || !away) continue;
    byKey.set(teamKey(home.name), applyLive(home, fixture.liveScore.home, fixture.liveScore.away));
    byKey.set(teamKey(away.name), applyLive(away, fixture.liveScore.away, fixture.liveScore.home));
  }
  const projected = [...byKey.values()];
  const { ranking } = rankStandings(projected.map(r => ({
    name: r.name, points: n(r.pts), goalsFor: n(r.gf), goalsAgainst: n(r.gc), regulationWins: n(r.pg), shootoutWins: n(r.gpen),
  })));
  const officialIndex = new Map(rows.map((r, i) => [teamKey(r.name), i]));
  return ranking.map((ranked, index) => {
    const row = byKey.get(teamKey(ranked.name));
    return { ...row, move: officialIndex.get(teamKey(row.name)) - index };
  });
}
