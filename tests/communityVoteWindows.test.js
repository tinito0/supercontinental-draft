// Ventanas y boletas de los votos sin cuenta (supabase/functions/_shared/communityVote.js): finishedAt, señal perdida,
// partidos ya jugados, cierre por clubes y «ya votaste» con la opción contada. Datos sintéticos.
import {
  castVote, clientIp, CommunityVoteError, finishedAtFor, fixtureIsFinished, LIVE_SIGNAL_MS, MVP_GRACE_MS, mvpWindow,
  predictionClosure, predictionWindow,
} from '../supabase/functions/_shared/communityVote.js';
import { pickMvpMatch, predictionOutcome } from '../utils/communityView.js';

const now = 50_000_000;

describe('mvpWindow with finishedAt and signal', () => {
  it('counts the 15 minutes from finishedAt, not from the last upload', () => {
    const late = { status: 'finished', finishedAtMs: now - MVP_GRACE_MS - 1, updatedAtMs: now };
    expect(mvpWindow(late, now).open).toBe(false);
    expect(mvpWindow({ ...late, finishedAtMs: now - 60_000 }, now).open).toBe(true);
  });

  it('falls back to updatedAt for matches saved before finishedAt existed', () => {
    expect(mvpWindow({ status: 'finished', updatedAtMs: now - 60_000 }, now).open).toBe(true);
  });

  it('closes a live match that stopped uploading for 10 minutes', () => {
    expect(mvpWindow({ status: 'live', updatedAtMs: now - LIVE_SIGNAL_MS - 1 }, now).open).toBe(false);
    expect(mvpWindow({ status: 'live', updatedAtMs: now - 30_000 }, now).open).toBe(true);
  });
});

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
    matches: [{ id: '7', status: 'completed', homeScore: 2, awayScore: 0 }, { id: '8', status: 'scheduled', homeScore: '', awayScore: '' }],
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

describe('castVote: MVP closed by the admin', () => {
  it('rejects the vote while the match is still inside its window', async () => {
    const docs = {
      'artifacts/x/public/data/mvp_votes/k1': { votes: {}, total: 0, closedAt: new Date(now) },
      'artifacts/x/public/data/live_matches/k1': { status: 'live', updatedAt: new Date(now - 1000), summaryJson: JSON.stringify({ lineups: { home: { starting: [7] } } }) },
    };
    const firestore = { runTransaction: async fn => fn({ get: async path => (docs[path] ? { data: docs[path] } : null), create() {}, set() {} }) };
    const vote = { kind: 'mvp', target: 'k1', choice: 7 };
    const error = await castVote({ firestore, appId: 'x', vote, ipHash: 'i', deviceHash: 'd', now }).catch(e => e);
    expect(error).toBeInstanceOf(CommunityVoteError);
    expect(error.message).toMatch(/cerrada/);
  });
});

describe('pickMvpMatch (página /en-vivo)', () => {
  const match = (key, kind, extra = {}) => ({ key, status: { kind }, ...extra });
  it('skips a live match without signal and offers the one that just finished', () => {
    const matches = [match('a', 'live', { updatedAtMs: now - LIVE_SIGNAL_MS - 1 }), match('b', 'finished', { finishedAtMs: now - 60_000, updatedAtMs: now })];
    expect(pickMvpMatch(matches, now).match.key).toBe('b');
  });

  it('closes when the end was more than 15 minutes ago, even with recent uploads', () => {
    expect(pickMvpMatch([match('b', 'finished', { finishedAtMs: now - MVP_GRACE_MS - 1, updatedAtMs: now })], now)).toEqual({ match: null, open: false });
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
