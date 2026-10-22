import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, BookOpen } from 'lucide-react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { FollowLeague } from '../../components/landing/FollowLeague.jsx';
import { LEAGUE_NAME } from '../../components/landing/leagueLinks.js';
import { CrestRing } from '../../components/league/CrestRing.jsx';
import { ClubGrid } from '../../components/league/ClubGrid.jsx';
import { StoryText } from '../../components/league/StoryText.jsx';
import { MatchCentre } from '../../components/league/home/MatchCentre.jsx';
import { StandingsCard } from '../../components/league/home/StandingsCard.jsx';
import { CupsCard } from '../../components/league/home/CupsCard.jsx';
import { makeClubLookup } from '../../components/league/match/FixtureRow.jsx';
import { useLeagueContent, useLeagueTeams } from '../../hooks/useLeagueData.js';
import { useLeagueFixtures } from '../../hooks/useLeagueFixtures.js';
import { currentRound } from '../../utils/leagueFixtures.js';
import { LEAGUE_HISTORY_DOC, toParagraphs } from '../../utils/leagueContent.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

// Portada de la liga: qué es, en qué momento está y qué se juega, con datos reales del torneo y del juego.
// Orden: lo que pasa ahora (partidos) → cómo está la competencia (tabla y copas) → los clubes → la historia.

const SECTION_CLASS = 'mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 md:py-16';

function Hero({ teams, stage, liveCount }) {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-6 pt-10 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:pb-10 md:pt-14">
        <div className="landing-enter">
          <p className="eyebrow mb-4 text-accent-soft">Liga de eFootball PES 2021</p>
          <h1 id="hero-title" className="font-display text-[2.6rem] font-bold uppercase leading-[0.92] tracking-tight text-ink [text-wrap:balance] sm:text-6xl lg:text-7xl">
            {LEAGUE_NAME}
          </h1>
          {stage && (
            <div className="league-stage mt-6" role="status">
              {liveCount > 0 && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-danger-soft">
                  <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
                  {liveCount === 1 ? 'Partido en vivo' : `${liveCount} en vivo`}
                </span>
              )}
              <span className="whitespace-nowrap font-display text-lg font-bold uppercase leading-none text-ink">{stage.label}</span>
              <span className="text-sm text-ink-2">{stage.detail}</span>
            </div>
          )}
          <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-ink-2 sm:text-lg">
            {teams.length > 0 && <><span className="num font-semibold text-ink">{teams.length}</span> clubes. </>}Resultados, tabla, copas y la historia de cada club, en un solo lugar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#partidos" className="btn btn-primary btn-lg">
              Partidos <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link to="/torneo" className="btn btn-secondary btn-lg">Tabla y copas</Link>
          </div>
        </div>
        <div className="hidden md:block">
          <CrestRing teams={teams} />
        </div>
      </div>
    </section>
  );
}

/** The first paragraphs of the league's history, when it has been written. */
function HistoryTeaser() {
  const { content, loading, error } = useLeagueContent(LEAGUE_HISTORY_DOC);
  if (loading || error || toParagraphs(content?.body).length === 0) return null;

  return (
    <section aria-labelledby="historia" className={SECTION_CLASS}>
      <Reveal>
        <SectionHeading id="historia" title="Cómo empezó todo" />
      </Reveal>
      <Reveal delay={100}>
        <StoryText body={content.body} limit={2} />
        <Link to="/historia" className="btn btn-secondary btn-lg mt-8">
          Leer la historia <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}

export default function LeagueHomeScreen() {
  useDocumentTitle(null);
  const { teams, teamsById, loading: teamsLoading, error: teamsError } = useLeagueTeams();
  const { tournament, fixtures, groups, stage, prediction, loading, error, liveError } = useLeagueFixtures(teamsById);
  const round = useMemo(() => currentRound(fixtures), [fixtures]);
  const clubOf = useMemo(() => makeClubLookup(teams), [teams]);

  return (
    <>
      <Hero teams={teams} stage={loading ? null : stage} liveCount={groups.live.length} />

      <section id="partidos" aria-labelledby="partidos-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-12 sm:px-6 md:pb-16">
        <h2 id="partidos-title" className="sr-only">Partidos</h2>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <MatchCentre groups={groups} round={round} clubOf={clubOf} loading={loading} error={error} liveError={liveError} prediction={prediction} />
            <CupsCard tournament={tournament} clubOf={clubOf} />
          </div>
          <StandingsCard tournament={tournament} clubOf={clubOf} loading={loading} />
        </div>
      </section>

      <section aria-labelledby="clubes" className={SECTION_CLASS}>
        <Reveal>
          <SectionHeading id="clubes" title="Los clubes">
            Cada club de la liga: su historia, su plantel y su campaña en el torneo.
          </SectionHeading>
        </Reveal>
        <Reveal delay={100}>
          <ClubGrid teams={teams} loading={teamsLoading} error={teamsError} />
        </Reveal>
      </section>

      <HistoryTeaser />

      <section aria-labelledby="reglamento-link" className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link to="/reglamento" className="group flex items-center gap-4 border-y border-line/10 py-5 transition-colors hover:border-line/30">
          <BookOpen className="h-5 w-5 shrink-0 text-accent-soft" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span id="reglamento-link" className="block font-display text-xl font-bold uppercase text-ink">Reglamento de la temporada</span>
            <span className="block text-sm text-ink-2">Formato, puntos, desempates y cómo se arman las copas.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-3 transition-colors group-hover:text-ink" aria-hidden="true" />
        </Link>
      </section>

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
