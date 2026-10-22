// Server-rendered markup of the OBS bracket, the in-app cup view and the OBS match panel, with synthetic
// data. No DOM here (no jsdom in the repo), so size-dependent layout uses the 1920×1080 default; the real
// pixel output at each resolution is checked with screenshots.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BroadcastBracket } from '../components/tournament/BroadcastBracket.jsx';
import { CupBracketView } from '../components/tournament/CupBracketView.jsx';
import { OverlayAdminSection } from '../components/admin/OverlayAdminSection.jsx';
import { OverlayPopup } from '../components/broadcast/OverlayPopup.jsx';
import { BroadcastOverlay } from '../components/BroadcastOverlay.jsx';
import { BroadcastLeagueTable } from '../components/broadcast/BroadcastLeagueTable.jsx';
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
    // 14 marcadores + la tanda del 1-1 Racing-Huracán.
    expect(count(editing, 'type="number"')).toBe(16);
    expect(editing).toContain('aria-label="CUARTOS 1: equipo 1"');
    expect(editing).toContain('aria-label="CUARTOS 2: penales de Racing"');
    expect(viewing).toContain('Falta la tanda');
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

describe('OverlayPopup (OBS, QR para la comunidad)', () => {
  const popup = { visible: true, title: 'Seguí la liga', text: 'Escaneá', url: 'https://example.com/torneo', position: 'left', autoHideSec: 0 };

  it('renders the framed card with title, QR and short URL when visible', () => {
    const html = renderToStaticMarkup(<OverlayPopup popup={popup} />);
    expect(html).toContain('data-position="left"');
    expect(html).toContain('Seguí la liga');
    expect(html).toContain('aria-label="Código QR: https://example.com/torneo"');
    expect(html).toContain('example.com/torneo');
  });

  it('renders nothing when hidden, without a link, or after its time ran out', () => {
    expect(renderToStaticMarkup(<OverlayPopup popup={{ ...popup, visible: false }} />)).toBe('');
    expect(renderToStaticMarkup(<OverlayPopup popup={{ ...popup, url: '' }} />)).toBe('');
    expect(renderToStaticMarkup(<OverlayPopup popup={{ ...popup, autoHideSec: 30, shownAt: 1 }} />)).toBe('');
    expect(renderToStaticMarkup(<OverlayPopup popup={undefined} />)).toBe('');
  });

  it('shows the admin block with presets and a QR preview', () => {
    const html = renderToStaticMarkup(<OverlayAdminSection allTeams={{}} tournamentData={{ matches: [] }} broadcastOverlayData={{}} />);
    expect(html).toContain('Popup para la comunidad');
    expect(html).toContain('Tabla y copas');
    expect(html).toContain('Mostrar en OBS');
  });
});

describe('BroadcastOverlay during the match', () => {
  const popup = { visible: true, title: 'Seguí la liga', text: '', url: 'https://example.com/', position: 'right', autoHideSec: 0 };

  it('shows only the popup in the live scene: no scoreboard, lower third or ticker', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'live', homeTeamName: 'Racing', popup }} allTeams={{}} tournamentData={{}} />);
    expect(html).toContain('class="scl-frame scl-popup');
    expect(html).not.toContain('class="broadcast-top-score"');
    expect(html).not.toContain('class="broadcast-lower"');
    expect(html).not.toContain('class="broadcast-ticker"');
  });

  it('keeps the lower third and ticker in the other scenes', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'previa' }} allTeams={{}} tournamentData={{}} />);
    expect(html).toContain('class="broadcast-lower"');
    expect(html).toContain('class="broadcast-ticker"');
  });
});

describe('BroadcastLeagueTable (OBS tabla)', () => {
  it('renders the framed table with the 12 clubs, signed goal difference and points', () => {
    const league = Array.from({ length: 14 }, (_, i) => ({ id: String(i), name: i === 13 ? 'Club...' : `Club ${i}`, pj: 1, pg: 1, gpen: 0, pp: 0, gf: 3, gc: i, pts: 2 }));
    const html = renderToStaticMarkup(<BroadcastLeagueTable league={league} getTeamLogo={() => ''} />);
    expect(html).toContain('Tabla de posiciones');
    expect(count(html, '<tr>')).toBe(13); // header + 12 clubs (placeholder rows dropped)
    expect(html).toContain('>+3<');
    expect(html).toContain('>-2<');
  });

  it('says so when there is no data', () => {
    expect(renderToStaticMarkup(<BroadcastLeagueTable league={[]} />)).toContain('Sin datos cargados');
  });
});

describe('OverlaySceneControl (Admin → Overlay)', () => {
  it('shows one instant button per scene, marks the one on air and lists the Macro Deck commands', () => {
    const html = renderToStaticMarkup(<OverlayAdminSection allTeams={{}} tournamentData={{ matches: [] }} broadcastOverlayData={{ scene: 'previa', showTicker: true }} />);
    expect(html).toContain('Escena en OBS');
    expect(count(html, 'aria-pressed=')).toBe(8);
    expect(count(html, 'aria-pressed="true"')).toBe(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?Previa/);
    expect(html).toContain('Botones de Macro Deck 3');
    expect(html).toContain('{&quot;action&quot;:&quot;scene&quot;,&quot;scene&quot;:&quot;previa&quot;}');
    expect(html).toContain('overlay-control');
  });
});

it('the Macro Deck guide shows Windows paths with their backslashes', () => {
  const html = renderToStaticMarkup(<OverlayAdminSection allTeams={{}} tournamentData={{ matches: [] }} broadcastOverlayData={{}} />);
  expect(html).toContain('%APPDATA%\\scl-bridge\\config.json');
  expect(html).toContain('pes-collector\\bridge\\scl-obs.cmd');
});

describe('community card and live scenes (overlay en vivo)', () => {
  const now = Date.now();
  const live = {
    score: { home: 2, away: 1 },
    scorers: { home: [{ key: 'g0', name: 'Saka', minute: "12'", tag: '' }], away: [{ key: 'g1', name: 'Nine', minute: "61'", tag: 'p.' }] },
    prediction: { home: 50, draw: 30, away: 20, total: 10, leader: 'home' },
    mvp: { id: 7, name: 'Saka', votes: 5, pct: 63 },
    mvpTop: [{ id: 7, name: 'Saka', votes: 5, pct: 63 }, { id: 9, name: 'Nine', votes: 3, pct: 37 }],
    cup: { title: '¿Quién gana la Copa de Oro?', open: true, total: 4, options: [{ id: 'a', name: 'Los Pibes', votes: 3, pct: 75 }, { id: 'b', name: 'La Banda', votes: 1, pct: 25 }] },
  };
  const overlay = card => ({ scene: 'live', homeTeamName: 'Arsenal', awayTeamName: 'Gençlerbirliği', card: { visible: true, autoHideSec: 20, shownAt: now, ...card } });

  it('shows the MVP leader with its share during the match', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={overlay({ kind: 'mvp' })} live={live} />);
    expect(html).toContain('MVP en vivo');
    expect(html).toContain('Saka');
    expect(html).toContain('63%');
    expect(html).toContain('is-leader');
  });

  it('shows which prediction is winning, draw included', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={overlay({ kind: 'prediction' })} live={live} />);
    expect(html).toContain('La comunidad predijo');
    expect(html).toContain('Ganan: Arsenal');
    expect(html).toContain('Empate');
    expect(html).toContain('30%');
  });

  it('shows the cup poll and hides the card when there are no votes or it expired', () => {
    expect(renderToStaticMarkup(<BroadcastOverlay overlayData={overlay({ kind: 'cup' })} live={live} />)).toContain('Los Pibes');
    expect(renderToStaticMarkup(<BroadcastOverlay overlayData={overlay({ kind: 'mvp' })} live={{ ...live, mvpTop: [] }} />)).not.toContain('scl-card');
    expect(renderToStaticMarkup(<BroadcastOverlay overlayData={overlay({ kind: 'mvp', shownAt: now - 60_000 })} live={live} />)).not.toContain('scl-card');
  });

  it('the final scene uses the game score, the scorers and the community MVP', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'final', homeScore: '0', awayScore: '0' }} live={live} />);
    expect(html).toContain('2-1');
    expect(html).toContain('Saka');
    expect(html).toContain("61&#x27; p.");
    expect(html).toContain('MVP de la comunidad');
  });

  it('the previa scene shows the community prediction', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'previa' }} live={live} />);
    expect(html).toContain('La comunidad dice');
    expect(html).toContain('Empate 30%');
  });
});
