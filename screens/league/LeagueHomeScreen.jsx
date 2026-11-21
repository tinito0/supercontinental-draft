import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Shield, Trophy, UserRoundCheck } from 'lucide-react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { LEAGUE_NAME } from '../../components/landing/leagueLinks.js';
import { CrestRing, CrestStrip } from '../../components/league/CrestRing.jsx';
import { MatchCentre } from '../../components/league/home/MatchCentre.jsx';
import { StandingsCard } from '../../components/league/home/StandingsCard.jsx';
import { CupsCard, hasCupTies } from '../../components/league/home/CupsCard.jsx';
import { FeaturedMatch, pickFeatured } from '../../components/league/home/FeaturedMatch.jsx';
import { ClubCrestGrid, FollowCompact, FranchiseSummary } from '../../components/league/home/HomeCompact.jsx';
import { makeClubLookup } from '../../components/league/match/FixtureRow.jsx';
import { useFranchisePlayers, useLeagueTeams } from '../../hooks/useLeagueData.js';
import { useLeagueFixtures } from '../../hooks/useLeagueFixtures.js';
import { useManagerRound } from '../../hooks/useManagerRound.js';
import { currentRound } from '../../utils/leagueFixtures.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

// Portada de la liga. Con la temporada en juego, lo que pasa ahora va arriba: el partido (se juega uno a la vez) con
// marcador, goles y números, y al lado la tabla, que en vivo se reordena con cada gol. Después el resto de los
// partidos y las copas, y tres franjas cortas: franquicias, clubes y canales. En pretemporada no hay partido ni tabla:
// arriba va la presentación con los escudos, después clubes y franquicias, y los partidos al final.

const SECTION_CLASS = 'mx-auto max-w-6xl scroll-mt-20 px-4 py-8 sm:px-6 md:py-12';

const SEE_ALL = 'inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-soft hover:text-ink';

function StageLine({ stage, liveCount, className = 'mt-6' }) {
  if (!stage) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-base ${className}`} role="status">
      {liveCount > 0 && (
        <span className="inline-flex items-center gap-2 font-semibold text-danger-soft">
          <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
          {liveCount === 1 ? 'Partido en vivo' : `${liveCount} partidos en vivo`}
        </span>
      )}
      <span className="font-display text-lg font-bold uppercase leading-none text-ink">{stage.label}</span>
      {stage.detail && <span className="text-ink-2">{stage.detail}</span>}
    </p>
  );
}

/** Pretemporada: qué es la liga y sus escudos, con el camino a los clubes. */
function PreseasonHero({ teams, stage }) {
  return (
    <section aria-labelledby="hero-title" className="league-hero overflow-hidden border-b border-line/10">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pb-14">
        <div className="landing-enter">
          <h1 id="hero-title" className="font-display text-[2.6rem] font-bold uppercase leading-[0.92] tracking-tight text-ink [text-wrap:balance] sm:text-6xl">
            {LEAGUE_NAME}
          </h1>
          <p className="mt-2 text-ink-2">Liga de eFootball PES 2021</p>
          <StageLine stage={stage} liveCount={0} />
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2 [text-wrap:pretty]">
            {teams.length > 0 && <><span className="num font-semibold text-ink">{teams.length}</span> clubes. </>}Resultados, tabla, copas y la historia de cada club, en un solo lugar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/equipos" className="btn btn-primary btn-lg"><Shield className="h-4 w-4" aria-hidden="true" /> Los clubes</Link>
            <Link to="/torneo" className="btn btn-ghost btn-lg"><Trophy className="h-4 w-4" aria-hidden="true" /> Tabla y copas</Link>
          </div>
        </div>
        <div className="landing-enter">
          <div className="md:hidden"><CrestStrip teams={teams} /></div>
          <div className="hidden md:block"><CrestRing teams={teams} /></div>
        </div>
      </div>
    </section>
  );
}

/** Votación abierta del manager de la fecha: una línea que lleva a /en-vivo, mientras dura (24 h). */
function ManagerVoteLink({ round }) {
  if (!round?.open) return null;
  const left = Number.isFinite(round.window.closesAtMs) ? Math.max(1, Math.ceil((round.window.closesAtMs - Date.now()) / 3_600_000)) : null;
  return (
    <Link to="/en-vivo" className="group mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-accent/40 bg-accent-deep/30 px-4 py-3 transition-colors hover:border-accent/70">
      <UserRoundCheck className="h-5 w-5 shrink-0 text-accent-soft" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">Votá al manager de la {round.title}</span>
        <span className="block text-sm text-ink-2">¿Quién manejó mejor su equipo en el PES?{left != null && ` Cierra en ${left} h.`}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden="true" />
    </Link>
  );
}

/** Temporada en juego: el nombre en una línea y, debajo, el partido de ahora junto a la tabla. */
function NowHero({ stage, liveCount, featured, liveMatch, clubOf, prediction, tournament, fixtures, loading, error, managerRound }) {
  return (
    <section aria-labelledby="hero-title" className="league-hero border-b border-line/10">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 md:pt-10 lg:pb-14">
        <div className="landing-enter flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 id="hero-title" className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink sm:text-5xl">{LEAGUE_NAME}</h1>
            <p className="mt-1.5 text-sm text-ink-2">Liga de eFootball PES 2021</p>
          </div>
          {/* El partido en vivo ya lo anuncia su tarjeta: acá solo la etapa. */}
          <StageLine stage={stage} liveCount={featured?.kind === 'live' ? 0 : liveCount} className="" />
        </div>
        <div className={`landing-enter mt-6 grid items-start gap-4 lg:gap-6 ${featured || loading ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]' : 'max-w-3xl'}`}>
          {(featured || loading) && (
            <div className="min-w-0">
              {featured
                ? <FeaturedMatch featured={featured} clubOf={clubOf} prediction={prediction} liveMatch={liveMatch} />
                : <div className="skeleton h-72 rounded-2xl" aria-busy="true" aria-label="Cargando el partido" />}
              {/* Under the match: it fills the column beside the taller table and sits next to what it is about. */}
              <ManagerVoteLink round={managerRound} />
            </div>
          )}
          <div className="min-w-0">
            <StandingsCard tournament={tournament} fixtures={fixtures} clubOf={clubOf} loading={loading} error={error} />
          </div>
        </div>
        {!(featured || loading) && <ManagerVoteLink round={managerRound} />}
      </div>
    </section>
  );
}

export default function LeagueHomeScreen() {
  useDocumentTitle(null);
  const { teams, teamsById, loading: teamsLoading } = useLeagueTeams();
  const { tournament, fixtures, groups, stage, prediction, liveMatches, loading, error, liveError } = useLeagueFixtures(teamsById);
  const round = useMemo(() => currentRound(fixtures), [fixtures]);
  const clubOf = useMemo(() => makeClubLookup(teams), [teams]);
  const { byTeamId: franchise, loading: franchiseLoading, error: franchiseError } = useFranchisePlayers();
  const featured = loading ? null : pickFeatured(groups);
  const { round: managerRound } = useManagerRound(tournament, liveMatches);
  const liveMatch = featured?.fixture.liveMatchKey ? (liveMatches || []).find(match => match.key === featured.fixture.liveMatchKey) || null : null;
  const isPreseason = !loading && !error && stage?.phase === 'preseason' && !groups.live.length;
  const showCups = !isPreseason && hasCupTies(tournament);

  const matches = (
    <section id="partidos" aria-labelledby="partidos-title" className={SECTION_CLASS}>
      <SectionHeading id="partidos-title" title="Partidos" />
      <div className={`grid items-start gap-6 ${showCups ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]' : ''}`}>
        <div className="min-w-0">
          <MatchCentre groups={groups} round={round} clubOf={clubOf} loading={loading} error={error} liveError={liveError} prediction={prediction} featuredId={isPreseason ? null : featured?.fixture.id} />
        </div>
        {showCups && <div className="min-w-0"><CupsCard tournament={tournament} clubOf={clubOf} /></div>}
      </div>
    </section>
  );

  const franchiseSection = (
    <section aria-labelledby="franquicias" className={SECTION_CLASS}>
      <Reveal>
        <FranchiseSummary teams={teams} franchise={franchise} loading={franchiseLoading || teamsLoading} error={franchiseError} headingId="franquicias" />
      </Reveal>
    </section>
  );

  const clubsSection = (
    <section aria-labelledby="clubes" className={SECTION_CLASS}>
      <Reveal>
        <SectionHeading id="clubes" title="Los clubes" action={<Link to="/equipos" className={SEE_ALL}>Ver todos <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>} />
      </Reveal>
      <Reveal>
        <ClubCrestGrid teams={teams} loading={teamsLoading} />
      </Reveal>
    </section>
  );

  return (
    <>
      {isPreseason
        ? <PreseasonHero teams={teams} stage={stage} />
        : (
          <NowHero
            stage={loading ? null : stage} liveCount={groups.live.length} featured={featured} liveMatch={liveMatch}
            clubOf={clubOf} prediction={prediction} tournament={tournament} fixtures={fixtures} loading={loading} error={error}
            managerRound={managerRound}
          />
        )}

      {!isPreseason && matches}
      {isPreseason ? <>{clubsSection}{franchiseSection}</> : <>{franchiseSection}{clubsSection}</>}
      {isPreseason && matches}

      <section aria-labelledby="seguinos" className={SECTION_CLASS}>
        <Reveal>
          <SectionHeading id="seguinos" title="Seguí la liga" />
        </Reveal>
        <Reveal>
          <FollowCompact />
        </Reveal>
      </section>
    </>
  );
}
