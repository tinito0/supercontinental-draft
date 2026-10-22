import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, SearchX } from 'lucide-react';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { MatchHeader, MatchTimeline } from '../../components/league/match/MatchSummaryView.jsx';
import { MatchLineups, MatchStats, PlayerStatsTable } from '../../components/league/match/MatchDetailViews.jsx';
import { useLeagueTeams, useLiveMatch } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { buildLineups, buildTimeline, playerStatRows, teamStatRows } from '../../utils/matchCenter.js';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'alineaciones', label: 'Alineaciones' },
  { id: 'jugadores', label: 'Jugadores' },
];

/** Un partido estilo SofaScore: marcador, minuto a minuto, estadísticas, alineaciones y jugadores, en vivo. */
export default function LeagueMatchScreen() {
  const { matchKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'resumen';
  const { match, loading, error } = useLiveMatch(matchKey);
  const { teamsById } = useLeagueTeams();
  useDocumentTitle(match ? `${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}` : 'Partido');

  const views = useMemo(() => (match ? {
    timeline: buildTimeline(match.summary),
    stats: teamStatRows(match.summary),
    lineups: buildLineups(match.summary),
    players: playerStatRows(match.summary),
  } : null), [match]);

  let content;
  if (error) {
    content = <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  } else if (loading) {
    content = <div className="panel h-56 skeleton" aria-busy="true" />;
  } else if (!match) {
    content = <EmptyState icon={SearchX} title="No encontramos este partido" description="Puede que el enlace esté mal. Volvé a la lista de partidos." />;
  } else {
    content = (
      <div className="space-y-5">
        <MatchHeader match={match} timeline={views.timeline} teamsById={teamsById} />
        <Tabs
          label="Secciones del partido"
          value={tab}
          onChange={id => setSearchParams(id === 'resumen' ? {} : { tab: id }, { replace: true })}
          tabs={TABS}
        />
        {tab === 'resumen' && <MatchTimeline timeline={views.timeline} match={match} />}
        {tab === 'estadisticas' && <MatchStats rows={views.stats} match={match} />}
        {tab === 'alineaciones' && <MatchLineups lineups={views.lineups} match={match} />}
        {tab === 'jugadores' && <PlayerStatsTable rows={views.players} match={match} />}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Link to="/partidos" className="btn btn-ghost btn-sm min-h-11 -ml-2 mb-4">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Partidos
      </Link>
      {content}
    </section>
  );
}
