// Unit tests with synthetic bracket data (no Firestore). They prove structure, connector geometry and the
// OBS layout choice; the pixel result is checked separately with screenshots.
import { describe, it, expect } from 'vitest';
import {
  BROADCAST_METRICS,
  CUP_IDS,
  buildBracketColumns,
  buildConnectors,
  buildCupRounds,
  cardWidthFor,
  chooseBroadcastLayout,
  connectorPaths,
  getMatchWinner,
  isTiedScore,
  shootoutLabel,
  isMatchCompleted,
  slotCenter,
} from '../utils/bracketModel.js';

const m = (teamA, teamB, scoreA = '', scoreB = '') => ({ teamA, teamB, scoreA, scoreB });

const fullBracket = {
  quarters: [m('A', 'H', 2, 0), m('D', 'E', 1, 3), m('B', 'G'), m('C', 'F')],
  semis: [m('A', 'E'), m('', '')],
  final: m('', ''),
  repechaje: {
    r1: [m('I', 'J'), m('K', 'L'), m('M', 'N'), m('O', 'P')],
    r2: [m('', ''), m('', '')],
    semis: [m('', ''), m('', '')],
    final: m('', ''),
  },
};

/** All numbers of a path, in order. */
function endpoints(path) {
  return path.match(/-?\d+(\.\d+)?/g).map(Number);
}

/** The y coordinates a path visits (M x,y and V y; H only moves x). */
function pathYs(path) {
  const ys = [];
  const re = /([MHV])\s*(-?[\d.]+)(?:,(-?[\d.]+))?/g;
  let match;
  while ((match = re.exec(path))) {
    if (match[1] === 'M') ys.push(Number(match[3]));
    if (match[1] === 'V') ys.push(Number(match[2]));
  }
  return ys;
}

describe('getMatchWinner / isMatchCompleted', () => {
  it('needs both scores and no draw', () => {
    expect(getMatchWinner(m('A', 'B', 2, 1))).toBe('A');
    expect(getMatchWinner(m('A', 'B', '0', '3'))).toBe('B');
    expect(getMatchWinner(m('A', 'B', 1, 1))).toBeNull();
    expect(getMatchWinner(m('A', 'B', 1, ''))).toBeNull();
    expect(getMatchWinner(null)).toBeNull();
    expect(isMatchCompleted(m('A', 'B', 0, 0))).toBe(true);
    expect(isMatchCompleted(m('A', 'B', '', 0))).toBe(false);
  });

  it('a tie is decided by the shootout when it is loaded', () => {
    expect(getMatchWinner({ ...m('A', 'B', 1, 1), penaltiesA: 3, penaltiesB: 4 })).toBe('B');
    expect(getMatchWinner({ ...m('A', 'B', 1, 1), penaltiesA: '', penaltiesB: '' })).toBeNull();
    expect(shootoutLabel({ ...m('A', 'B', 1, 1), penaltiesA: 4, penaltiesB: 3 })).toBe('4-3 pen.');
    expect(shootoutLabel({ ...m('A', 'B', 2, 1), penaltiesA: 4, penaltiesB: 3 })).toBe('');
    expect(isTiedScore(m('A', 'B', '2', 2))).toBe(true);
    expect(isTiedScore(m('A', 'B', '', ''))).toBe(false);
  });
});

describe('buildCupRounds', () => {
  it('Copa de Oro has 4-2-1 matches with seeds on the quarters', () => {
    const rounds = buildCupRounds(CUP_IDS.ORO, fullBracket);
    expect(rounds.map(r => r.matches.length)).toEqual([4, 2, 1]);
    expect(rounds[0].matches[0]).toMatchObject({ seedA: '1°', seedB: '8°', path: ['quarters'], index: 0 });
    expect(rounds[2].matches[0]).toMatchObject({ isFinal: true, path: ['final'] });
  });

  it('Copa de Plata has 4-2-2-1 matches under bracket.repechaje', () => {
    const rounds = buildCupRounds(CUP_IDS.PLATA, fullBracket);
    expect(rounds.map(r => r.matches.length)).toEqual([4, 2, 2, 1]);
    expect(rounds[1].matches[1].path).toEqual(['repechaje', 'r2']);
    expect(rounds[0].matches[3].match.teamA).toBe('O');
  });

  it('fills missing or incomplete data with empty matches instead of crashing', () => {
    for (const bracket of [undefined, {}, { quarters: [m('A', 'B')], repechaje: {} }]) {
      const oro = buildCupRounds(CUP_IDS.ORO, bracket);
      const plata = buildCupRounds(CUP_IDS.PLATA, bracket);
      expect(oro.flatMap(r => r.matches)).toHaveLength(7);
      expect(plata.flatMap(r => r.matches)).toHaveLength(9);
      expect(oro[2].matches[0].match).toEqual({ teamA: '', teamB: '', scoreA: '', scoreB: '' });
    }
  });

  it('rejects unknown cups', () => {
    expect(() => buildCupRounds('bronce', {})).toThrow();
  });
});

describe('buildBracketColumns', () => {
  it('mirrors Oro into 5 columns that converge on the final', () => {
    const columns = buildBracketColumns(buildCupRounds(CUP_IDS.ORO, fullBracket), 'mirrored');
    expect(columns.map(c => [c.side, c.entries.length])).toEqual([
      ['left', 2], ['left', 1], ['center', 1], ['right', 1], ['right', 2],
    ]);
    // Right wing keeps the second half of each round (Q3, Q4 → SF2).
    expect(columns[4].entries.map(e => e.index)).toEqual([2, 3]);
    expect(columns[3].entries[0].index).toBe(1);
  });

  it('mirrors Plata into 7 columns and lays both cups out linearly with one column per round', () => {
    const plata = buildCupRounds(CUP_IDS.PLATA, fullBracket);
    expect(buildBracketColumns(plata, 'mirrored')).toHaveLength(7);
    expect(buildBracketColumns(plata, 'linear').map(c => c.entries.length)).toEqual([4, 2, 2, 1]);
    expect(buildBracketColumns(buildCupRounds(CUP_IDS.ORO, {}), 'linear').map(c => c.entries.length)).toEqual([4, 2, 1]);
  });
});

describe('connector geometry', () => {
  it('slot centers split the column into equal parts', () => {
    expect(slotCenter(0, 1)).toBe(50);
    expect([slotCenter(0, 2), slotCenter(1, 2)]).toEqual([25, 75]);
    expect([0, 1, 2, 3].map(i => slotCenter(i, 4))).toEqual([12.5, 37.5, 62.5, 87.5]);
  });

  it('a fork joins the two feeder centers and leaves at the target center', () => {
    const [path] = connectorPaths(2, 1, 'ltr');
    expect(path).toBe('M 0,25 H 50 V 75 H 0 M 50,50 H 100');
    const paths = connectorPaths(4, 2, 'ltr');
    expect(endpoints(paths[0])).toEqual([0, 12.5, 50, 37.5, 0, 50, 25, 100]);
    expect(endpoints(paths[1])).toEqual([0, 62.5, 50, 87.5, 0, 50, 75, 100]);
  });

  it('equal counts draw straight lines; rtl mirrors x', () => {
    expect(connectorPaths(2, 2, 'ltr')).toEqual(['M 0,25 H 100', 'M 0,75 H 100']);
    expect(connectorPaths(2, 1, 'rtl')[0]).toBe('M 100,25 H 50 V 75 H 100 M 50,50 H 0');
    expect(connectorPaths(0, 1)).toEqual([]);
  });

  it('every connector of both cups ends exactly on a slot center of its neighbours', () => {
    for (const cupId of [CUP_IDS.ORO, CUP_IDS.PLATA]) {
      for (const layout of ['mirrored', 'linear']) {
        const columns = buildBracketColumns(buildCupRounds(cupId, fullBracket), layout);
        const connectors = buildConnectors(columns);
        expect(connectors).toHaveLength(columns.length - 1);
        connectors.forEach((connector, i) => {
          const counts = [columns[i].entries.length, columns[i + 1].entries.length];
          const valid = new Set(counts.flatMap(n => Array.from({ length: n }, (_, k) => slotCenter(k, n))));
          connector.paths.forEach(path => {
            pathYs(path).forEach(y => expect(valid.has(y)).toBe(true));
          });
        });
        expect(connectors.filter(c => c.toFinal)).toHaveLength(layout === 'mirrored' ? 2 : 1);
      }
    }
  });
});

describe('chooseBroadcastLayout (OBS)', () => {
  const resolutions = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720]];

  it.each(resolutions)('at %ix%i both cups use one column per round, legible and inside the width', (w, h) => {
    for (const cupId of [CUP_IDS.ORO, CUP_IDS.PLATA]) {
      const rounds = buildCupRounds(cupId, fullBracket);
      const { layout, unit, cardWidth } = chooseBroadcastLayout(rounds, w, h);
      expect(layout).toBe('linear');
      expect(cardWidth).toBeGreaterThanOrEqual(BROADCAST_METRICS.minCardWidth * unit);
      expect(cardWidth).toBeLessThanOrEqual(BROADCAST_METRICS.maxCardWidth * unit);
      const columns = buildBracketColumns(rounds, layout).length;
      const total = columns * cardWidth + (columns - 1) * BROADCAST_METRICS.connectorWidth * unit + 2 * BROADCAST_METRICS.sidePadding * unit;
      expect(total).toBeLessThanOrEqual(w + 0.5);
    }
  });

  it('cards scale with the source: at 1920×1080 an Oro card is 520px, never the old 169px (260px × 0.65)', () => {
    const { cardWidth, unit } = chooseBroadcastLayout(buildCupRounds(CUP_IDS.ORO, {}), 1920, 1080);
    expect(unit).toBe(1);
    expect(cardWidth).toBe(520);
    const plata = chooseBroadcastLayout(buildCupRounds(CUP_IDS.PLATA, {}), 1920, 1080);
    expect(plata.cardWidth).toBeGreaterThan(400); // was 130px (260px × 0.50)
  });

  it('a width-limited source keeps the same proportions at any aspect ratio', () => {
    for (const [w, h] of [[1080, 1080], [1080, 1920]]) {
      expect(chooseBroadcastLayout(buildCupRounds(CUP_IDS.ORO, {}), w, h).layout).toBe('linear');
      expect(chooseBroadcastLayout(buildCupRounds(CUP_IDS.PLATA, {}), w, h).layout).toBe('linear');
    }
  });

  it('an ultrawide (height-limited) source uses the spare width: Oro goes mirrored, Plata (7 columns) does not', () => {
    expect(chooseBroadcastLayout(buildCupRounds(CUP_IDS.ORO, {}), 2560, 1080).layout).toBe('mirrored');
    expect(chooseBroadcastLayout(buildCupRounds(CUP_IDS.PLATA, {}), 2560, 1080).layout).toBe('linear');
  });

  it('linear is chosen whenever mirrored cards would fall under the minimum width', () => {
    const unit = 1;
    expect(cardWidthFor(5, 1920, unit)).toBeLessThan(BROADCAST_METRICS.minCardWidth);
    expect(cardWidthFor(3, 1920, unit)).toBeGreaterThanOrEqual(BROADCAST_METRICS.minCardWidth);
  });
});

describe('cup progression (seedGoldCup / advanceCups)', () => {
  const ranking = Array.from({ length: 12 }, (_, i) => ({ name: `T${String(i + 1).padStart(2, '0')}` }));

  it('seeds the Oro quarter-finals from the table only when they are empty', async () => {
    const { seedGoldCup } = await import('../utils/bracketModel.js');
    const seeded = seedGoldCup({}, ranking);
    expect(seeded.ok).toBe(true);
    expect(seeded.bracket.quarters.map(m => [m.teamA, m.teamB])).toEqual([['T01', 'T08'], ['T04', 'T05'], ['T02', 'T07'], ['T03', 'T06']]);
    expect(seedGoldCup(seeded.bracket, ranking)).toMatchObject({ ok: false });
    expect(seedGoldCup({}, ranking.slice(0, 7))).toMatchObject({ ok: false, reason: expect.stringMatching(/8 clasificados/) });
  });

  it('never overwrites a filled slot and warns when it disagrees with the result', async () => {
    const { advanceCups } = await import('../utils/bracketModel.js');
    const bracket = {
      quarters: [{ teamA: 'T01', teamB: 'T08', scoreA: 0, scoreB: 1 }, { teamA: 'T04', teamB: 'T05', scoreA: 2, scoreB: 0 }],
      semis: [{ teamA: 'T01', teamB: '', scoreA: '', scoreB: '' }],
    };
    const { bracket: next, warnings, changes } = advanceCups(bracket, ranking);
    expect(next.semis[0]).toMatchObject({ teamA: 'T01', teamB: 'T04' });
    expect(changes).toEqual(['T04 → Semifinal 1 (Oro)']);
    expect(warnings[0]).toMatch(/figura T01, pero el que corresponde es T08/);
  });

  it('waits for the final table before building the Plata round 1', async () => {
    const { advanceCups } = await import('../utils/bracketModel.js');
    const quarters = [['T01', 'T08'], ['T04', 'T05'], ['T02', 'T07'], ['T03', 'T06']].map(([teamA, teamB]) => ({ teamA, teamB, scoreA: 1, scoreB: 0 }));
    expect(advanceCups({ quarters }, ranking).bracket.repechaje.r1[0].teamA).toBe('');
    expect(advanceCups({ quarters }, ranking, { leagueComplete: true }).bracket.repechaje.r1.map(m => [m.teamA, m.teamB]))
      .toEqual([['T09', 'T08'], ['T10', 'T07'], ['T11', 'T06'], ['T12', 'T05']]);
  });

  it('sends the Oro semi-final losers to the Plata semis and builds both finals', async () => {
    const { advanceCups } = await import('../utils/bracketModel.js');
    const won = (teamA, teamB) => ({ teamA, teamB, scoreA: 1, scoreB: 0 });
    const bracket = {
      quarters: [won('T01', 'T08'), won('T04', 'T05'), won('T02', 'T07'), won('T03', 'T06')],
      semis: [won('T01', 'T04'), won('T02', 'T03')],
      final: won('T01', 'T02'),
      repechaje: { r1: [won('T09', 'T08'), won('T10', 'T07'), won('T11', 'T06'), won('T12', 'T05')], r2: [won('T09', 'T10'), won('T11', 'T12')] },
    };
    const { bracket: next } = advanceCups(bracket, ranking, { leagueComplete: true });
    expect(next.repechaje.semis.map(m => [m.teamA, m.teamB])).toEqual([['T09', 'T04'], ['T11', 'T03']]);
    expect(next.repechaje.final).toMatchObject({ teamA: '', teamB: '' });
  });
});
