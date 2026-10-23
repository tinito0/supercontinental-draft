import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, ListOrdered, Medal, Trophy } from 'lucide-react';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { makeClubLookup } from '../../components/league/match/FixtureRow.jsx';
import { StandingsTable } from '../../components/league/tournament/StandingsTable.jsx';
import { CupBracketView } from '../../components/tournament/CupBracketView.jsx';
import { StatsView } from '../../components/tournament/StatsView.jsx';
import { useLeagueTeams, useTournament } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchRawPlayers } from '../../utils/playerCatalog.js';
import { processPlayersData } from '../../utils/helpers.js';
import { CUP_IDS } from '../../utils/bracketModel.js';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { leagueStage } from '../../utils/leagueFixtures.js';

/* /torneo: la competición para el público. Tabla, las dos copas y los goleadores, con la pestaña en la URL (?tab=).
   Ya no reusa el gestor del admin (TournamentModal): solo las vistas de solo lectura. El fixture vive en /partidos. */

const TABS = [
  { id: 'tabla', label: 'Tabla', icon: ListOrdered },
  { id: 'oro', label: 'Copa de Oro', icon: Trophy },
  { id: 'plata', label: 'Copa de Plata', icon: Medal },
  { id: 'goleadores', label: 'Goleadores', icon: Medal },
];
// Enlaces viejos (?tab=groups|bracket|repechaje|stats, los de TournamentModal) siguen abriendo la pestaña correcta.
const LEGACY_TABS = { groups: 'tabla', matches: 'tabla', bracket: 'oro', repechaje: 'plata', stats: 'goleadores' };
const noop = () => {};

/** El catálogo de jugadores, solo para las fotos de los goleadores; la página funciona sin él. */
function usePlayerCatalog(isNeeded) {
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    if (!isNeeded || players.length) return undefined;
    let isMounted = true;
    fetchRawPlayers()
      .then(raw => { if (isMounted) setPlayers(processPlayersData(raw)); })
      .catch(err => console.warn('[LeagueTournamentScreen] sin catálogo de jugadores:', err));
    return () => { isMounted = false; };
  }, [isNeeded, players.length]);
  return players;
}

function TableSkeleton() {
  return <div className="space-y-2 rounded-2xl border border-line/10 bg-surface p-4" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-11" />)}</div>;
}

export default function LeagueTournamentScreen() {
  useDocumentTitle('Torneo');
  const [params, setParams] = useSearchParams();
  const requested = LEGACY_TABS[params.get('tab')] || params.get('tab');
  const tab = TABS.some(item => item.id === requested) ? requested : 'tabla';
  const { tournament, loading, error } = useTournament();
  const { teams, teamsById } = useLeagueTeams();
  const players = usePlayerCatalog(tab === 'goleadores');
  const clubOf = useMemo(() => makeClubLookup(teams), [teams]);
  const rows = useMemo(() => (tournament?.league || []).filter(row => row?.name && row.name !== 'Club...'), [tournament]);
  const stage = useMemo(() => (tournament ? leagueStage(tournament) : null), [tournament]);

  const getTeamLogo = useCallback(name => clubOf(name)?.logoUrl || DEFAULT_LOGO, [clubOf]);
  const getPlayerPhoto = useCallback(name => {
    const key = String(name || '').trim().toLowerCase();
    const found = key && players.find(p => String(p.Name || p.name || '').trim().toLowerCase() === key);
    return found ? `/fotos_jugadores/${found.Id || found.id}.webp` : null;
  }, [players]);

  const setTab = next => setParams(next === 'tabla' ? {} : { tab: next }, { replace: true });

  let content;
  if (error) content = <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  else if (loading) content = <TableSkeleton />;
  else if (!tournament) content = <EmptyState icon={Trophy} title="El torneo todavía no empezó" description="Acá vas a ver la tabla, las copas y los goleadores apenas arranque." />;
  else if (tab === 'tabla') {
    content = rows.length
      ? <StandingsTable rows={rows} clubOf={clubOf} />
      : <EmptyState icon={ListOrdered} title="La tabla todavía está vacía" description="Se completa sola con cada resultado cargado." />;
  } else if (tab === 'oro' || tab === 'plata') {
    content = (
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <CupBracketView cupId={tab === 'oro' ? CUP_IDS.ORO : CUP_IDS.PLATA} localData={tournament} isEditing={false} getTeamLogo={getTeamLogo} updateGeneric={noop} showTitle={false} />
      </div>
    );
  } else {
    content = <StatsView localData={tournament} isEditing={false} isObsMode={false} getTeamLogo={getTeamLogo} getPlayerPhoto={getPlayerPhoto} updateStat={noop} showTitle={false} />;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Torneo">
          {stage?.label ? `${[stage.label, stage.detail].filter(Boolean).join(' · ')}. ` : ''}La tabla oficial, las copas y los goleadores, actualizados con cada resultado.
        </SectionHeading>
      </Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Secciones del torneo" />
        <Link to="/partidos" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-soft hover:text-ink">
          <CalendarDays className="h-4 w-4" aria-hidden="true" /> Fixture y resultados <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div role="tabpanel" aria-label={TABS.find(item => item.id === tab)?.label}>{content}</div>
    </section>
  );
}
