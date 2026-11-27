import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, BarChartHorizontal, BookOpen, Shield, Trophy, Users } from 'lucide-react';
import { ClubSeasonStats } from '../../components/league/season/ClubSeasonStats.jsx';
import { ClubStatsTab } from '../../components/league/season/ClubStatsTab.jsx';
import TeamScreen from '../TeamScreen.jsx';
import { Tabs, tabPanelProps } from '../../components/ui/Tabs.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ShareClubButton } from '../../components/league/club/ShareClubButton.jsx';
import { ClubStory } from '../../components/league/club/ClubStory.jsx';
import { ClubHero } from '../../components/league/club/ClubHero.jsx';
import { ClubFacts } from '../../components/league/club/ClubFacts.jsx';
import { ClubHonours } from '../../components/league/club/ClubHonours.jsx';
import { ClubSeasonCard, clubStanding } from '../../components/league/club/ClubSeasonCard.jsx';
import { ClubFranchise } from '../../components/league/club/ClubFranchise.jsx';
import { ClubKits } from '../../components/league/club/ClubKits.jsx';
import { useFranchisePlayers, useLeagueContent, useLeagueTeams, useTournament } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { clubChapters, clubStoryDocId, hasClubProfile } from '../../utils/leagueContent.js';

/* Un club en la web de la liga: cabecera con su estadio y sus socios, la ficha (estadio, DT, presidente, mánager) y
   cinco pestañas: el club (historia), temporada (resultados y goleadores con datos del juego), estadísticas (números
   del equipo y sus mejores jugadores), palmarés (títulos y campañas anteriores) y plantel (el plantel y la campaña del
   draft). La pestaña vive en la URL (?tab=), así se puede compartir. */

const TABS = [
  { id: 'club', label: 'El club', icon: BookOpen },
  { id: 'temporada', label: 'Temporada', icon: BarChart3 },
  { id: 'estadisticas', label: 'Estadísticas', icon: BarChartHorizontal },
  { id: 'palmares', label: 'Palmarés', icon: Trophy },
  { id: 'plantel', label: 'Plantel', icon: Users },
];

export default function LeagueClubScreen() {
  const { userId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(item => item.id === params.get('tab')) ? params.get('tab') : 'club';
  const { content, loading, error } = useLeagueContent(userId ? clubStoryDocId(userId) : null);
  const { teamsById, loading: teamsLoading, error: teamsError } = useLeagueTeams();
  const { tournament, loading: tournamentLoading, error: tournamentError } = useTournament();
  const { byTeamId: franchiseByTeam, loading: franchiseLoading, error: franchiseError } = useFranchisePlayers();
  const team = teamsById?.[userId] || null;
  const profile = content?.profile || null;
  const chapters = useMemo(() => clubChapters(content), [content]);
  const standing = useMemo(() => clubStanding(tournament, team?.teamName), [tournament, team?.teamName]);
  useDocumentTitle(team?.teamName || 'Equipos');

  const setTab = next => setParams(next === 'club' ? {} : { tab: next });

  if (teamsError && !team) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="sr-only">No se pudo cargar el club</h1>
        <Alert
          tone="danger"
          title="No pudimos cargar este club"
          action={<Button variant="secondary" onClick={() => window.location.reload()}>Reintentar</Button>}
        >
          Falló la lectura de los equipos, así que no sabemos si el club existe. Revisá tu conexión y probá de nuevo.
        </Alert>
        <Link to="/equipos" className="btn btn-secondary btn-lg mt-5">Volver a los clubes</Link>
      </section>
    );
  }

  if (!teamsLoading && !team) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="sr-only">Club no encontrado</h1>
        <EmptyState icon={Shield} title="Este club no existe" description="Puede que el link esté mal o que el club ya no juegue en la liga.">
          <Link to="/equipos" className="btn btn-primary btn-lg mt-5">Ver los clubes</Link>
        </EmptyState>
      </section>
    );
  }

  return (
    <article>
      <ClubHero
        team={team}
        profile={profile}
        loading={teamsLoading || loading}
        action={team && <ShareClubButton teamId={userId} teamName={team.teamName} />}
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {hasClubProfile(profile) && <ClubFacts profile={profile} />}
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Secciones del club" idPrefix="club-tabs" nav />

        {tab === 'club' && (
          <div {...tabPanelProps('club-tabs', 'club')} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-labelledby="club-history" className="space-y-4">
              <h2 id="club-history" className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">Historia del club</h2>
              <ClubStory
                chapters={chapters}
                loading={loading}
                error={error}
                emptyTitle="La historia de este club todavía no se cargó"
                emptyDescription="Mientras tanto, mirá su palmarés y su plantel en las otras pestañas."
              />
            </section>
            <div className="space-y-4">
              <ClubKits profile={profile} teamName={team?.teamName} />
              <ClubFranchise player={franchiseByTeam[userId] || null} loading={franchiseLoading} error={franchiseError} />
              {tournamentLoading ? <div className="skeleton h-40 rounded-2xl" aria-hidden="true" />
                : tournamentError ? <Alert tone="danger" title="No se pudo cargar la temporada del club.">Recargá la página para intentar de nuevo.</Alert>
                : <ClubSeasonCard standing={standing} />}
            </div>
          </div>
        )}
        {tab === 'temporada' && (
          <div {...tabPanelProps('club-tabs', 'temporada')}>
            <ClubSeasonStats clubId={userId} teamsById={teamsById} />
          </div>
        )}
        {tab === 'estadisticas' && (
          <div {...tabPanelProps('club-tabs', 'estadisticas')}>
            <ClubStatsTab clubId={userId} />
          </div>
        )}
        {tab === 'palmares' && (
          <div {...tabPanelProps('club-tabs', 'palmares')}>
            <ClubHonours profile={profile} currentSeason={<ClubSeasonCard standing={standing} title="Temporada en curso" />} />
          </div>
        )}
        {tab === 'plantel' && (
          <div {...tabPanelProps('club-tabs', 'plantel')} className="-mx-4 sm:-mx-6">
            <TeamScreen isLeagueSite hideHeader embedded />
          </div>
        )}
      </div>
    </article>
  );
}
