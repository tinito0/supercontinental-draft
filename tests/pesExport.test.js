import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadMasterPesCsv,
  generateRosterCsv,
  generatePlayersCsv,
  generateTeamCsv,
  generateCoachCsv,
  generateFormationCsv,
  generateAppearancesCsv,
  alignStarters,
} from '../utils/pesExport.js';
import { FORMATIONS } from '../utils/constants.js';

// Formation.csv maps formation slot k to Roster player k: starters must stay aligned to slots. Synthetic data.
describe('alignStarters', () => {
  const layout = FORMATIONS['4-3-3'].layout;
  const squad = Array.from({ length: 14 }, (_, i) => ({ Id: 100 + i, Name: `P${i}` }));
  const fullLineup = Object.fromEntries(layout.map((_, i) => [i, 100 + i]));

  it('keeps each starter in its own slot when the lineup is complete', () => {
    const { starters, subs, filledSlots } = alignStarters(layout, fullLineup, squad);
    expect(starters.map(p => p.Id)).toEqual(layout.map((_, i) => 100 + i));
    expect(subs.map(p => p.Id)).toEqual([111, 112, 113]);
    expect(filledSlots).toEqual([]);
  });

  it('does not shift later starters when a slot is empty or its player was sold', () => {
    const lineup = { ...fullLineup, 2: undefined, 6: 999 }; // slot 2 empty, slot 6 sold
    const { starters, filledSlots } = alignStarters(layout, lineup, squad);
    expect(starters).toHaveLength(11);
    expect(starters[3].Id).toBe(103); // was moved to slot 2 before the fix
    expect(starters[10].Id).toBe(110);
    expect(filledSlots.map(f => [f.slot, f.pos, f.player.Id])).toEqual([[2, 'DFC', 102], [6, 'MC', 106]]);
  });

  it('never uses the same player twice', () => {
    const { starters } = alignStarters(layout, { ...fullLineup, 1: 100 }, squad);
    expect(new Set(starters.map(p => p.Id)).size).toBe(11);
  });
});

describe('CSV text cells', () => {
  it('a team or coach name with ";" or a newline cannot shift columns', () => {
    const team = generateTeamCsv(103, 'Club; Atlético\nNorte').split('\n')[1].split(';');
    expect(team[1]).toBe('Club Atlético Norte');
    const coach = generateCoachCsv(103, 'DT;X').split('\n')[1].split(';');
    expect(coach[1]).toBe('DT X');
  });
});

describe('utils/pesExport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadMasterPesCsv & generatePlayersCsv', () => {
    it('fetches jugadores_exportados.csv on-demand and parses line content', async () => {
      const mockCsvContent = 'Id;Name;JapaneseName;LatinName;Country;Height;Weight;Age\n100;Messi;Lionel Messi;MESSI;ARG;170;72;36\n200;Ronaldo;Cristiano Ronaldo;RONALDO;POR;187;83;39';

      const progressUpdates = [];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        headers: new Map([['content-length', String(mockCsvContent.length)]]),
        text: async () => mockCsvContent,
      });

      const map = await loadMasterPesCsv((prog) => progressUpdates.push(prog));
      expect(map).toBeDefined();
      expect(map.get('100')).toContain('Messi');
      expect(map.get('200')).toContain('Ronaldo');

      // Test generatePlayersCsv
      const squad = [
        { Id: '100', Name: 'Messi', POS_NOMBRE: 'DC', OVR_CALCULADO: 94 },
        { Id: '999', Name: 'Custom Player', POS_NOMBRE: 'MC', OVR_CALCULADO: 75 },
      ];

      const { csvContent, missingPlayers } = await generatePlayersCsv(squad);
      expect(csvContent).toContain('100;Messi;Lionel Messi');
      expect(csvContent).toContain('999;Custom Player');
      expect(missingPlayers).toHaveLength(1);
      expect(missingPlayers[0].Id).toBe('999');
    });
  });

  describe('generateRosterCsv', () => {
    it('generates a valid 40-slot Roster.csv header and values', () => {
      const starters = [{ Id: 10 }, { Id: 20 }];
      const subs = [{ Id: 30 }];
      const dorsals = { '10': 10, '20': 7 };

      const rosterCsv = generateRosterCsv(103, starters, subs, dorsals);
      const lines = rosterCsv.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('Id;Player1;Player2');
      expect(lines[0]).toContain('TotalPlayers');

      const dataCols = lines[1].split(';');
      expect(dataCols[0]).toBe('103'); // teamId
      expect(dataCols[1]).toBe('10');  // player 1 ID
      expect(dataCols[2]).toBe('20');  // player 2 ID
      expect(dataCols[3]).toBe('30');  // player 3 ID
    });
  });

  describe('generateTeamCsv & generateCoachCsv', () => {
    it('generates valid Team.csv content', () => {
      const teamCsv = generateTeamCsv(105, 'Boca Juniors', 204);
      expect(teamCsv).toContain('Id;Name;Country;');
      expect(teamCsv).toContain('105;Boca Juniors;204;');
    });

    it('generates valid Coach.csv content', () => {
      const coachCsv = generateCoachCsv(105, 'Carlos Bianchi', 204);
      expect(coachCsv).toContain('Id;Name;Country;');
      expect(coachCsv).toContain('105001;Carlos Bianchi;204;');
    });
  });

  describe('generateFormationCsv & generateAppearancesCsv', () => {
    it('generates valid Formation.csv content', () => {
      const starters = [{ Id: 1 }, { Id: 2 }, { Id: 3 }];
      const formationCsv = generateFormationCsv(103, '4-3-3', starters);
      expect(formationCsv).toContain('Id;Position1F1S1');
      expect(formationCsv).toContain('103;');
    });

    it('generates valid Appearances.csv content for squad', () => {
      const squad = [{ Id: 10 }, { id: 20 }];
      const appearancesCsv = generateAppearancesCsv(squad);
      expect(appearancesCsv).toContain('Id;NeckLength;');
      expect(appearancesCsv).toContain('10;');
      expect(appearancesCsv).toContain('20;');
    });
  });
});
