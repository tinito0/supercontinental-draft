import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, Radio, Trophy, Vote } from 'lucide-react';
import { Tabs, tabPanelProps } from '../../ui/Tabs.jsx';
import { Alert } from '../../ui/Alert.jsx';
import { FixtureRow } from '../match/FixtureRow.jsx';

/* Centro de partidos de la portada: en vivo, últimos resultados y próximos, con datos reales del torneo y del juego
   (hooks/useLeagueFixtures.js). Arranca en lo más relevante: lo que se juega ahora; si no hay nada, los resultados;
   si la temporada no empezó, los próximos. */

const PREVIEW_ROWS = 6;
const TAB_PARAM = 'partidos';

function VoteLink({ children }) {
  return (
    <Link to="/en-vivo" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-soft hover:text-ink">
      <Vote className="h-4 w-4" aria-hidden="true" /> {children}
    </Link>
  );
}

function actionFor(fixture, prediction) {
  // La predicción abre cuando el admin pone el partido al aire y cierra cuando arranca (community-vote).
  if (fixture.status === 'scheduled' && fixture.isOnAir && prediction && !prediction.closedAt) return <VoteLink>¿Quién gana? Votá tu predicción</VoteLink>;
  return null;
}

function List({ fixtures, clubOf, prediction, quietLive = false }) {
  // One pulsing live dot per screen (DS): only the first live row of the list pulses, unless something above already does.
  const firstLive = quietLive ? -1 : fixtures.slice(0, PREVIEW_ROWS).findIndex(fixture => fixture.status === 'live');
  return (
    // Two columns on wide screens: a single column left two thirds of the row empty.
    <ul className="divide-y divide-line/10 lg:grid lg:grid-cols-2 lg:divide-y-0 lg:[&>li:nth-child(odd)]:border-r lg:[&>li:nth-child(n+3)]:border-t lg:[&>li]:border-line/10">
      {fixtures.slice(0, PREVIEW_ROWS).map((fixture, index) => (
        <FixtureRow key={fixture.id} fixture={fixture} clubOf={clubOf} action={actionFor(fixture, prediction)} quietLive={index !== firstLive} />
      ))}
    </ul>
  );
}

/**
 * @param {{ groups: { live, results, upcoming, other }, clubOf: Function, loading: boolean, error: string,
 *   liveError?: string, prediction?: object|null, round?: { title, fixtures }, featuredId?: string|null }} props
 *   round: utils/leagueFixtures.currentRound; featuredId: el partido que la portada ya muestra arriba, que no se repite
 */
export function MatchCentre({ groups, round, clubOf, loading, error, liveError, prediction, featuredId = null }) {
  const notFeatured = f => f.id !== featuredId;
  const live = [...groups.live, ...groups.other.filter(f => f.status === 'nosignal')].filter(notFeatured);
  const upcoming = [...groups.upcoming, ...groups.other.filter(f => f.status === 'postponed')].filter(notFeatured);
  const results = [...groups.results, ...groups.other.filter(f => f.status === 'abandoned')];
  // Con el partido en juego arriba, lo que sigue interesando es qué falta de la fecha.
  const featuredIsLive = groups.live.some(f => f.id === featuredId);
  const preferred = live.length ? 'live' : featuredIsLive && upcoming.length ? 'upcoming' : results.length ? 'results' : 'upcoming';
  // La pestaña elegida queda en la URL (?partidos=), con replace para no llenar el historial.
  const [params, setParams] = useSearchParams();
  const requested = params.get(TAB_PARAM);
  // A tab from the URL counts only while it is shown: «En vivo» or «Resultados» can empty out after the link was made.
  const shown = { live: live.length > 0, results: results.length > 0, upcoming: true };
  const tab = Object.hasOwn(shown, requested ?? '') && shown[requested] ? requested : preferred;
  const setChosen = next => setParams(current => {
    const updated = new URLSearchParams(current);
    updated.set(TAB_PARAM, next);
    return updated;
  }, { replace: true });

  const tabs = [
    { id: 'live', label: 'En vivo', icon: Radio, count: live.length || null, hidden: !live.length },
    { id: 'results', label: 'Resultados', icon: Trophy, hidden: !results.length },
    { id: 'upcoming', label: 'Próximos', icon: CalendarDays, count: upcoming.length || null },
  ];
  // Sin ningún partido cargado (pretemporada) no hay nada que elegir: una línea en lugar de pestañas vacías.
  const isEmpty = !error && !loading && !featuredId && !live.length && !results.length && !upcoming.length;

  let body;
  if (error) body = <div className="p-4"><Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert></div>;
  else if (isEmpty) {
    body = (
      <p className="flex items-start gap-3 px-4 py-5 sm:px-5">
        <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-accent-soft" aria-hidden="true" />
        <span>
          <span className="block font-semibold text-ink">La temporada arranca cuando se cargue la fecha 1.</span>
          <span className="block text-ink-2">Ahí aparecen los cruces, los horarios y los partidos en vivo.</span>
        </span>
      </p>
    );
  }
  else if (loading) {
    body = (
      <div className="divide-y divide-line/10" role="status" aria-busy="true">
        <span className="sr-only">Cargando partidos</span>
        {[0, 1, 2].map(i => <div key={i} className="mx-4 my-3 h-14 skeleton" />)}
      </div>
    );
  } else {
    const list = tab === 'live' ? live : tab === 'results' ? results : upcoming;
    // The featured card above may be the only upcoming match: say so instead of "none scheduled".
    const featuredIsUpcoming = groups.upcoming.some(f => f.id === featuredId);
    const empty = {
      live: { title: 'No hay partidos en juego', description: 'Cuando se juegue un partido aparece acá con el marcador en vivo.' },
      results: { title: 'Todavía no hay resultados', description: 'Los resultados aparecen apenas se cargan en el torneo.' },
      upcoming: featuredIsUpcoming
        ? { title: 'No hay otros partidos próximos', description: 'El que aparece arriba es el único programado por ahora.' }
        : { title: 'No hay partidos programados', description: 'La próxima fecha aparece cuando se arma.' },
    }[tab];
    // Mientras se juega, el resto de la fecha en curso debajo: qué terminó y qué falta.
    const rest = tab === 'live' && round ? round.fixtures.filter(f => !list.some(item => item.id === f.id)) : [];
    body = list.length ? (
      <>
        <List fixtures={list} clubOf={clubOf} prediction={prediction} quietLive={featuredIsLive} />
        {rest.length > 0 && (
          <>
            <p className="eyebrow border-t border-line/10 px-4 pb-1 pt-4">Resto de la {round.title}</p>
            <List fixtures={rest} clubOf={clubOf} prediction={prediction} quietLive />
          </>
        )}
      </>
    ) : (
      <div className="px-4 py-10 text-center">
        <p className="font-display text-lg font-bold text-ink">{empty.title}</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-2">{empty.description}</p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden p-0">
      {!isEmpty && (
        <div className="flex flex-col gap-3 border-b border-line/10 px-4 pb-2 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs label="Partidos" value={tab} onChange={setChosen} tabs={tabs} idPrefix="match-centre" />
          <Link to="/partidos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
            Todos los partidos <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
      {liveError && !error && <p className="px-4 pt-3 text-sm text-warning-soft">No se pudo conectar con los partidos en vivo; el calendario sí está actualizado.</p>}
      {isEmpty ? body : <div {...tabPanelProps('match-centre', tab)}>{body}</div>}
    </div>
  );
}

export default MatchCentre;
