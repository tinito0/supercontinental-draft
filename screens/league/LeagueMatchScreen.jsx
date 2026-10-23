import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, SearchX } from 'lucide-react';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { MatchHeader, MatchTimeline } from '../../components/league/match/MatchSummaryView.jsx';
import { MatchLineups, PlayerStatsTable } from '../../components/league/match/MatchDetailViews.jsx';
import { StatSections, TopStats } from '../../components/league/match/MatchStatSections.jsx';
import { MomentumChart } from '../../components/league/match/MomentumChart.jsx';
import { ShotsPanel } from '../../components/league/match/ShotsPanel.jsx';
import { LineupPitch } from '../../components/league/match/LineupPitch.jsx';
import { PlayerAnalysis } from '../../components/league/match/PlayerAnalysis.jsx';
import { MatchTacticsView } from '../../components/league/match/MatchTacticsView.jsx';
import { MatchAnalysisView } from '../../components/league/match/MatchAnalysisView.jsx';
import { MatchCoaches } from '../../components/league/match/MatchCoaches.jsx';
import { useClubProfiles, useLeagueTeams, useLiveMatch } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { buildLineups, buildTimeline, playerStatRows } from '../../utils/matchCenter.js';
import { shotRows, statSections } from '../../utils/matchStats.js';
import { momentum, pitchLayout } from '../../utils/matchAnalysis.js';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'alineaciones', label: 'Alineaciones' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'tactica', label: 'Táctica' },
  { id: 'analisis', label: 'Análisis' },
];

function Card({ title, children }) {
  return (
    <section className="panel p-4 sm:p-5" aria-label={title}>
      <h3 className="section-title mb-3 text-center">{title}</h3>
      {children}
    </section>
  );
}

function SummaryTab({ match, views }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">
        <Card title="Dominio"><MomentumChart data={views.momentum} match={match} compact /></Card>
        <Card title="Tiros"><ShotsPanel shots={views.shots} match={match} /></Card>
      </div>
      <div className="space-y-4">
        <TopStats sections={views.sections} match={match} />
        <MatchTimeline timeline={views.timeline} match={match} />
      </div>
    </div>
  );
}

/** Un partido estilo SofaScore: marcador, resumen, estadísticas, alineaciones, jugadores, táctica y análisis, en vivo. */
export default function LeagueMatchScreen() {
  const { matchKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'resumen';
  const { match, loading, error } = useLiveMatch(matchKey);
  const { teamsById } = useLeagueTeams();
  const { byTeamId: clubProfiles } = useClubProfiles();
  useDocumentTitle(match ? `${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}` : 'Partido');

  const views = useMemo(() => (match ? {
    timeline: buildTimeline(match.summary),
    sections: statSections(match.summary),
    shots: shotRows(match.summary),
    momentum: momentum(match.summary),
    lineups: buildLineups(match.summary),
    pitch: pitchLayout(match.summary),
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
    const summary = match.summary || {};
    content = (
      <div className="space-y-5">
        <MatchHeader match={match} timeline={views.timeline} teamsById={teamsById} />
        <Tabs
          label="Secciones del partido"
          value={tab}
          onChange={id => setSearchParams(id === 'resumen' ? {} : { tab: id }, { replace: true })}
          tabs={TABS}
        />
        {tab === 'resumen' && <SummaryTab match={match} views={views} />}
        {tab === 'estadisticas' && (
          <div className="space-y-8">
            <StatSections sections={views.sections} match={match} />
            {views.players.length > 0 && (
              <section aria-labelledby="per-player" className="space-y-3">
                <h2 id="per-player" className="font-display text-2xl font-bold uppercase leading-none text-ink">Por jugador</h2>
                <PlayerStatsTable rows={views.players} match={match} />
              </section>
            )}
          </div>
        )}
        {tab === 'alineaciones' && (
          <div className="space-y-4">
            <LineupPitch layout={views.pitch} match={match} />
            <MatchCoaches match={match} teamsById={teamsById} profiles={clubProfiles} />
            <MatchLineups lineups={views.lineups} match={match} />
          </div>
        )}
        {tab === 'jugadores' && (
          <div className="space-y-4">
            <PlayerAnalysis rows={views.players} summary={summary} match={match} />
          </div>
        )}
        {tab === 'tactica' && <MatchTacticsView summary={summary} match={match} />}
        {tab === 'analisis' && <MatchAnalysisView summary={summary} match={match} />}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <Link to="/partidos" className="btn btn-ghost btn-sm min-h-11 -ml-2 mb-4">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Partidos
      </Link>
      {content}
    </section>
  );
}
