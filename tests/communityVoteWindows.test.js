// Ventanas y boletas de los votos sin cuenta (supabase/functions/_shared/communityVote.js): finishedAt, partidos ya
// jugados, cierre por clubes, manager de la fecha y «ya votaste» con la opción contada. Datos sintéticos.
import {
  castVote, clientIp, CommunityVoteError, finishedAtFor, fixtureIsFinished, MANAGER_WINDOW_MS,
  fixtureIsPredictable, predictionClosure, predictionWindow,
} from '../supabase/functions/_shared/communityVote.js';
import { managerRanking, pickManagerRound, predictionOutcome } from '../utils/communityView.js';

const now = 50_000_000;

describe('finishedAtFor (match-feed)', () => {
  it('stamps the first finished upload and keeps that time afterwards', () => {
    expect(finishedAtFor(null, 'finished')).toEqual({ keep: null, stamp: true });
    const first = new Date(now);
    expect(finishedAtFor({ finishedAt: first }, 'finished')).toEqual({ keep: first, stamp: false });
  });

  it('does nothing while the match is live', () => {
    expect(finishedAtFor({}, 'live')).toEqual({ keep: null, stamp: false });
  });
});

describe('predictions for matches already played', () => {
  const tournament = {
    matches: [{ id: '7', status: 'completed', homeScore: 2, awayScore: 0 }, { id: '8', homeTeam: 'A', awayTeam: 'B', status: 'scheduled', homeScore: '', awayScore: '' }],
    bracket: { quarters: [{ scoreA: 1, scoreB: 1 }, { scoreA: '', scoreB: '' }], repechaje: { r1: [{ scoreA: 0, scoreB: 3 }] } },
  };

  it('knows which fixtures have a result', () => {
    expect(fixtureIsFinished(tournament, 'league-7')).toBe(true);
    expect(fixtureIsFinished(tournament, 'league-8')).toBe(false);
    expect(fixtureIsFinished(tournament, 'oro-quarters-0')).toBe(true);
    expect(fixtureIsFinished(tournament, 'oro-quarters-1')).toBe(false);
    expect(fixtureIsFinished(tournament, 'plata-r1-0')).toBe(true);
    expect(fixtureIsFinished(tournament, 'unknown')).toBe(false);
  });

  it('does not open the prediction when a played match is put on air', () => {
    const overlay = { matchId: 'league-7', homeTeamName: 'A', awayTeamName: 'B' };
    expect(predictionWindow({ overlay, prediction: null, matchId: 'league-7', tournament }).open).toBe(false);
    expect(predictionWindow({ overlay: { ...overlay, matchId: 'league-8' }, prediction: null, matchId: 'league-8', tournament }).open).toBe(true);
  });
});

describe('predictionClosure pairs the clubs', () => {
  const overlay = { matchId: 'league-8', homeTeamId: 'u1', awayTeamId: 'u2' };
  it('closes when the live match is between the clubs on air, in any order', () => {
    expect(predictionClosure({ liveStatus: 'live', matchKey: 'k', overlay, prediction: null, liveDoc: { homeDraftTeamId: 'u2', awayDraftTeamId: 'u1' } })).not.toBeNull();
  });

  it('leaves the on-air prediction open when another match is still uploading', () => {
    expect(predictionClosure({ liveStatus: 'live', matchKey: 'k', overlay, prediction: null, liveDoc: { homeDraftTeamId: 'u3', awayDraftTeamId: 'u1' } })).toBeNull();
  });
});

describe('clientIp', () => {
  it('prefers the Cloudflare header over the forwarded chain', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.1.1.1');
    expect(clientIp(new Headers({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '9.9.9.9' }))).toBe('2.2.2.2');
  });
});

describe('castVote: already voted', () => {
  it('answers with a code and the choice that was counted', async () => {
    let calls = 0;
    const firestore = {
      runTransaction: async fn => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('exists'), { code: 'ALREADY_EXISTS' });
        return fn({ get: async () => ({ data: { choice: 'away' } }) });
      },
    };
    const vote = { kind: 'prediction', target: 'league-8', choice: 'home' };
    const error = await castVote({ firestore, appId: 'x', vote, ipHash: 'i', deviceHash: 'd', now }).catch(e => e);
    expect(error).toBeInstanceOf(CommunityVoteError);
    expect(error.code).toBe('ALREADY_VOTED');
    expect(error.choice).toBe('away');
  });
});

describe('castVote: manager de la fecha', () => {
  const base = 'artifacts/x/public/data';
  const tournament = {
    matches: [
      { id: '1', round: 'Fecha 3', homeTeam: 'Talleres', awayTeam: 'SK Konya', status: 'completed', importedFrom: 'k1' },
      { id: '2', round: 'Fecha 3', homeTeam: 'Lourinhã', awayTeam: 'Portland Rovers', status: 'completed', importedFrom: 'k2' },
    ],
  };
  const run = async (docs, choice = 'Talleres') => {
    const writes = [];
    const firestore = { runTransaction: async fn => fn({ get: async path => (docs[path] ? { data: docs[path] } : null), create() {}, set: (path, data, opts) => writes.push({ path, data, opts }) }) };
    const result = await castVote({ firestore, appId: 'x', vote: { kind: 'manager', target: 'fecha-3', choice }, ipHash: 'i', deviceHash: 'd', now }).catch(e => e);
    return { result, writes };
  };
  const ended = ms => ({
    [`${base}/tournament/official`]: tournament,
    [`${base}/live_matches/k1`]: { finishedAt: new Date(now - ms - 3_600_000) },
    [`${base}/live_matches/k2`]: { finishedAt: new Date(now - ms) },
  });

  it('counts a vote for a club of the round and stamps when the vote opened', async () => {
    const { result, writes } = await run(ended(60_000));
    expect(result).toEqual({ votes: { Talleres: 1 }, total: 1 });
    const totals = writes.find(w => w.path === `${base}/manager_votes/fecha-3`);
    expect(totals.opts.serverTimestamps).toEqual(['updatedAt', 'openedAt']);
  });

  it('rejects a club that did not play the round, a closed window and an admin close', async () => {
    expect((await run(ended(60_000), 'Aspra Calcio')).result.message).toMatch(/no jugó/);
    expect((await run(ended(MANAGER_WINDOW_MS + 1))).result.message).toMatch(/ya cerró/);
    const closed = { ...ended(60_000), [`${base}/manager_votes/fecha-3`]: { votes: {}, total: 0, closedAt: new Date(now) } };
    expect((await run(closed)).result.message).toMatch(/cerrada/);
  });
});

describe('pickManagerRound (/en-vivo, portada, OBS)', () => {
  const m = (id, round, status, extra = {}) => ({ id, round, homeTeam: `H${id}`, awayTeam: `A${id}`, status, ...extra });
  const tournament = { matches: [m('1', 'Fecha 1', 'completed'), m('2', 'Fecha 2', 'completed', { importedFrom: 'k2' }), m('3', 'Fecha 3', 'scheduled')] };

  it('picks the latest round with every result, with the window from the game end time', () => {
    const round = pickManagerRound(tournament, [{ key: 'k2', finishedAtMs: now - 1000 }], () => null, now);
    expect(round).toMatchObject({ roundId: 'fecha-2', title: 'Fecha 2' });
    expect(round.window).toMatchObject({ open: true, closesAtMs: now - 1000 + MANAGER_WINDOW_MS });
  });

  it('is closed when the admin closed it, and null before any round ends', () => {
    expect(pickManagerRound(tournament, [], () => ({ closedAt: new Date() }), now).window.open).toBe(false);
    expect(pickManagerRound({ matches: [m('3', 'Fecha 1', 'scheduled')] }, [], () => null, now)).toBeNull();
  });

  it('ranks clubs by votes with whole percentages', () => {
    expect(managerRanking({ Talleres: 3, 'SK Konya': 1, Nadie: 0 })).toEqual([
      { club: 'Talleres', votes: 3, pct: 75 },
      { club: 'SK Konya', votes: 1, pct: 25 },
    ]);
  });
});

describe('predictionOutcome (post-partido en /en-vivo)', () => {
  const finished = (home, away) => ({ key: 'k1', status: { kind: 'finished' }, home: { score: home }, away: { score: away } });
  it('reads the 90-minute result of the linked match and how many guessed it', () => {
    const prediction = { liveMatchKey: 'k1', votes: { home: 6, draw: 2, away: 2 } };
    expect(predictionOutcome(prediction, [finished(2, 1)])).toMatchObject({ result: 'home', correctPct: 60, total: 10 });
    expect(predictionOutcome(prediction, [finished(1, 1)])).toMatchObject({ result: 'draw', correctPct: 20 });
  });

  it('is null until the linked match finishes, or without a linked match', () => {
    expect(predictionOutcome({ liveMatchKey: 'k1' }, [{ ...finished(1, 0), status: { kind: 'live' } }])).toBeNull();
    expect(predictionOutcome({ votes: {} }, [finished(1, 0)])).toBeNull();
  });
});

describe('fixtureIsPredictable (match left on air from another season)', () => {
  const tournament = {
    matches: [{ id: '8', homeTeam: 'Aspra Calcio', awayTeam: 'SK Konya', status: 'pending' }],
    bracket: { repechaje: { r2: [{ teamA: '', teamB: 'Sendai Ryuden' }] } },
  };
  const overlay = { matchId: 'plata-r2-1', homeTeamName: 'Ganador 2° Red.', awayTeamName: 'Ganador 4° Red.' };

  it('closes the prediction for a fixture id that is not in the tournament', () => {
    expect(fixtureIsPredictable({ matches: [] }, 'plata-r2-1')).toBe(false);
    expect(predictionWindow({ overlay, prediction: null, matchId: 'plata-r2-1', tournament: { matches: [] } }))
      .toEqual({ open: false, reason: 'Ese partido todavía no tiene los dos equipos definidos.' });
  });

  it('closes it while a cup tie is missing a club', () => {
    expect(fixtureIsPredictable(tournament, 'plata-r2-0')).toBe(false);
  });

  it('keeps it open for a fixture with both clubs, and does not block when the tournament is unknown', () => {
    expect(fixtureIsPredictable(tournament, 'league-8')).toBe(true);
    expect(fixtureIsPredictable(null, 'plata-r2-1')).toBe(true);
    expect(fixtureIsPredictable(tournament, 'm12')).toBe(true);
  });
});
