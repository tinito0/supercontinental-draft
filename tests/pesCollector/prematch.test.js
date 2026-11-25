// `prematch` events of probe v7 (collector/prematch.js) and the overlay command built from them
// (bridge/lineupCommand.js). Synthetic events with the Arsenal plan bytes of the real save: nothing here was recorded
// in a match.
import { prematchLineups } from '../../pes-collector/collector/prematch.js';
import { buildLineupCommand, lineupKey } from '../../pes-collector/bridge/lineupCommand.js';

const ARSENAL_PLAN = [
  '000101030204050a09080c03340b400b280d580d10153a1e28235b241120432a38',
  '000101070204080a09080c03340c47092a10570e1415352128276029141f472a42',
  '0001010302040507060b0c03340b400b280d580d1018401f292258221025422b2c',
].join('') + '00'.repeat(0xA0 - 3 * 0x21);
const ORDER = [0, 2, 3, 8, 6, 10, 12, 18, 17, 14, 21, ...Array.from({ length: 29 }, (_, i) => i + 11)];
const SQUAD = Array.from({ length: 30 }, (_, i) => 1000 + i);
const XI = ORDER.slice(0, 11).map(i => 1000 + i);

const session = { t: 'session', ts: '2026-11-15T22:48:20.123Z', home_team: 101, away_team: 202, tournament_id: 7 };
const pre = (side, extra = {}) => ({ t: 'prematch', side, plan: ARSENAL_PLAN, order: ORDER, squad: SQUAD, ...extra });

describe('prematchLineups', () => {
  it('reads both XIs of the newest session before kick-off', () => {
    const result = prematchLineups([session, pre(0), pre(1)]);
    expect(result.session).toEqual({ ts: session.ts, homeTeamId: 101, awayTeamId: 202, tournamentId: 7, loadingTs: null });
    expect(result.home.ids).toEqual(XI);
    expect(result.home.roles).toEqual([0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12]);
    expect(result.away.pos[0]).toEqual([3, 52]);
  });

  it('with probe v8, waits for the loading screen after «Iniciar partido»', () => {
    const v8 = { ...session, probe_version: 8 };
    const loading = { t: 'loading', ts: '2026-11-15T22:50:31Z', file: 'common/bg/model/bg/st001/x.fmdl' };
    expect(prematchLineups([v8, pre(0), pre(1)])).toBeNull();
    expect(prematchLineups([v8, pre(0), pre(1), loading]).session.loadingTs).toBe(loading.ts);
    expect(prematchLineups([v8, pre(0), loading, pre(1)]).home.ids).toEqual(XI);
  });

  it('uses the newest event of each side', () => {
    const swapped = [...ORDER];
    [swapped[1], swapped[11]] = [swapped[11], swapped[1]];
    expect(prematchLineups([session, pre(0), pre(1), pre(0, { order: swapped })]).home.ids[1]).toBe(1011);
  });

  it('is null once the match kicked off, without a side, or with a broken event', () => {
    expect(prematchLineups([session, pre(0), pre(1), { t: 'stats_appeared' }])).toBeNull();
    expect(prematchLineups([session, pre(0)])).toBeNull();
    expect(prematchLineups([pre(0), pre(1), session])).toBeNull();
    expect(prematchLineups([session, pre(0), pre(1, { plan: 'zz' })])).toBeNull();
    expect(prematchLineups([session, pre(0), pre(1, { squad: SQUAD.slice(0, 5) })])).toBeNull();
    expect(prematchLineups([])).toBeNull();
  });
});

describe('buildLineupCommand', () => {
  const prematch = prematchLineups([session, pre(0), pre(1)]);

  it('keys the match by its start and both teams', () => {
    expect(lineupKey(prematch.session)).toBe('20261115T224820Z_101-202');
  });

  it('names teams and players and adds the save shirt numbers', () => {
    const command = buildLineupCommand(prematch, {
      teamMap: new Map([[101, { draftTeamId: 'uidA', name: 'Club A' }], [202, { draftTeamId: 'uidB', name: '' }]]),
      names: { teams: new Map([[202, 'Equipo del juego']]), players: new Map([[XI[0], 'Arquero']]) },
      numbersOf: teamId => (teamId === 101 ? { [XI[0]]: 1 } : null),
    });
    expect(command.action).toBe('lineup');
    expect(command.teams.map(t => [t.name, t.draftTeamId])).toEqual([['Club A', 'uidA'], ['Equipo del juego', 'uidB']]);
    expect(command.teams[0].players[0]).toEqual({ id: XI[0], name: 'Arquero', number: 1, role: 0, depth: 3, lateral: 52 });
    expect(command.teams[1].players[0].number).toBeNull();
    expect(command.teams[0].players[1].name).toBeNull();
  });

  it('skips matches with a team outside the league', () => {
    expect(buildLineupCommand(prematch, { teamMap: new Map([[101, { draftTeamId: 'a', name: 'A' }]]) })).toBeNull();
    expect(buildLineupCommand(null)).toBeNull();
    expect(buildLineupCommand(prematch).teams[0].name).toBe('Equipo 101');
  });
});
