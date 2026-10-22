import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Trophy } from 'lucide-react';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useLeagueTeams, useTournament } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchRawPlayers } from '../../utils/playerCatalog.js';
import { processPlayersData } from '../../utils/helpers.js';

const TournamentModal = lazy(() => import('../../components/TournamentModal.jsx'));

const loading = (
  <div role="status" className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-3">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando torneo…
  </div>
);

const noop = () => {};

/** The player catalog, only to show scorers' photos; the page works without it. */
function usePlayerCatalog() {
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    let isMounted = true;
    fetchRawPlayers()
      .then(raw => { if (isMounted) setPlayers(processPlayersData(raw)); })
      .catch(err => console.warn('[LeagueTournamentScreen] sin catálogo de jugadores:', err));
    return () => { isMounted = false; };
  }, []);
  return players;
}

/** Standings, cup brackets and scorers: the draft's tournament view, read-only. */
export default function LeagueTournamentScreen() {
  useDocumentTitle('Torneo');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tournament, loading: isTournamentLoading, error } = useTournament();
  const { teamsById } = useLeagueTeams();
  const players = usePlayerCatalog();

  let content;
  if (error) {
    content = <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  } else if (isTournamentLoading) {
    content = loading;
  } else if (!tournament) {
    content = <EmptyState icon={Trophy} title="El torneo todavía no empezó" description="Acá vas a ver la tabla, los cuadros y los goleadores apenas arranque." />;
  } else {
    content = (
      <Suspense fallback={loading}>
        <TournamentModal
          isVisible
          isPage
          onClose={() => navigate('/')}
          tournamentData={tournament}
          isAdmin={false}
          onUpdateTournament={noop}
          allTeams={teamsById}
          allPlayers={players}
          initialTab={searchParams.get('tab') || 'groups'}
        />
      </Suspense>
    );
  }

  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-12">{content}</div>;
}
