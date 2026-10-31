// Server-rendered markup of the squad-rule views (synthetic data).
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BenchRule } from '../components/formation/BenchRule.jsx';
import { SquadRulesStats } from '../components/SquadRulesStats.jsx';
import { SquadRulesAdminSection } from '../components/admin/SquadRulesAdminSection.jsx';
import { checkBench, evaluateSquadRules } from '../utils/squadRules.js';

const squadOf = (ovrs, extra = () => ({})) => ovrs.map((ovr, i) => ({ Id: i + 1, OVR_CALCULADO: ovr, ...extra(i) }));
const eleven = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, String(i + 1)]));
const weakSquad = squadOf([...Array(11).fill(85), ...Array(10).fill(70)], i => ({ Country1: i < 3 ? 204 : 10 }));

describe('BenchRule', () => {
  it('says the save is blocked in words, not only in red', () => {
    const html = renderToStaticMarkup(<BenchRule check={checkBench(weakSquad, eleven)} />);
    expect(html).toContain('70,0');
    expect(html).toContain('Por debajo de 73: la alineación no se guarda');
    expect(html).toContain('text-danger-soft');
  });

  it('explains why the bench is not measured yet', () => {
    const html = renderToStaticMarkup(<BenchRule check={checkBench(weakSquad.slice(0, 15), eleven)} />);
    expect(html).toContain('Se mide desde los 21 jugadores');
    expect(html).not.toContain('text-danger-soft');
  });
});

describe('SquadRulesStats', () => {
  it('shows each rule with its minimum and what is missing', () => {
    const html = renderToStaticMarkup(<SquadRulesStats result={evaluateSquadRules({ squad: weakSquad, lineup: eleven, teamCountry: 204 })} />);
    expect(html).toContain('2 sin cumplir');
    expect(html).toContain('/ 7');
    expect(html).toContain('mín. 73');
    expect(html).toContain('Mandá al banco a un jugador de más media');
    expect(html).toContain('Sumá jugadores del país del club.');
  });
});

describe('SquadRulesAdminSection', () => {
  it('lists every approved club and how many pass', () => {
    const allPlayers = weakSquad;
    const playerLocks = Object.fromEntries(weakSquad.map(p => [String(p.Id), { lockedBy: 'a' }]));
    const allTeams = { a: { teamName: 'Club Uno', country: 204, lineup: eleven }, b: { teamName: 'Club Dos', country: 204 } };
    const html = renderToStaticMarkup(<SquadRulesAdminSection allTeams={allTeams} playerLocks={playerLocks} allPlayers={allPlayers} />);
    expect(html).toContain('Club Uno');
    expect(html).toContain('Club Dos');
    expect(html).toContain('clubes incumplen alguna regla');
    expect(html).toContain('Por debajo del mínimo');
  });

  it('shows a loading state until the catalog arrives', () => {
    const html = renderToStaticMarkup(<SquadRulesAdminSection allTeams={{}} playerLocks={{}} allPlayers={[]} />);
    expect(html).toContain('Cargando los planteles');
  });
});
