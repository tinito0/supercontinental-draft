// Centro de partidos en modo edición con partidos importados del colector (synthetic data, server-rendered markup).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchCenter } from '../components/tournament/MatchCenter.jsx';
import { MatchCard } from '../components/tournament/MatchCard.jsx';

const base = { round: 'Fecha 1', homeTeam: 'Club Uno', awayTeam: 'Club Dos', date: '2026-11-01', status: 'completed', homeScore: '2', awayScore: '1' };
const imported = { ...base, id: 'm1', importedFrom: 'pes:abc', homeGoals: 'Haaland x2', awayGoals: 'Foden' };
const manual = { ...base, id: 'm2', homeTeam: 'Club Tres', awayTeam: 'Club Cuatro' };
const render = props => renderToStaticMarkup(
  <MatchCenter matches={[imported, manual]} onUpdate={() => {}} onAdd={() => {}} onRemove={() => {}} getTeamLogo={() => ''} {...props} />,
);

describe('MatchCenter edit mode', () => {
  it('marks matches that came from the game', () => {
    expect(render({ isEditing: false }).match(/Del juego/g)).toHaveLength(1);
  });

  it('locks the result of an imported match and offers the manual correction', () => {
    const html = render({ isEditing: true });
    expect(html).toContain('Resultado del juego, bloqueado.');
    expect(html).toContain('Corregir a mano');
    // Only the manual match has score inputs.
    expect(html).toContain('Goles de Club Tres');
    expect(html).not.toContain('Goles de Club Uno');
  });

  it('folds the manual scorers form and drops the old round suggestion', () => {
    const html = render({ isEditing: true });
    expect(html).toContain('Goleadores, asistencias y MVP a mano');
    expect(html).not.toContain('Sugerir próxima fecha');
    expect(html).toContain('Agregar partido a mano');
    expect(render({ isEditing: true, redoRound: { round: 'Fecha 2', onClick: () => {} } })).toContain('Rehacer Fecha 2');
  });

  it('offers the Fecha 1 draw from the empty state, only to the admin', () => {
    const empty = props => renderToStaticMarkup(<MatchCenter matches={[]} onUpdate={() => {}} onAdd={() => {}} onRemove={() => {}} getTeamLogo={() => ''} {...props} />);
    expect(empty({ isAdmin: true, onDrawRoundOne: () => {} })).toContain('Sortear Fecha 1');
    const publicView = empty({ isAdmin: false, onDrawRoundOne: () => {} });
    expect(publicView).not.toContain('Sortear Fecha 1');
    expect(publicView).not.toContain('botón Editar');
  });
});

describe('MatchCard (copas)', () => {
  const cup = { teamA: 'Club Uno', teamB: 'Club Dos', scoreA: '1', scoreB: '0', importedFrom: 'pes:xyz' };
  it('keeps an imported cup tie read-only while editing', () => {
    const html = renderToStaticMarkup(<MatchCard match={cup} stage="quarters" index={0} isEditing updateMatch={() => {}} getTeamLogo={() => ''} />);
    expect(html).toContain('Corregir a mano');
    expect(html).not.toContain('<input');
  });
  it('shows the source when not editing', () => {
    expect(renderToStaticMarkup(<MatchCard match={cup} stage="quarters" index={0} getTeamLogo={() => ''} />)).toContain('Del juego');
  });
});
