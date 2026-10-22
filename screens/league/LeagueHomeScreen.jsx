import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trophy, BookOpen } from 'lucide-react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { FollowLeague } from '../../components/landing/FollowLeague.jsx';
import { LEAGUE_NAME } from '../../components/landing/leagueLinks.js';
import { CrestRing } from '../../components/league/CrestRing.jsx';
import { ClubGrid } from '../../components/league/ClubGrid.jsx';
import { StoryText } from '../../components/league/StoryText.jsx';
import { useLeagueContent, useLeagueTeams } from '../../hooks/useLeagueData.js';
import { LEAGUE_HISTORY_DOC, toParagraphs } from '../../utils/leagueContent.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const SECTION_CLASS = 'mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-24';

function Hero({ teams }) {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:min-h-[calc(100dvh-4rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:py-16">
        <div className="landing-enter">
          <p className="eyebrow mb-4 text-accent-soft">Liga de eFootball PES 2021</p>
          <h1 id="hero-title" className="font-display text-[2.6rem] font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {LEAGUE_NAME}
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2">
            La historia de la liga y de sus clubes, el reglamento de la temporada y el torneo, en un solo lugar.
          </p>
          {teams.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow">Clubes</p>
              <p className="mt-1.5 font-display text-4xl font-bold leading-none text-ink num">{teams.length}</p>
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/equipos" className="btn btn-primary btn-lg">
              Ver equipos <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/historia" className="btn btn-secondary btn-lg">Historia de la liga</Link>
          </div>
        </div>
        <CrestRing teams={teams} />
      </div>
    </section>
  );
}

function CompetitionLink({ to, icon: Icon, title, desc }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-2xl border border-line/10 bg-surface p-5 transition-colors hover:border-line/30 hover:bg-raised"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-deep text-accent-soft" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl font-bold uppercase leading-tight text-ink">{title}</span>
        <span className="mt-1 block text-sm text-ink-2">{desc}</span>
      </span>
      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-3 transition-colors group-hover:text-ink" aria-hidden="true" />
    </Link>
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
  const { teams, loading, error } = useLeagueTeams();

  return (
    <>
      <Hero teams={teams} />

      <HistoryTeaser />

      <section aria-labelledby="clubes" className={SECTION_CLASS}>
        <Reveal>
          <SectionHeading id="clubes" title="Los clubes">
            Cada club de la liga: su historia, su plantel y su campaña en el torneo.
          </SectionHeading>
        </Reveal>
        <Reveal delay={100}>
          <ClubGrid teams={teams} loading={loading} error={error} />
        </Reveal>
      </section>

      <section aria-labelledby="competencia" className={SECTION_CLASS}>
        <Reveal>
          <SectionHeading id="competencia" title="La competencia" />
        </Reveal>
        <Reveal delay={100} className="grid gap-4 md:grid-cols-2">
          <CompetitionLink to="/torneo" icon={Trophy} title="Torneo" desc="Tabla de posiciones, cuadros de las copas y goleadores." />
          <CompetitionLink to="/reglamento" icon={BookOpen} title="Reglamento" desc="El formato y las reglas de la competencia de esta temporada." />
        </Reveal>
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
