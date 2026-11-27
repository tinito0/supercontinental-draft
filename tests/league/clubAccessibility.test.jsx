// Club, player and history UI: visible text, touch targets and empty values (synthetic data, no hooks).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ClubHonours } from '../../components/league/club/ClubHonours.jsx';
import { ClubSeasonCard } from '../../components/league/club/ClubSeasonCard.jsx';
import { FranchisePlayerCard } from '../../components/league/FranchisePlayerCard.jsx';
import { PlayerMatchLog } from '../../components/league/season/PlayerMatchLog.jsx';

describe('ClubHonours', () => {
  const profile = {
    honours: [],
    seasons: [{ id: 's1', season: '2025', competition: '', result: 'Campeón' }],
  };

  it('captions the campaigns table and names the empty value for screen readers', () => {
    const html = renderToStaticMarkup(<ClubHonours profile={profile} />);
    expect(html).toContain('<caption');
    expect(html).toContain('sin dato');
    expect(html).not.toContain('—');
    expect(html).not.toContain('aria-label="');
  });
});

describe('ClubSeasonCard', () => {
  it('does not hardcode the phase name', () => {
    const standing = { position: 3, teams: 12, zone: '', stats: [['PTS', 9]] };
    const html = renderToStaticMarkup(<MemoryRouter><ClubSeasonCard standing={standing} /></MemoryRouter>);
    expect(html).not.toContain('Fase suiza');
    expect(html).toContain('SuperContinental League');
  });
});

describe('FranchisePlayerCard', () => {
  it('does not print a stray 0 for a zero OVR or age', () => {
    const html = renderToStaticMarkup(<FranchisePlayerCard player={{ name: 'Ana Pérez', ovr: 0, age: 0, pos: '' }} />);
    expect(html).not.toMatch(/>0</);
  });
});

describe('PlayerMatchLog', () => {
  it('uses the EmptyState copy when the player has no official matches', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlayerMatchLog log={[]} teamsById={{}} /></MemoryRouter>);
    expect(html).toContain('Todavía no jugó partidos oficiales registrados por el juego.');
  });

  it('names assists for screen readers and drops the hover-only title', () => {
    const log = [{
      matchKey: 'm1', startedAt: '20261104T162412Z', result: 'W', own: { score: 2 }, rival: { name: 'Rival FC', score: 1 },
      line: { goals: 1, assists: 2, yellow: 0, red: 0, minutes: 90, rating: 7.5 },
    }];
    const html = renderToStaticMarkup(<MemoryRouter><PlayerMatchLog log={log} teamsById={{}} /></MemoryRouter>);
    expect(html).toContain('<span class="sr-only"> asistencias</span>');
    expect(html).not.toContain('title="Asistencias"');
  });
});
