// Server-rendered markup of the OBS bracket, the in-app cup view and the OBS match panel, with synthetic
// data. No DOM here (no jsdom in the repo), so size-dependent layout uses the 1920×1080 default; the real
// pixel output at each resolution is checked with screenshots.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BroadcastBracket } from '../components/tournament/BroadcastBracket.jsx';
import { CupBracketView } from '../components/tournament/CupBracketView.jsx';
import { OverlayAdminSection } from '../components/admin/OverlayAdminSection.jsx';
import { CUP_IDS } from '../utils/bracketModel.js';

vi.mock('firebase/firestore', () => ({ serverTimestamp: () => 'ts' }));

// useLayoutEffect warns on the server; irrelevant for markup assertions.
vi.spyOn(console, 'error').mockImplementation(() => {});

const LONG = 'Club Atlético Deportivo Supercontinental de los Andes';
const bracket = {
  quarters: [
    { teamA: LONG, teamB: 'River', scoreA: '12', scoreB: '10' },
    { teamA: 'Racing', teamB: 'Huracán', scoreA: 1, scoreB: 1 },
    { teamA: '', teamB: '', scoreA: '', scoreB: '' },
  ],
  semis: [],
  final: { teamA: LONG, teamB: 'Racing', scoreA: 3, scoreB: 0 },
  repechaje: { r1: [{ teamA: 'Tigre', teamB: 'Lanús', scoreA: '', scoreB: '' }] },
};
const count = (html, needle) => html.split(needle).length - 1;

describe('BroadcastBracket', () => {
  it('Oro renders 7 match cards, 2 connectors, one column per round and the champion', () => {
    const html = renderToStaticMarkup(<BroadcastBracket cupId={CUP_IDS.ORO} bracket={bracket} getTeamLogo={() => '/x.webp'} />);
    expect(count(html, 'data-match-key=')).toBe(7);
    expect(html).toContain('data-layout="linear"');
    expect(html).toContain('data-bracket-columns="3"');
    expect(count(html, 'preserveAspectRatio="none"')).toBe(2); // connectors (the trophy icon is another svg)
    expect(html).toContain('Campeón Oro');
    expect(html).toContain(`title="${LONG}"`); // long names are truncated with the full name as title
    expect(html).toContain('>12<'); // two-digit scores render as numbers
    expect(html).toContain('--u:1px');
    expect(html).not.toMatch(/scale\(/); // no arbitrary CSS scale on the bracket
  });

  it('Plata renders 9 cards in the linear layout (4 columns) without admin controls', () => {
    const html = renderToStaticMarkup(<BroadcastBracket cupId={CUP_IDS.PLATA} bracket={bracket} />);
    expect(count(html, 'data-match-key=')).toBe(9);
    expect(html).toContain('data-layout="linear"');
    expect(html).toContain('data-bracket-columns="4"');
    expect(html).toContain('data-tone="silver"');
    expect(html).not.toMatch(/<(button|input|select)/);
    expect(html).toContain('0 / 9');
  });

  it('renders an empty tournament without crashing', () => {
    const html = renderToStaticMarkup(<BroadcastBracket cupId={CUP_IDS.ORO} bracket={undefined} />);
    expect(count(html, 'A definir')).toBe(14);
  });
});

describe('CupBracketView (app)', () => {
  it('shows editable selects and score inputs only while editing', () => {
    const props = { cupId: CUP_IDS.ORO, localData: { bracket }, getTeamLogo: () => '/x.webp', updateGeneric: () => {} };
    const viewing = renderToStaticMarkup(<CupBracketView {...props} isEditing={false} />);
    const editing = renderToStaticMarkup(<CupBracketView {...props} isEditing />);
    expect(viewing).not.toContain('<select');
    expect(count(editing, '<select')).toBe(14);
    expect(count(editing, 'type="number"')).toBe(14);
    expect(editing).toContain('aria-label="CUARTOS 1: equipo 1"');
  });
});

describe('OverlayAdminSection (OBS Partidos)', () => {
  const allTeams = { uidBoca: { teamName: 'Boca', logoUrl: '/boca.webp' }, uidRiver: { teamName: 'River', logoUrl: '/river.webp' } };
  const tournamentData = {
    matches: [
      { id: 'm1', round: 'Fecha 1', homeTeam: 'Boca', awayTeam: 'River', homeScore: 2, awayScore: 0, status: 'completed' },
      { id: 'm2', round: 'Fecha 2', homeTeam: 'River', awayTeam: 'Boca', status: 'scheduled' },
    ],
  };

  it('marks the active match as on air and offers "Poner al aire" for the others', () => {
    const html = renderToStaticMarkup(
      <OverlayAdminSection
        allTeams={allTeams}
        tournamentData={tournamentData}
        broadcastOverlayData={{ matchId: 'league-m2', homeTeamId: 'uidRiver', awayTeamId: 'uidBoca', homeTeamName: 'River', awayTeamName: 'Boca', homeScore: '1', awayScore: '0', roundLabel: 'Fecha 2' }}
        onUpdateBroadcastOverlay={async () => true}
      />,
    );
    expect(html).toContain('aria-current="true"');
    expect(count(html, 'Al aire</span>')).toBe(1);
    expect(html).toContain('Partido del torneo');
    expect(html).toContain('1 – 0');
    // Pending filter is the default: the finished m1 is hidden, so no other "Poner al aire" button.
    expect(count(html, 'Poner al aire</button>')).toBe(0);
  });

  it('shows an empty state when the tournament has no matches', () => {
    const html = renderToStaticMarkup(<OverlayAdminSection allTeams={{}} tournamentData={{ matches: [] }} broadcastOverlayData={{}} />);
    expect(html).toContain('No hay partidos cargados');
    expect(html).toContain('No hay ningún partido en el marcador');
  });

  it('shows a loading skeleton while the tournament is not loaded', () => {
    for (const tournamentData of [undefined, null]) {
      const html = renderToStaticMarkup(<OverlayAdminSection allTeams={{}} tournamentData={tournamentData} broadcastOverlayData={{}} />);
      expect(html).toContain('aria-busy="true"');
    }
  });

  it('warns when the on-air match result changed in the tournament', () => {
    const html = renderToStaticMarkup(
      <OverlayAdminSection
        allTeams={allTeams}
        tournamentData={tournamentData}
        broadcastOverlayData={{ matchId: 'league-m1', homeTeamName: 'Boca', awayTeamName: 'River', homeScore: '1', awayScore: '0' }}
      />,
    );
    expect(html).toContain('El partido cambió en el torneo');
    expect(html).toContain('Resultado final en el torneo: 2 – 0');
  });
});

describe('TournamentBroadcastAdminSection (Torneo y transmisión)', () => {
  it('shows the tournament summary, the on-air control and a single list of OBS sources', async () => {
    const { MemoryRouter } = await import('react-router-dom');
    const { TournamentBroadcastAdminSection } = await import('../components/admin/TournamentBroadcastAdminSection.jsx');
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TournamentBroadcastAdminSection
          allTeams={{}}
          tournamentData={{ league: [{ name: 'Boca' }, { name: 'Club...' }], matches: [{ id: 'm1', status: 'completed', homeScore: 1, awayScore: 0 }], topScorers: [{ name: 'Cavani', goals: 3 }] }}
          broadcastOverlayData={{}}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Abrir gestor del torneo');
    expect(html).toContain('Cavani');
    expect(html).toContain('Al aire en OBS');
    expect(html).toContain('Fuentes de navegador para OBS');
    // Each OBS source appears once (they used to be listed in two tabs).
    for (const path of ['/overlay?scene=live', '/torneo?mode=obs&amp;view=groups', '/torneo?mode=obs&amp;view=bracket', '/torneo?mode=obs&amp;view=repechaje']) {
      expect(count(html, `${path}"`)).toBe(2); // input value + "Ver" link
    }
  });
});
