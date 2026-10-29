// Datos en vivo de las escenas Previa, Entretiempo y Final del overlay de OBS: utils/overlayLive.js.
import { buildOverlayLive, communityCardStatus } from '../utils/overlayLive.js';
import { parseMatchDoc } from '../utils/matchCenter.js';

const summary = {
  schema: 'scl.match/1',
  status: 'finished',
  match: { homeTeamId: 101, awayTeamId: 1230, tournamentId: 17 },
  score: { home: 2, away: 1 },
  clock: { period: 3, minute: 90, second: 0 },
  goals: [
    { side: 'home', playerId: 7, clock: { period: 1, minute: 11, second: 3 } },
    { side: 'away', playerId: 9, clock: { period: 2, minute: 60, second: 0 }, penalty: true },
    { side: 'home', playerId: 30, clock: { period: 2, minute: 88, second: 0 }, ownGoal: true },
  ],
  lineups: { home: { starting: [7] }, away: { starting: [9, 30] } },
  names: { teams: { home: 'Arsenal', away: 'Gençlerbirliği' }, players: { 7: 'Saka', 9: 'Nine', 30: 'Thirty' } },
};
const match = parseMatchDoc({ matchKey: '20261022T200000Z_101-1230', status: 'finished', summaryJson: JSON.stringify(summary) });

describe('buildOverlayLive', () => {
  it('returns nothing to show without a live match or votes', () => {
    expect(buildOverlayLive({})).toEqual({ score: null, scorers: { home: [], away: [] }, prediction: null, mvp: null, mvpTop: [], cup: null });
  });

  it('takes the score and the scorers from the match the bridge uploaded', () => {
    const live = buildOverlayLive({ match });
    expect(live.score).toEqual({ home: 2, away: 1 });
    expect(live.scorers.home).toEqual([
      { key: 'goal-0', name: 'Saka', minute: "12'", tag: '' },
      { key: 'goal-2', name: 'Thirty', minute: "89'", tag: 'e.c.' },
    ]);
    expect(live.scorers.away).toEqual([{ key: 'goal-1', name: 'Nine', minute: "61'", tag: 'p.' }]);
  });

  it('shows the prediction only once somebody voted', () => {
    expect(buildOverlayLive({ prediction: { votes: {}, total: 0 } }).prediction).toBeNull();
    expect(buildOverlayLive({ prediction: { votes: { home: 3, away: 1 } } }).prediction).toEqual({ home: 75, draw: 0, away: 25, total: 4, leader: 'home' });
  });

  it('names the community MVP leader with the match player names', () => {
    expect(buildOverlayLive({ match, mvpVotes: { votes: { 7: 5, 9: 3 } } }).mvp).toEqual({ id: 7, name: 'Saka', votes: 5, pct: 63 });
    expect(buildOverlayLive({ match, mvpVotes: { votes: { 7: 5, 9: 3 } } }).mvpTop.map(entry => entry.name)).toEqual(['Saka', 'Nine']);
    expect(buildOverlayLive({ match, mvpVotes: { votes: {} } }).mvp).toBeNull();
  });

  it('features the open cup poll (Oro before Plata) with its top four options', () => {
    const options = ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({ id, name: id.toUpperCase(), index }));
    const oro = { title: '¿Quién gana la Copa de Oro?', open: true, options, votes: { e: 5, a: 1 } };
    const plata = { title: 'Plata', open: true, options, votes: { b: 1 } };
    const cup = buildOverlayLive({ polls: [plata, oro] }).cup;
    expect(cup.title).toBe('Plata');
    expect(buildOverlayLive({ polls: [{ ...plata, open: false }, oro] }).cup).toMatchObject({ title: oro.title, total: 6 });
    expect(buildOverlayLive({ polls: [{ ...plata, open: false }, oro] }).cup.options.map(o => o.id)).toEqual(['e', 'a', 'b', 'c']);
    expect(buildOverlayLive({ polls: [null, { ...oro, options: [] }] }).cup).toBeNull();
  });
});

describe('communityCardStatus (botones de la capa de la comunidad)', () => {
  it('says why each card will not show without votes', () => {
    const empty = buildOverlayLive({});
    expect(communityCardStatus(empty, {})).toEqual({
      mvp: { ready: false, note: 'No hay partido del juego en vivo' },
      prediction: { ready: false, note: 'No hay partido al aire' },
      cup: { ready: false, note: 'No hay encuesta de copa cargada' },
    });
    expect(communityCardStatus(empty, { matchId: 'league-1', liveMatchKey: 'k' }).prediction.note).toBe('Todavía nadie votó la predicción');
    expect(communityCardStatus(empty, { matchId: 'league-1', liveMatchKey: 'k' }).mvp.note).toBe('Todavía nadie votó al MVP');
  });

  it('marks a card ready as soon as it has a vote', () => {
    const live = buildOverlayLive({
      prediction: { votes: { home: 1 } },
      polls: [{ title: 'Copa', open: true, options: [{ id: 'a', name: 'A' }], votes: { a: 2 } }],
    });
    const status = communityCardStatus(live, { matchId: 'league-1' });
    expect(status.prediction).toEqual({ ready: true, note: '1 voto' });
    expect(status.cup).toEqual({ ready: true, note: '2 votos · abierta' });
  });
});
