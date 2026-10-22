// services/tournamentService.js con un Firestore en memoria: guardados concurrentes, repetidos y correcciones.
// La transacción falsa aplica las escrituras al final, como Firestore (lecturas antes de escrituras).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map();
const versions = new Map();
const pathOf = ref => ref.path;

vi.mock('../config/firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, collectionPath, id) => ({ path: id ? `${collectionPath}/${id}` : collectionPath }),
  serverTimestamp: () => 'SERVER_TIME',
  // Como Firestore: si un documento leído cambió antes del commit, la transacción se reintenta con los datos nuevos.
  runTransaction: async (_db, fn) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const writes = [];
      const reads = new Map();
      const transaction = {
        get: async ref => {
          reads.set(pathOf(ref), versions.get(pathOf(ref)) || 0);
          await Promise.resolve();
          return { exists: () => store.has(pathOf(ref)), data: () => JSON.parse(JSON.stringify(store.get(pathOf(ref)))) };
        },
        set: (ref, data, options) => writes.push([pathOf(ref), current => (options?.merge || options?.mergeFields ? { ...(current || {}), ...data } : data)]),
        delete: ref => writes.push([pathOf(ref), null]),
      };
      const result = await fn(transaction);
      await Promise.resolve();
      if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
      for (const [path, apply] of writes) {
        if (apply) store.set(path, apply(store.get(path)));
        else store.delete(path);
        versions.set(path, (versions.get(path) || 0) + 1);
      }
      return result;
    }
    throw new Error('demasiados reintentos');
  },
}));

const { saveTournamentEdit } = await import('../services/tournamentService.js');
const { normalizeTournament } = await import('../utils/tournamentModel.js');

const TOURNAMENT = 'artifacts/scl-draft-2025/public/data/tournament/official';
const NEWS = id => `artifacts/scl-draft-2025/public/data/news/match-${id}`;
const teams = Array.from({ length: 12 }, (_, i) => `Club ${String(i + 1).padStart(2, '0')}`);
const roundOne = () => teams.filter((_, i) => i % 2 === 0).map((home, i) => ({
  id: `f1-${i + 1}`, round: 'Fecha 1', homeTeam: home, awayTeam: teams[i * 2 + 1], homeScore: '', awayScore: '', status: 'scheduled',
}));
const stored = () => store.get(TOURNAMENT);
const result = (data, id, homeScore, awayScore) => ({
  ...data,
  matches: data.matches.map(match => (match.id === id ? { ...match, homeScore, awayScore, status: 'completed' } : match)),
});

beforeEach(() => {
  store.clear();
  versions.clear();
  store.set(TOURNAMENT, { league: teams.map(name => ({ name })), matches: roundOne() });
});

describe('saveTournamentEdit', () => {
  it('saves a result, recalculates the table and publishes one news item', async () => {
    const base = normalizeTournament(stored());
    const saved = await saveTournamentEdit({ base, edited: result(base, 'f1-1', 2, 0) });
    expect(saved.ok).toBe(true);
    expect(stored().league[0]).toMatchObject({ name: 'Club 01', pts: 2, pj: 1 });
    expect(store.get(NEWS('f1-1'))).toMatchObject({ homeScore: 2, awayScore: 0, homeTeam: 'Club 01' });
    expect(stored().updatedAt).toBe('SERVER_TIME');
  });

  it('two admins saving different results from the same base keep both', async () => {
    const base = normalizeTournament(stored());
    await saveTournamentEdit({ base, edited: result(base, 'f1-1', 1, 0) });
    await saveTournamentEdit({ base, edited: result(base, 'f1-2', 0, 3) });
    const byId = Object.fromEntries(stored().matches.map(m => [m.id, m]));
    expect(byId['f1-1']).toMatchObject({ homeScore: 1, status: 'completed' });
    expect(byId['f1-2']).toMatchObject({ awayScore: 3, status: 'completed' });
  });

  it('generates the next round exactly once, even when the last results arrive concurrently or twice', async () => {
    let base = normalizeTournament(stored());
    for (const id of ['f1-1', 'f1-2', 'f1-3', 'f1-4']) base = result(base, id, 1, 0);
    await saveTournamentEdit({ base: normalizeTournament(stored()), edited: base });
    const before = normalizeTournament(stored());
    // Dos pestañas cargan los dos últimos resultados desde la misma base.
    const [a, b] = await Promise.all([
      saveTournamentEdit({ base: before, edited: result(before, 'f1-5', 2, 1) }),
      saveTournamentEdit({ base: before, edited: result(before, 'f1-6', 0, 1) }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const round2 = stored().matches.filter(m => m.round === 'Fecha 2');
    expect(round2).toHaveLength(6);
    expect(stored().swissStatus.generatedRounds).toEqual([2]);
    // Repetir el último guardado no crea nada nuevo.
    const reloaded = normalizeTournament(stored());
    const again = await saveTournamentEdit({ base: reloaded, edited: reloaded });
    expect(again.generatedRound).toBeNull();
    expect(stored().matches.filter(m => m.round === 'Fecha 2')).toHaveLength(6);
  });

  it('a corrected result updates the table instead of adding to it', async () => {
    const base = normalizeTournament(stored());
    await saveTournamentEdit({ base, edited: result(base, 'f1-1', 2, 0) });
    const after = normalizeTournament(stored());
    await saveTournamentEdit({ base: after, edited: result(after, 'f1-1', 0, 1) });
    const rows = Object.fromEntries(stored().league.map(row => [row.name, row]));
    expect(rows['Club 01']).toMatchObject({ pj: 1, pts: 0, pp: 1 });
    expect(rows['Club 02']).toMatchObject({ pj: 1, pts: 2, pg: 1 });
    expect(store.get(NEWS('f1-1'))).toMatchObject({ homeScore: 0, awayScore: 1 });
  });

  it('reverting a result removes it from the table and deletes its news', async () => {
    const base = normalizeTournament(stored());
    await saveTournamentEdit({ base, edited: result(base, 'f1-1', 2, 0) });
    const after = normalizeTournament(stored());
    const reverted = { ...after, matches: after.matches.map(m => (m.id === 'f1-1' ? { ...m, status: 'scheduled' } : m)) };
    await saveTournamentEdit({ base: after, edited: reverted });
    expect(stored().league.find(row => row.name === 'Club 01')).toMatchObject({ pj: 0, pts: 0 });
    expect(store.has(NEWS('f1-1'))).toBe(false);
  });

  it('writes nothing when the edit conflicts with a newer save', async () => {
    const base = normalizeTournament(stored());
    await saveTournamentEdit({ base, edited: result(base, 'f1-1', 2, 0) });
    const snapshot = JSON.stringify(stored());
    const conflict = await saveTournamentEdit({ base, edited: result(base, 'f1-1', 5, 5) });
    expect(conflict).toMatchObject({ ok: false, conflicts: [expect.stringMatching(/Club 01 vs Club 02/)] });
    expect(JSON.stringify(stored())).toBe(snapshot);
  });

  it('refuses a 13th club instead of dropping it', async () => {
    const base = normalizeTournament(stored());
    const edited = { ...base, matches: [...base.matches, { id: 'x', round: 'Amistoso', homeTeam: 'Club Fantasma', awayTeam: 'Club 01', homeScore: 1, awayScore: 0, status: 'completed' }] };
    const saved = await saveTournamentEdit({ base, edited });
    expect(saved).toMatchObject({ ok: false, error: expect.stringMatching(/Club Fantasma/) });
  });
});
