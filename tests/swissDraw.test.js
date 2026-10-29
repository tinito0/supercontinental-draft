// Sorteo de la Fecha 1 (components/tournament/tournamentEngine.js drawFirstRound), con datos sintéticos.
import { describe, it, expect } from 'vitest';
import { drawFirstRound, finalizeTournament } from '../components/tournament/tournamentEngine.js';
import { teamKey } from '../utils/competitionRules.js';

const names = n => Array.from({ length: n }, (_, i) => `Club ${String(i + 1).padStart(2, '0')}`);
const league = n => names(n).map(name => ({ id: name, name, pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 }));

/** Generador repetible para los tests (no el del sorteo real). */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe('drawFirstRound', () => {
  it('pairs every club exactly once with fixed ids for Fecha 1', () => {
    const draw = drawFirstRound({ league: league(12), matches: [] }, seeded(7));
    expect(draw.ok).toBe(true);
    expect(draw.matches).toHaveLength(6);
    const seen = draw.pairs.flat().map(teamKey);
    expect(new Set(seen).size).toBe(12);
    expect(draw.matches.map(match => match.id)).toEqual(['swiss-r1-1', 'swiss-r1-2', 'swiss-r1-3', 'swiss-r1-4', 'swiss-r1-5', 'swiss-r1-6']);
    expect(draw.matches.every(match => match.round === 'Fecha 1' && match.status === 'scheduled')).toBe(true);
  });

  it('gives different pairings for different random draws', () => {
    const a = drawFirstRound({ league: league(12), matches: [] }, seeded(1)).pairs;
    const b = drawFirstRound({ league: league(12), matches: [] }, seeded(99)).pairs;
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('works with the real crypto random source', () => {
    expect(drawFirstRound({ league: league(12), matches: [] }).ok).toBe(true);
  });

  it('refuses when Fecha 1 already has matches, an odd count or an empty table', () => {
    const played = { league: league(12), matches: [{ id: 'x', round: 'Fecha 1', homeTeam: 'Club 01', awayTeam: 'Club 02' }] };
    expect(drawFirstRound(played).ok).toBe(false);
    expect(drawFirstRound({ league: league(11), matches: [] }).reason).toMatch(/número par/);
    expect(drawFirstRound({ league: [], matches: [] }).ok).toBe(false);
  });

  it('lets the automatic swiss take over after the drawn round is played', () => {
    const draw = drawFirstRound({ league: league(12), matches: [] }, seeded(3));
    const played = draw.matches.map(match => ({ ...match, homeScore: 2, awayScore: 0, status: 'completed' }));
    const result = finalizeTournament({ league: league(12), matches: played, bracket: {} });
    expect(result.ok).toBe(true);
    expect(result.generatedRound).toBe('Fecha 2');
  });
});
