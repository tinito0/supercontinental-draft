// Tabla en vivo (utils/liveTable.js): la tabla oficial más los partidos de liga que se están jugando. Sintético.
import { describe, it, expect } from 'vitest';
import { projectLiveTable } from '../utils/liveTable.js';

const row = (name, pts, gf = 0, gc = 0, extra = {}) => ({ name, pj: 1, pg: pts / 2, gpen: 0, pp: pts ? 0 : 1, pts, gf, gc, ...extra });
const league = [row('Norte', 2, 3, 1), row('Sur', 2, 2, 1), row('Este', 0, 1, 2), row('Oeste', 0, 0, 2)];
const live = (home, away, liveScore, extra = {}) => ({ competition: 'liga', status: 'live', home: { name: home }, away: { name: away }, liveScore, ...extra });

describe('projectLiveTable', () => {
  it('returns null when no league match is live, so the official table shows as is', () => {
    expect(projectLiveTable(league, [])).toBeNull();
    expect(projectLiveTable(league, [live('Este', 'Oeste', { home: 1, away: 0 }, { competition: 'oro' })])).toBeNull();
    expect(projectLiveTable(league, [live('Este', 'Oeste', { home: 1, away: 0 }, { status: 'finished' })])).toBeNull();
  });

  it('adds the current score: the winner takes the regulation points and climbs, both are marked live', () => {
    const table = projectLiveTable(league, [live('Oeste', 'Norte', { home: 3, away: 0 })]);
    expect(table.map(r => r.name)).toEqual(['Oeste', 'Sur', 'Norte', 'Este']);
    expect(table[0]).toMatchObject({ pts: 2, pj: 2, gf: 3, gc: 2, pg: 1, isLive: true, move: 3 });
    expect(table[2]).toMatchObject({ name: 'Norte', pts: 2, pj: 2, pp: 1, isLive: true, move: -2 });
    expect(table[1]).toMatchObject({ name: 'Sur', isLive: false, move: 0 });
  });

  it('a live draw adds the match and goals but no points: the shootout decides them', () => {
    const table = projectLiveTable(league, [live('Este', 'Oeste', { home: 1, away: 1 })]);
    expect(table.find(r => r.name === 'Este')).toMatchObject({ pj: 2, pts: 0, gf: 2, gc: 3, isLive: true, pendingShootout: true });
  });

  it('does not change the official rows it was given', () => {
    const copy = JSON.parse(JSON.stringify(league));
    projectLiveTable(league, [live('Oeste', 'Norte', { home: 3, away: 0 })]);
    expect(league).toEqual(copy);
  });
});
