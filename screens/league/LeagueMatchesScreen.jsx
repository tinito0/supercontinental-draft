import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { MatchStatus, TeamMark } from '../../components/league/match/MatchParts.jsx';
import { useLeagueTeams, useLiveMatches } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { groupMatchesByDay } from '../../utils/matchCenter.js';

function TeamLine({ team, isWinner, isLoser, teamsById }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <TeamMark team={team} teamsById={teamsById} size="sm" />
      <span className={`min-w-0 flex-1 truncate ${isWinner ? 'font-semibold text-ink' : isLoser ? 'text-ink-3' : 'text-ink-2'}`}>{team.name}</span>
      <span className={`num font-display text-lg ${isWinner ? 'text-ink' : 'text-ink-2'}`}>{team.score}</span>
    </div>
  );
}

function winnerSide(match) {
  if (match.status.kind !== 'finished') return null;
  if (match.home.score !== match.away.score) return match.home.score > match.away.score ? 'home' : 'away';
  if (match.shootout && match.shootout.home !== match.shootout.away) return match.shootout.home > match.shootout.away ? 'home' : 'away';
  return null;
}

function MatchRow({ match, teamsById }) {
  const winner = winnerSide(match);
  const time = match.startedAt ? new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(match.startedAt) : '';
  return (
    <li>
      <Link
        to={`/partidos/${match.key}`}
        className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 px-4 py-3 min-h-11 transition-colors hover:bg-white/[0.03]"
      >
        <div className="text-xs leading-tight">
          <div className="text-ink-3">{time}</div>
          <MatchStatus status={match.status} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <TeamLine team={match.home} teamsById={teamsById} isWinner={winner === 'home'} isLoser={winner === 'away'} />
          <TeamLine team={match.away} teamsById={teamsById} isWinner={winner === 'away'} isLoser={winner === 'home'} />
          <div className="text-xs text-ink-3">
            {match.competition}
            {match.shootout && <> · Penales <span className="num">{match.shootout.home}-{match.shootout.away}</span></>}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Registro de partidos: todo lo que subió el bridge del PES, en vivo y terminados. */
export default function LeagueMatchesScreen() {
  useDocumentTitle('Partidos');
  const { matches, loading, error } = useLiveMatches();
  const { teamsById } = useLeagueTeams();
  const groups = useMemo(() => groupMatchesByDay(matches), [matches]);

  let content;
  if (error) {
    content = <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  } else if (loading) {
    content = (
      <div className="panel divide-y divide-line/10" aria-busy="true">
        {[0, 1, 2].map(i => <div key={i} className="h-20 m-3 skeleton" />)}
      </div>
    );
  } else if (!matches.length) {
    content = <EmptyState icon={CalendarDays} title="Todavía no hay partidos" description="Cada partido que se juega aparece acá en vivo, con el minuto a minuto y las estadísticas." />;
  } else {
    content = (
      <div className="space-y-8">
        {groups.map(group => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="eyebrow mb-2 first-letter:uppercase">{group.label}</h2>
            <ul className="panel divide-y divide-line/10 overflow-hidden p-0">
              {group.matches.map(match => <MatchRow key={match.key} match={match} teamsById={teamsById} />)}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Partidos">
          Resultados, minuto a minuto y estadísticas de cada partido, en vivo desde el juego.
        </SectionHeading>
      </Reveal>
      {content}
    </section>
  );
}
