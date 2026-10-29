import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, ScrollText, Shield, Trophy } from 'lucide-react';
import { Stat } from '../../components/ui/Stat.jsx';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { FollowLeague } from '../../components/landing/FollowLeague.jsx';
import { LEAGUE_NAME } from '../../components/landing/leagueLinks.js';
import { CrestRing, CrestStrip } from '../../components/league/CrestRing.jsx';
import { ClubGrid } from '../../components/league/ClubGrid.jsx';
import { StoryText } from '../../components/league/StoryText.jsx';
import { MatchCentre } from '../../components/league/home/MatchCentre.jsx';
import { StandingsCard } from '../../components/league/home/StandingsCard.jsx';
import { CupsCard } from '../../components/league/home/CupsCard.jsx';
import { FeaturedMatch, pickFeatured } from '../../components/league/home/FeaturedMatch.jsx';
import { makeClubLookup } from '../../components/league/match/FixtureRow.jsx';
import { FranchiseShowcase } from '../../components/league/home/FranchiseShowcase.jsx';
import { useClubProfiles, useFranchisePlayers, useLeagueContent, useLeagueTeams } from '../../hooks/useLeagueData.js';
import { FranchiseExplainer } from '../../components/league/home/FranchiseExplainer.jsx';
import { useLeagueFixtures } from '../../hooks/useLeagueFixtures.js';
import { currentRound } from '../../utils/leagueFixtures.js';
import { LEAGUE_HISTORY_DOC, SEASON_RULES_DOC, toParagraphs } from '../../utils/leagueContent.js';
import { CUP_DEFINITIONS } from '../../utils/bracketModel.js';
import { GOLD_CUP_PLACES } from '../../utils/competitionRules.js';
import { LEAGUE_ROUNDS } from '../../components/tournament/tournamentEngine.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

// Portada de la liga: qué es, en qué momento está y qué se juega, con datos reales del torneo y del juego.
// Con la temporada en juego: partidos y tabla → franquicias → clubes → la liga. En pretemporada no hay partidos
// ni tabla que mostrar, así que van primero los clubes y sus franquicias, y los partidos quedan al final.

const SECTION_CLASS = 'mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 md:py-16';

const SEE_ALL = 'inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-soft hover:text-ink';

function StageLine({ stage, liveCount }) {
  if (!stage) return null;
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-base" role="status">
      {liveCount > 0 && (
        <span className="inline-flex items-center gap-2 font-semibold text-danger-soft">
          <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
          {liveCount === 1 ? '1 partido en vivo' : `${liveCount} partidos en vivo`}
        </span>
      )}
      <span className="font-display text-lg font-bold uppercase leading-none text-ink">{stage.label}</span>
      {stage.detail && <span className="text-ink-2">{stage.detail}</span>}
    </p>
  );
}

function HeroActions({ isPreseason }) {
  const table = <Link to="/torneo" className={`btn ${isPreseason ? 'btn-ghost' : 'btn-primary'} btn-lg`}><Trophy className="h-4 w-4" aria-hidden="true" /> Tabla y copas</Link>;
  const clubs = <Link to="/equipos" className={`btn ${isPreseason ? 'btn-primary' : 'btn-ghost'} btn-lg`}><Shield className="h-4 w-4" aria-hidden="true" /> Los clubes</Link>;
  return <div className="mt-6 flex flex-wrap gap-3">{isPreseason ? <>{clubs}{table}</> : <>{table}{clubs}</>}</div>;
}

function Hero({ teams, stage, liveCount, featured, clubOf, prediction, isPreseason }) {
  return (
    <section aria-labelledby="hero-title" className="league-hero overflow-hidden border-b border-line/10">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pb-14">
        <div className="landing-enter">
          <p className="eyebrow mb-3">Liga de eFootball PES 2021</p>
          <h1 id="hero-title" className="font-display text-[2.6rem] font-bold uppercase leading-[0.92] tracking-tight text-ink [text-wrap:balance] sm:text-6xl">
            {LEAGUE_NAME}
          </h1>
          <StageLine stage={stage} liveCount={liveCount} />
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2 [text-wrap:pretty]">
            {teams.length > 0 && <><span className="num font-semibold text-ink">{teams.length}</span> clubes. </>}Resultados, tabla, copas y la historia de cada club, en un solo lugar.
          </p>
          <HeroActions isPreseason={isPreseason} />
        </div>
        <div className="landing-enter">
          {featured ? <FeaturedMatch featured={featured} clubOf={clubOf} prediction={prediction} /> : (
            <>
              <div className="md:hidden"><CrestStrip teams={teams} /></div>
              <div className="hidden md:block"><CrestRing teams={teams} /></div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * «La liga»: el comienzo de la historia, el reglamento y los números de la temporada, en una sola franja.
 * La historia y el enlace al reglamento aparecen solo cuando el admin los cargó: la portada no promete páginas vacías.
 */
function LeagueAbout({ teamsCount }) {
  const { content, loading } = useLeagueContent(LEAGUE_HISTORY_DOC);
  const { content: rules } = useLeagueContent(SEASON_RULES_DOC);
  const hasHistory = !loading && toParagraphs(content?.body).length > 0;
  const hasRules = (rules?.chapters || []).length > 0;
  const facts = [
    teamsCount > 0 && { value: teamsCount, label: 'Clubes' },
    { value: LEAGUE_ROUNDS, label: 'Fechas suizas' },
    { value: Object.keys(CUP_DEFINITIONS).length, label: 'Copas' },
  ].filter(Boolean);
  const factCols = facts.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <section aria-labelledby="la-liga" className={SECTION_CLASS}>
      <Reveal><SectionHeading id="la-liga" title="La liga" /></Reveal>
      <div className={`grid gap-4 ${hasHistory ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]' : 'max-w-3xl'}`}>
        {hasHistory && (
          <Reveal>
            <div className="panel flex h-full flex-col p-5 sm:p-7">
              <h3 className="flex items-center gap-2 font-display text-xl font-bold uppercase text-ink"><ScrollText className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Cómo empezó todo</h3>
              <div className="mt-4 flex-1"><StoryText body={content.body} limit={2} /></div>
              <Link to="/historia" className={`${SEE_ALL} mt-4 self-start`}>Leer la historia completa <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
          </Reveal>
        )}
        <Reveal>
          <div className="panel flex h-full flex-col p-5 sm:p-7">
            <div className={`grid items-end gap-4 ${factCols} ${hasHistory ? '' : 'max-w-xl'}`}>
              {facts.map(fact => <Stat key={fact.label} label={fact.label} value={fact.value} />)}
            </div>
            <p className="mt-5 max-w-[60ch] text-ink-2 [text-wrap:pretty]">
              Fase suiza de {LEAGUE_ROUNDS} fechas: cada fecha cruza a clubes de puntaje parecido y nadie repite rival. Del 1.° al {GOLD_CUP_PLACES}.° van a la Copa de Oro; el resto, a la Copa de Plata.
            </p>
            {hasRules && (
              <Link to="/reglamento" className="group mt-6 flex min-h-11 items-center gap-3 border-t border-line/10 pt-5">
                <BookOpen className="h-5 w-5 shrink-0 text-accent-soft" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink group-hover:text-accent-soft">Reglamento de la temporada</span>
                  <span className="block text-sm text-ink-2">Formato, puntos, desempates y cómo se arman las copas.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function LeagueHomeScreen() {
  useDocumentTitle(null);
  const { teams, teamsById, loading: teamsLoading, error: teamsError } = useLeagueTeams();
  const { tournament, fixtures, groups, stage, prediction, loading, error, liveError } = useLeagueFixtures(teamsById);
  const round = useMemo(() => currentRound(fixtures), [fixtures]);
  const clubOf = useMemo(() => makeClubLookup(teams), [teams]);
  const { byTeamId: profiles } = useClubProfiles();
  const { byTeamId: franchise, loading: franchiseLoading, error: franchiseError } = useFranchisePlayers();
  const featured = loading ? null : pickFeatured(groups);
  const isPreseason = !loading && !error && stage?.phase === 'preseason' && !groups.live.length;

  const matches = (
    <section id="partidos" aria-labelledby="partidos-title" className={SECTION_CLASS}>
      <SectionHeading id="partidos-title" title={isPreseason ? 'Partidos' : 'Partidos y tabla'} />
      {isPreseason ? (
        <div className="max-w-3xl">
          <MatchCentre groups={groups} round={round} clubOf={clubOf} loading={loading} error={error} liveError={liveError} prediction={prediction} />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <MatchCentre groups={groups} round={round} clubOf={clubOf} loading={loading} error={error} liveError={liveError} prediction={prediction} />
            <CupsCard tournament={tournament} clubOf={clubOf} />
          </div>
          <StandingsCard tournament={tournament} clubOf={clubOf} loading={loading} />
        </div>
      )}
    </section>
  );

  return (
    <>
      <Hero teams={teams} stage={loading ? null : stage} liveCount={groups.live.length} featured={featured} clubOf={clubOf} prediction={prediction} isPreseason={isPreseason} />

      {!isPreseason && matches}

      <section aria-labelledby="franquicias" className={SECTION_CLASS}>
        <Reveal>
          <FranchiseExplainer headingId="franquicias" />
        </Reveal>
        <Reveal>
          <h3 className="mb-4 mt-12 font-display text-xl font-bold uppercase tracking-wide text-ink">Los jugadores franquicia de esta temporada</h3>
          <FranchiseShowcase teams={teams} franchise={franchise} loading={franchiseLoading || teamsLoading} error={franchiseError} />
        </Reveal>
      </section>

      <section aria-labelledby="clubes" className={SECTION_CLASS}>
        <Reveal>
          <SectionHeading id="clubes" title="Los clubes" action={<Link to="/equipos" className={SEE_ALL}>Ver todos <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>}>
            Su estadio, su gente, sus títulos y su plantel.
          </SectionHeading>
        </Reveal>
        <Reveal>
          <ClubGrid teams={teams} loading={teamsLoading} error={teamsError} profiles={profiles} franchise={franchise} />
        </Reveal>
      </section>

      <LeagueAbout teamsCount={teams.length} />

      {isPreseason && matches}

      <section aria-labelledby="seguinos" className={SECTION_CLASS}>
        <Reveal>
          <SectionHeading id="seguinos" title="Seguí la liga">
            Partidos en vivo, videos y novedades de la {LEAGUE_NAME}.
          </SectionHeading>
        </Reveal>
        <Reveal delay={100}>
          <FollowLeague />
        </Reveal>
      </section>
    </>
  );
}
