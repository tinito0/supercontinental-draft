// Server-rendered markup of the OBS bracket, the in-app cup view and the OBS match panel, with synthetic
// data. No DOM here (no jsdom in the repo), so size-dependent layout uses the 1920×1080 default; the real
// pixel output at each resolution is checked with screenshots.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BroadcastBracket } from '../components/tournament/BroadcastBracket.jsx';
import { CupBracketView } from '../components/tournament/CupBracketView.jsx';
import { ObsSceneStudio } from '../components/admin/obs/ObsSceneStudio.jsx';
import { OverlayPopup } from '../components/broadcast/OverlayPopup.jsx';
import { BroadcastOverlay } from '../components/BroadcastOverlay.jsx';
import { BroadcastLeagueTable } from '../components/broadcast/BroadcastLeagueTable.jsx';
import { CUP_IDS } from '../utils/bracketModel.js';
import { OBS_SCENES } from '../utils/obsScenes.js';

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
    // Cada columna escala sus tarjetas con su lugar (bracketModel.broadcastCardScale): las semis más que los cuartos.
    const scales = [...html.matchAll(/--bb-k:([\d.]+)/g)].map(m => Number(m[1]));
    expect(scales).toHaveLength(7);
    expect(Math.max(...scales)).toBeGreaterThan(Math.min(...scales));
    expect(Math.min(...scales)).toBeGreaterThan(1);
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

describe('ObsSceneStudio (Admin → Escenas de OBS)', () => {
  const allTeams = { uidBoca: { teamName: 'Boca', logoUrl: '/boca.webp' }, uidRiver: { teamName: 'River', logoUrl: '/river.webp' } };
  const tournamentData = {
    matches: [
      { id: 'm1', round: 'Fecha 1', homeTeam: 'Boca', awayTeam: 'River', homeScore: 2, awayScore: 0, status: 'completed' },
      { id: 'm2', round: 'Fecha 2', homeTeam: 'River', awayTeam: 'Boca', status: 'scheduled' },
    ],
  };
  const onAir = { scene: 'previa', matchId: 'league-m2', homeTeamId: 'uidRiver', awayTeamId: 'uidBoca', homeTeamName: 'River', awayTeamName: 'Boca', homeScore: '0', awayScore: '0', roundLabel: 'Fecha 2' };

  it('lists every scene, marks the one on air and opens it selected with its match', () => {
    const html = renderToStaticMarkup(<ObsSceneStudio allTeams={allTeams} tournamentData={tournamentData} broadcastOverlayData={onAir} onUpdateBroadcastOverlay={async () => true} />);
    for (const scene of OBS_SCENES) expect(html).toContain(scene.label);
    expect(count(html, 'Al aire</span></button>')).toBe(1); // insignia de la lista de escenas
    expect(html).toMatch(/aria-current="true"[^>]*>[\s\S]*?Previa/);
    expect(html).toContain('En el aire ahora');
    expect(html).toMatch(/River<\/span> vs <span[^>]*>Boca/);
    // Sin cambios, la escena que ya está al aire no se puede volver a publicar.
    expect(html).toContain('title="Esta escena ya está en el aire y no hay cambios"');
    expect(html).toContain('Vista previa a escala');
  });

  it('shows the empty and loading states of the match list', () => {
    expect(renderToStaticMarkup(<ObsSceneStudio allTeams={{}} tournamentData={{ matches: [] }} broadcastOverlayData={{ scene: 'previa' }} />)).toContain('No hay partidos cargados');
    for (const data of [undefined, null]) {
      expect(renderToStaticMarkup(<ObsSceneStudio allTeams={{}} tournamentData={data} broadcastOverlayData={{ scene: 'previa' }} />)).toContain('aria-busy="true"');
    }
  });

  it('warns when the on-air match result changed in the tournament', () => {
    const html = renderToStaticMarkup(<ObsSceneStudio allTeams={allTeams} tournamentData={tournamentData}
      broadcastOverlayData={{ scene: 'final', matchId: 'league-m1', homeTeamName: 'Boca', awayTeamName: 'River', homeScore: '1', awayScore: '0' }} />);
    expect(html).toContain('El partido cambió en el torneo');
    expect(html).toContain('Resultado final en el torneo: 2 – 0');
  });

  it('tournament scenes have no settings of their own; the live scene explains the clean overlay', () => {
    expect(renderToStaticMarkup(<ObsSceneStudio allTeams={{}} tournamentData={{}} broadcastOverlayData={{ scene: 'tabla' }} />)).toContain('se actualiza sola');
    expect(renderToStaticMarkup(<ObsSceneStudio allTeams={{}} tournamentData={{}} broadcastOverlayData={{ scene: 'live' }} />)).toContain('el overlay queda limpio');
  });
});

describe('TournamentBroadcastAdminSection (Torneo y transmisión)', () => {
  it('shows the tournament summary, the scene studio and one recommended OBS source', async () => {
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
    expect(html).toContain('Escenas de OBS');
    expect(html).toContain('Conectar OBS');
    expect(count(html, '/draft/overlay"')).toBe(2); // input value + "Ver" link
    expect(html).not.toContain('mode=obs');
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
    const html = renderToStaticMarkup(<ObsSceneStudio allTeams={{}} tournamentData={{ matches: [] }} broadcastOverlayData={{}} />);
    expect(html).toContain('Popup para la comunidad');
    expect(html).toContain('Tabla y copas');
    expect(html).toContain('Mostrar en OBS');
  });
});

it('the Macro Deck guide lists the scene commands and Windows paths with their backslashes', () => {
  const html = renderToStaticMarkup(<ObsSceneStudio allTeams={{}} tournamentData={{ matches: [] }} broadcastOverlayData={{}} />);
  expect(html).toContain('Botones de Macro Deck 3');
  expect(html).toContain('{&quot;action&quot;:&quot;scene&quot;,&quot;scene&quot;:&quot;previa&quot;}');
  expect(html).toContain('overlay-control');
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

describe('BroadcastOverlay full-screen and tournament scenes', () => {
  const popup = { visible: true, title: 'Tabla y copas', text: '', url: 'https://example.com/torneo', position: 'right', autoHideSec: 0 };
  const tournamentData = {
    league: [{ name: 'Racing', pts: 2 }, { name: 'Boca', pts: 0 }],
    matches: [{ id: 'm1', round: 'Fecha 1', homeTeam: 'Racing', awayTeam: 'Boca', homeScore: 2, awayScore: 1, status: 'completed' },
      { id: 'm2', round: 'Fecha 2', homeTeam: 'Boca', awayTeam: 'Racing', homeScore: '', awayScore: '', date: '2026-12-19', time: '21:00', status: 'scheduled' }],
    bracket: { quarters: [{ teamA: 'Racing', teamB: 'Boca', scoreA: 1, scoreB: 1, penaltiesA: 4, penaltiesB: 3 }] },
  };

  it('renders the table, both cups and the scorers inside the overlay, with the popup on top', () => {
    for (const [scene, marker] of [['tabla', 'Tabla de posiciones'], ['bracket', 'Copa de Oro'], ['repechaje', 'Copa de Plata'], ['goleadores', 'Goleadores']]) {
      const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene, popup, showLowerThird: true, showTicker: true }} allTeams={{}} tournamentData={tournamentData} />);
      expect(html, scene).toContain(marker);
      expect(html, scene).toContain('class="scl-frame scl-popup');
      if (scene !== 'goleadores') expect(html, scene).not.toContain('class="broadcast-lower"');
    }
  });

  it('shows a cup tie decided on penalties', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'bracket' }} allTeams={{}} tournamentData={tournamentData} />);
    expect(html).toContain('Final · 4-3 pen.');
  });

  it('the Fecha scene lists the open round with date and time', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'partidos' }} allTeams={{}} tournamentData={tournamentData} />);
    expect(html).toContain('Fecha 2');
    expect(html).toContain('19/12 · 21:00');
    expect(html).not.toContain('2-1');
  });

  it('shows club initials instead of the league crest when a club has no crest', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'tabla' }} allTeams={{}} tournamentData={tournamentData} />);
    expect(html).toContain('scl-crest-initials');
  });

  it('moves the community card to the right when the popup is on the left', () => {
    const now = Date.now();
    const live = { mvpTop: [{ id: 1, name: 'Saka', pct: 60, votes: 3 }], mvp: null };
    const overlayData = { scene: 'live', popup: { ...popup, position: 'left', shownAt: now }, card: { visible: true, kind: 'mvp', autoHideSec: 0, shownAt: now } };
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={overlayData} live={live} />);
    expect(html).toMatch(/scl-card[^>]*data-position="right"/);
  });
});
