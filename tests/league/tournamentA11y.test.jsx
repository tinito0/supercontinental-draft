// Accessibility markup of the /torneo views and the tournament centre (static markup, synthetic data).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchCenter } from '../../components/tournament/MatchCenter.jsx';
import { MatchCard } from '../../components/tournament/MatchCard.jsx';
import { LeagueTableView } from '../../components/tournament/LeagueTableView.jsx';
import { StatsView } from '../../components/tournament/StatsView.jsx';
import { StandingsTable } from '../../components/league/tournament/StandingsTable.jsx';

const noop = () => {};
const match = (id, round) => ({ id, round, homeTeam: 'Club Uno', awayTeam: 'Club Dos', date: '2026-11-01', status: 'scheduled' });

describe('MatchCenter round chips', () => {
  const html = renderToStaticMarkup(
    <MatchCenter matches={[match('a', 'Fecha 1'), match('b', 'Fecha 2')]} onUpdate={noop} onAdd={noop} onRemove={noop} getTeamLogo={() => ''} />,
  );

  it('exposes the selected round with aria-pressed and keeps 44px targets', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>Todas \(2\)/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Fecha 1</);
    expect(html).toContain('min-h-11');
  });

  it('lets long club names wrap instead of truncating them', () => {
    expect(html).toContain('line-clamp-2 break-words');
    expect(html).not.toMatch(/truncate tracking-wide/);
  });
});

describe('penalty counts in cup ties', () => {
  it('reads the shootout score with the word "penales" for screen readers', () => {
    const cupMatch = { id: 'c1', teamA: 'Boca', teamB: 'River', scoreA: 1, scoreB: 1, penaltiesA: 4, penaltiesB: 3, status: 'completed' };
    const html = renderToStaticMarkup(<MatchCard match={cupMatch} stage="cuartos" path="" index={0} isEditing={false} updateMatch={noop} getTeamLogo={() => ''} />);
    expect(html).toContain('<span class="sr-only"> en los penales</span>');
    expect(html).not.toContain('aria-label="4 en los penales"');
  });
});

describe('scorers tab', () => {
  it('does not show a hover state on rows that link nowhere', () => {
    const html = renderToStaticMarkup(
      <StatsView localData={{ topScorers: [{ name: 'Haaland', team: 'Club Uno', goals: 3 }], topAssisters: [] }} isEditing={false} isObsMode={false} getTeamLogo={() => ''} showTitle={false} />,
    );
    expect(html).toContain('Haaland');
    expect(html).not.toContain('hover:bg-white/[0.02]');
  });
});

describe('standings legends', () => {
  const rows = [{ id: 'x', name: 'Club Uno', pj: 2, pg: 2, gpen: 0, pp: 0, gf: 4, gc: 1, pts: 4 }];
  const clubOf = () => null;

  it('explains every abbreviation in a visible legend under the standings', () => {
    const html = renderToStaticMarkup(<StandingsTable rows={rows} clubOf={clubOf} />);
    expect(html).toContain('Abreviaturas: PJ partidos jugados');
    expect(html).toContain('DG diferencia de gol');
    expect(html).toContain('<caption');
  });

  it('gives the league table its own caption and a legend that matches its headers', () => {
    const html = renderToStaticMarkup(
      <LeagueTableView localData={{ league: rows, matches: [] }} isEditing={false} isObsMode={false} userTeamName="" getTeamLogo={() => ''} />,
    );
    expect(html).toContain('<caption class="sr-only">Clasificación de la SuperContinental League</caption>');
    expect(html).toContain('G = 2 pts');
    expect(html).not.toContain('PG = 2 pts');
  });
});
