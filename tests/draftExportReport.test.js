// Pre-export report (Admin → Plantillas). Pure, synthetic teams shaped like loadDraftTeams().
import { describe, it, expect } from 'vitest';
import { draftTeamReport, draftExportReport } from '../utils/draftExportReport.js';

const squad = n => Array.from({ length: n }, (_, i) => ({ Id: i + 1, Name: `J${i + 1}` }));
const fullLineup = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, String(i + 1)]));
const dorsals = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));

describe('draftTeamReport', () => {
  it('passes a complete team', () => {
    const report = draftTeamReport({ id: 'a', name: 'A', players: squad(18), lineup: fullLineup, setPieces: { captain: '1' }, dorsals: dorsals(18) });
    expect(report).toEqual({ id: 'a', name: 'A', errors: [], warnings: [] });
  });

  it('flags what the exporters would leave out or guess', () => {
    const report = draftTeamReport({
      id: 'b', name: 'B', players: squad(41), lineup: { 0: '1', 1: '99' }, setPieces: {}, dorsals: { 1: 7, 2: 7 },
      squadWarnings: ['X: está en el carrito pero no es del equipo; queda fuera.'],
    });
    expect(report.errors).toEqual(['Tiene 41 jugadores; el juego admite 40.']);
    expect(report.warnings).toEqual(expect.arrayContaining([
      'X: está en el carrito pero no es del equipo; queda fuera.',
      '1 titular(es) de la formación ya no son del equipo: esos puestos quedan vacíos.',
      'Alineación incompleta: 1 de 11 titulares.',
      'Sin capitán elegido: se usa al primer titular de campo.',
      'Dorsal 7 repetido: J1, J2.',
      '39 jugador(es) sin dorsal.',
    ]));
  });

  it('lists teams with problems first', () => {
    const ok = { id: 'a', name: 'A', players: squad(11), lineup: fullLineup, setPieces: { captain: '1' }, dorsals: dorsals(11) };
    const empty = { id: 'z', name: 'Z', players: [] };
    expect(draftExportReport([ok, empty]).map(r => r.id)).toEqual(['z', 'a']);
  });
});
