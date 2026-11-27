import { SQUAD_LINES, countByLine, lineColor, squadLineKey } from '../utils/squadLines.js';

describe('squad lines', () => {
  test('maps the three named groups and counts anything else as forward', () => {
    expect(squadLineKey('Arqueros')).toBe('portero');
    expect(squadLineKey('Defensores')).toBe('defensa');
    expect(squadLineKey('Mediocampistas')).toBe('medio');
    expect(squadLineKey('Delanteros')).toBe('delantero');
    expect(squadLineKey(undefined)).toBe('delantero');
  });

  test('counts players per line', () => {
    const players = [{ Grupo: 'Arqueros' }, { Grupo: 'Defensores' }, { Grupo: 'Defensores' }, { Grupo: 'Delanteros' }];
    expect(countByLine(players)).toEqual({ portero: 1, defensa: 2, medio: 0, delantero: 1 });
    expect(countByLine(null)).toEqual({ portero: 0, defensa: 0, medio: 0, delantero: 0 });
  });

  test('every line colour comes from a --c-data token and falls back to the same value outside a browser', () => {
    SQUAD_LINES.forEach(line => {
      expect(line.token).toMatch(/^--c-data-/);
      expect(lineColor(line, null)).toBe(`rgb(${line.fallback.split(' ').join(', ')})`);
    });
  });
});
