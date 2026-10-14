import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadMasterPesCsv,
  generateRosterCsv,
  generatePlayersCsv,
  generateTeamCsv,
  generateCoachCsv,
  generateFormationCsv,
  generateAppearancesCsv,
} from '../utils/pesExport.js';

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
