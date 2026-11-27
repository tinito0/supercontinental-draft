import { describe, test, expect } from 'vitest';
import {
  SQUAD_RULE_LABELS, buildTeamRuleRows, benchMinImpact, benchMinImpactText, checkBench, evaluateSquadRules,
  missingPlayersNote, rowsWithBenchMin, squadFromLocks, summarizeRuleRows,
} from '../utils/squadRules.js';
import { fillRuleFigures } from '../utils/leagueContent.js';

// Synthetic clubs (not game data): ids 1..n, OVR per player.
const squadOf = (ovrs, startId = 1) => ovrs.map((ovr, i) => ({ Id: startId + i, OVR_CALCULADO: ovr, Country1: 204 }));
const lineupOf = ids => Object.fromEntries(ids.map((id, slot) => [slot, String(id)]));
const eleven = start => lineupOf(Array.from({ length: 11 }, (_, i) => start + i));

// Club A: bench of 10 players at 75. Club B: bench at 72. Club C: only 5 players (bench not measured).
const clubA = squadOf([...Array(11).fill(85), ...Array(10).fill(75)], 1);
const clubB = squadOf([...Array(11).fill(85), ...Array(10).fill(72)], 100);
const clubC = squadOf([85, 85, 85, 85, 85], 200);
const catalog = new Map([...clubA, ...clubB, ...clubC].map(p => [String(p.Id), p]));
const locksFor = (userId, players) => Object.fromEntries(players.map(p => [String(p.Id), { lockedBy: userId }]));
const locks = { ...locksFor('a', clubA), ...locksFor('b', clubB), ...locksFor('c', clubC) };
const teams = {
  a: { teamName: 'Alfa', lineup: eleven(1), country: 204 },
  b: { teamName: 'Beta', lineup: eleven(100), country: 204 },
  c: { teamName: 'Gamma', lineup: {}, country: 204 },
};

describe('SQUAD_RULE_LABELS', () => {
  test('one name per rule, used by the evaluation', () => {
    const labels = evaluateSquadRules({ squad: clubA, lineup: eleven(1), teamCountry: 204 }).rules.map(rule => rule.label);
    expect(labels).toEqual([SQUAD_RULE_LABELS.squad.long, SQUAD_RULE_LABELS.bench.long, SQUAD_RULE_LABELS.locals.long]);
    expect(Object.values(SQUAD_RULE_LABELS).map(label => label.short)).toEqual(['Plantel', 'Banco', 'Locales']);
  });
});

describe('locks without a catalog record (REG-5)', () => {
  const withGhosts = { ...locks, 9001: { lockedBy: 'c' }, 9002: { lockedBy: 'c' } };

  test('squadFromLocks counts them instead of dropping them', () => {
    const squad = squadFromLocks(withGhosts, 'c', catalog);
    expect(squad.players).toHaveLength(5);
    expect(squad.missingCount).toBe(2);
    expect(squad.missingIds).toEqual(['9001', '9002']);
    expect(squadFromLocks(withGhosts, 'nobody', catalog)).toEqual({ players: [], missingIds: [], missingCount: 0 });
  });

  test('they count toward the squad minimum and are reported on the row', () => {
    const row = buildTeamRuleRows(teams, withGhosts, catalog).find(r => r.userId === 'c');
    expect(row.result.missingCount).toBe(2);
    expect(row.result.rules.find(rule => rule.id === 'squad')).toMatchObject({ value: '7', detail: 'Faltan 14' });
  });

  test('a squad one player short is complete when the missing one is owned', () => {
    const players = squadOf(Array(20).fill(80));
    expect(evaluateSquadRules({ squad: players, lineup: {}, teamCountry: 204 }).rules[0].ok).toBe(false);
    expect(evaluateSquadRules({ squad: players, lineup: {}, teamCountry: 204, missingCount: 1 }).rules[0].ok).toBe(true);
    expect(checkBench(players, eleven(1), { missingCount: 1 }).applies).toBe(true);
    expect(checkBench(players, eleven(1)).applies).toBe(false);
  });

  test('the note is plural-aware and empty without missing players', () => {
    expect(missingPlayersNote(0)).toBeNull();
    expect(missingPlayersNote(1)).toBe('1 jugador sin ficha');
    expect(missingPlayersNote(2)).toBe('2 jugadores sin ficha');
  });

  test('without missing players the result is the one it always was', () => {
    const plain = evaluateSquadRules({ squad: clubA, lineup: eleven(1), teamCountry: 204 });
    expect(plain.missingCount).toBe(0);
    expect(plain.rules.map(rule => rule.value)).toEqual(['21', '75,0', '21']);
  });
});

describe('same bench in the board and in Mi Equipo (REG-9)', () => {
  test('both read the squad through squadFromLocks, so one club gets one result', () => {
    const [row] = buildTeamRuleRows({ b: teams.b }, locks, catalog);
    const mine = squadFromLocks(locks, 'b', catalog);
    const miEquipo = evaluateSquadRules({ squad: mine.players, lineup: teams.b.lineup, teamCountry: teams.b.country, missingCount: mine.missingCount });
    expect(miEquipo).toEqual(row.result);
    expect(row.result.rules.find(rule => rule.id === 'bench').value).toBe('72,0');
  });
});

describe('summarizeRuleRows (REG-4)', () => {
  test('splits clubs into failing, in order and not measured, adding up to the total', () => {
    const rows = buildTeamRuleRows(teams, locks, catalog);
    expect(summarizeRuleRows(rows)).toEqual({ total: 3, failing: 2, unmeasured: 0, compliant: 1 });
  });

  test('a club without a country is not measured, not in order', () => {
    const rows = buildTeamRuleRows({ a: { ...teams.a, country: undefined } }, locks, catalog);
    expect(rows[0].result.rules.find(rule => rule.id === 'locals').applies).toBe(false);
    expect(summarizeRuleRows(rows)).toEqual({ total: 1, failing: 0, unmeasured: 1, compliant: 0 });
  });
});

describe('benchMinImpact (REG-3)', () => {
  const rows = buildTeamRuleRows(teams, locks, catalog, { benchMin: 73 });

  test('raising the minimum names the clubs that stop meeting it', () => {
    expect(benchMinImpact(rows, 73, 78)).toEqual({ stopMeeting: ['Alfa'], startMeeting: [] });
  });

  test('lowering it names the clubs that start meeting it', () => {
    expect(benchMinImpact(rows, 73, 70)).toEqual({ stopMeeting: [], startMeeting: ['Beta'] });
  });

  test('a club whose bench is not measured never changes', () => {
    expect(benchMinImpact(rows, 73, 40).startMeeting).not.toContain('Gamma');
    expect(benchMinImpact(rows, 73, 99).stopMeeting).not.toContain('Gamma');
  });

  test('rowsWithBenchMin matches a fresh build with that minimum', () => {
    const fresh = buildTeamRuleRows(teams, locks, catalog, { benchMin: 78 });
    expect(rowsWithBenchMin(rows, 78).map(r => [r.userId, r.result.ok])).toEqual(fresh.map(r => [r.userId, r.result.ok]));
  });

  test('the sentence says who, singular and plural', () => {
    expect(benchMinImpactText(78, { stopMeeting: ['Alfa'], startMeeting: [] })).toBe('Con 78, 1 club dejaría de cumplir (Alfa).');
    expect(benchMinImpactText(78, { stopMeeting: ['A', 'B'], startMeeting: ['C'] })).toBe('Con 78, 2 clubes dejarían de cumplir (A, B) y 1 club pasaría a cumplir (C).');
    expect(benchMinImpactText(78, { stopMeeting: ['A', 'B', 'C', 'D', 'E'], startMeeting: [] })).toContain('(A, B, C y 2 más)');
    expect(benchMinImpactText(73, { stopMeeting: [], startMeeting: [] })).toBe('Con 73, ningún club cambia de estado.');
  });
});

describe('fillRuleFigures (REG-6)', () => {
  test('replaces the three names with the enforced figures', () => {
    expect(fillRuleFigures('Plantel de {plantelMinimo}, banco {bancoMinimo}, {localesMinimo} locales.', 76))
      .toBe('Plantel de 21, banco 76, 7 locales.');
  });

  test('shows a dash while the bench minimum loads, and leaves other braces alone', () => {
    expect(fillRuleFigures('Banco {bancoMinimo} {otra}', null)).toBe('Banco – {otra}');
    expect(fillRuleFigures(undefined, 73)).toBe('');
  });
});
