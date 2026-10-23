import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Radio, Trophy, Vote } from 'lucide-react';
import { Tabs } from '../../ui/Tabs.jsx';
import { Alert } from '../../ui/Alert.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { FixtureRow } from '../match/FixtureRow.jsx';

/* Centro de partidos de la portada: en vivo, últimos resultados y próximos, con datos reales del torneo y del juego
   (hooks/useLeagueFixtures.js). Arranca en lo más relevante: lo que se juega ahora; si no hay nada, los resultados;
   si la temporada no empezó, los próximos. */

const PREVIEW_ROWS = 6;

function VoteLink({ children }) {
  return (
    <Link to="/en-vivo" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-soft hover:text-ink">
      <Vote className="h-4 w-4" aria-hidden="true" /> {children}
    </Link>
  );
}

function actionFor(fixture, prediction) {
  if (fixture.status === 'live') return <VoteLink>Votá el MVP del partido</VoteLink>;
  // La predicción abre cuando el admin pone el partido al aire y cierra cuando arranca (community-vote).
  if (fixture.status === 'scheduled' && fixture.isOnAir && prediction && !prediction.closedAt) return <VoteLink>¿Quién gana? Votá tu predicción</VoteLink>;
  return null;
}

function List({ fixtures, clubOf, prediction }) {
  return (
    <ul className="divide-y divide-line/10">
      {fixtures.slice(0, PREVIEW_ROWS).map(fixture => (
        <FixtureRow key={fixture.id} fixture={fixture} clubOf={clubOf} action={actionFor(fixture, prediction)} />
      ))}
    </ul>
  );
}

/**
 * @param {{ groups: { live, results, upcoming, other }, clubOf: Function, loading: boolean, error: string,
 *   liveError?: string, prediction?: object|null, round?: { title, fixtures } }} props  round: utils/leagueFixtures.currentRound
 */
export function MatchCentre({ groups, round, clubOf, loading, error, liveError, prediction }) {
  const live = [...groups.live, ...groups.other.filter(f => f.status === 'nosignal')];
  const upcoming = [...groups.upcoming, ...groups.other.filter(f => f.status === 'postponed')];
  const results = [...groups.results, ...groups.other.filter(f => f.status === 'abandoned')];
  const preferred = live.length ? 'live' : results.length ? 'results' : 'upcoming';
  const [chosen, setChosen] = useState(null);
  const tab = chosen || preferred;

  const tabs = [
    { id: 'live', label: 'En vivo', icon: Radio, count: groups.live.length || null, hidden: !live.length },
    { id: 'results', label: 'Resultados', icon: Trophy },
    { id: 'upcoming', label: 'Próximos', icon: CalendarDays, count: groups.upcoming.length || null },
  ];

  let body;
  if (error) body = <div className="p-4"><Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert></div>;
  else if (loading) {
    body = (
      <div className="divide-y divide-line/10" aria-busy="true" aria-label="Cargando partidos">
        {[0, 1, 2].map(i => <div key={i} className="mx-4 my-3 h-14 skeleton" />)}
      </div>
    );
  } else {
    const list = tab === 'live' ? live : tab === 'results' ? results : upcoming;
    const empty = {
      live: { title: 'No hay partidos en juego', description: 'Cuando se juegue un partido aparece acá con el marcador en vivo.' },
      results: { title: 'Todavía no hay resultados', description: 'Los resultados aparecen apenas se cargan en el torneo.' },
      upcoming: { title: 'No hay partidos programados', description: 'La próxima fecha aparece cuando se arma.' },
    }[tab];
    // Mientras se juega, el resto de la fecha en curso debajo: qué terminó y qué falta.
    const rest = tab === 'live' && round ? round.fixtures.filter(f => !list.some(item => item.id === f.id)) : [];
    body = list.length ? (
      <>
        <List fixtures={list} clubOf={clubOf} prediction={prediction} />
        {rest.length > 0 && (
          <>
            <p className="eyebrow border-t border-line/10 px-4 pb-1 pt-4">Resto de la {round.title}</p>
            <List fixtures={rest} clubOf={clubOf} prediction={prediction} />
          </>
        )}
      </>
    ) : <div className="p-4"><EmptyState icon={CalendarDays} title={empty.title} description={empty.description} /></div>;
  }

  return (
    <div className="panel overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-line/10 px-4 pb-2 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs label="Partidos" value={tab} onChange={setChosen} tabs={tabs} />
        <Link to="/partidos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
          Todos los partidos <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {liveError && !error && <p className="px-4 pt-3 text-sm text-warning-soft">No se pudo conectar con los partidos en vivo; el fixture sí está actualizado.</p>}
      {body}
    </div>
  );
}

export default MatchCentre;
