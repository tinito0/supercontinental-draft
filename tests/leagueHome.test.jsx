// Centro de partidos de la portada (components/league/home/MatchCentre.jsx) con fixtures sintéticos.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MatchCentre } from '../components/league/home/MatchCentre.jsx';
import { StandingsCard } from '../components/league/home/StandingsCard.jsx';
import { buildFixtures, groupFixtures } from '../utils/leagueFixtures.js';

const NOW = Date.UTC(2026, 11, 20, 22);
const clubOf = () => null;
const render = ui => renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>);
const match = (id, extra) => ({ id, round: 'Fecha 1', homeTeam: `H${id}`, awayTeam: `A${id}`, homeScore: '', awayScore: '', status: 'scheduled', ...extra });
const groupsOf = (matches, extra = {}) => groupFixtures(buildFixtures({ tournament: { matches }, now: NOW, ...extra }));

describe('MatchCentre', () => {
  it('opens on the results when nothing is live, newest first', () => {
    const html = render(<MatchCentre groups={groupsOf([match('1', { status: 'completed', homeScore: 2, awayScore: 1 }), match('2')])} clubOf={clubOf} />);
    expect(html).toMatch(/aria-selected="true"[^>]*>[\s\S]*?Resultados/);
    expect(html).toContain('H1');
    expect(html).not.toContain('En vivo');
  });

  it('starts on the live tab with the MVP vote link when a game is live', () => {
    const live = { key: 'k1', status: { kind: 'live', label: "12'" }, updatedAtMs: NOW - 1000, home: { name: 'x', score: 0, draftTeamId: null }, away: { name: 'y', score: 0, draftTeamId: null } };
    const groups = groupsOf([match('1', { importedFrom: 'k1' })], { liveMatches: [live] });
    const html = render(<MatchCentre groups={groups} clubOf={clubOf} />);
    expect(html).toMatch(/aria-selected="true"[^>]*>[\s\S]*?En vivo/);
    expect(html).toContain("12&#x27;");
    expect(html).toContain('Votá el MVP del partido');
    expect(html).toContain('href="/partidos/k1"');
  });

  it('offers the prediction only for the on-air match while it is open', () => {
    const groups = groupsOf([match('1'), match('2')], { overlay: { matchId: 'league-2' } });
    expect(render(<MatchCentre groups={groups} clubOf={clubOf} prediction={{ votes: {} }} />)).toContain('¿Quién gana?');
    expect(render(<MatchCentre groups={groups} clubOf={clubOf} prediction={{ votes: {}, closedAt: 'x' }} />)).not.toContain('¿Quién gana?');
    expect(render(<MatchCentre groups={groupsOf([match('1')])} clubOf={clubOf} prediction={{ votes: {} }} />)).not.toContain('¿Quién gana?');
  });

  it('shows one pre-season line instead of empty tabs when no match is loaded', () => {
    const html = render(<MatchCentre groups={groupsOf([])} clubOf={clubOf} />);
    expect(html).toContain('La temporada arranca cuando se cargue la fecha 1.');
    expect(html).not.toContain('role="tablist"');
  });

  it('hides the results tab until there is a result', () => {
    const html = render(<MatchCentre groups={groupsOf([match('1')])} clubOf={clubOf} />);
    expect(html).toMatch(/aria-selected="true"[^>]*>[\s\S]*?Próximos/);
    expect(html).not.toContain('Resultados');
  });

  it('shows designed empty, loading and error states', () => {
    const empty = groupsOf([]);
    expect(render(<MatchCentre groups={empty} clubOf={clubOf} loading />)).toContain('aria-busy="true"');
    expect(render(<MatchCentre groups={empty} clubOf={clubOf} error="No se pudo cargar el torneo." />)).toContain('No se pudo cargar el torneo.');
  });
});

describe('StandingsCard', () => {
  it('lists the stored order with the Oro and Plata zones', () => {
    const league = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `Club ${i + 1}`, pj: 1, pts: 12 - i, gf: 1, gc: 0 }));
    const html = render(<StandingsCard tournament={{ league }} clubOf={clubOf} />);
    expect(html.indexOf('Club 1<')).toBeLessThan(html.indexOf('Club 2<'));
    expect(html).toContain('1.° a 8.°: Copa de Oro');
    expect(html.match(/, zona Copa de Oro/g)).toHaveLength(8); // las 8 posiciones de la Copa de Oro
    expect(html.match(/, zona Copa de Plata/g)).toHaveLength(4);
  });

  it('lists the entrants without places or zones before the first match', () => {
    const league = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `Club ${i + 1}`, pj: 0, pts: 0 }));
    const html = render(<StandingsCard tournament={{ league }} clubOf={clubOf} />);
    expect(html).toContain('Clubes inscriptos');
    expect(html).toContain('Club 12');
    expect(html).not.toContain('zona Copa de Oro');
    expect(html).not.toContain('<table');
  });
});
