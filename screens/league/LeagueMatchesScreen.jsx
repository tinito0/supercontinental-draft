import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Gamepad2 } from 'lucide-react';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { FixtureRow, makeClubLookup } from '../../components/league/match/FixtureRow.jsx';
import { useLeagueFixtures } from '../../hooks/useLeagueFixtures.js';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { MatchStatus, TeamMark } from '../../components/league/match/MatchParts.jsx';
import { useLeagueTeams, useLiveMatches } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { groupMatchesByDay } from '../../utils/matchCenter.js';

function TeamLine({ team, isWinner, teamsById }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <TeamMark team={team} teamsById={teamsById} size="sm" />
      <span className={`min-w-0 flex-1 truncate ${isWinner ? 'font-bold text-ink' : 'font-medium text-ink'}`}>{team.name}</span>
      <span className={`num font-display text-lg text-ink ${isWinner ? 'font-bold' : ''}`}>{team.score}</span>
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
        <div className="text-sm leading-tight">
          <div className="font-semibold text-ink-2">{time}</div>
          <MatchStatus status={match.status} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <TeamLine team={match.home} teamsById={teamsById} isWinner={winner === 'home'} />
          <TeamLine team={match.away} teamsById={teamsById} isWinner={winner === 'away'} />
          <div className="text-[13px] text-ink-3">
            {match.competition}
            {match.shootout && <> · Penales <span className="num">{match.shootout.home}-{match.shootout.away}</span></>}
          </div>
        </div>
      </Link>
    </li>
  );
}

const COMPETITIONS = [
  { id: 'all', label: 'Todo' },
  { id: 'liga', label: 'Liga' },
  { id: 'oro', label: 'Copa de Oro' },
  { id: 'plata', label: 'Copa de Plata' },
];

/** Fixture completo (utils/leagueFixtures.js): en vivo arriba, después cada ronda en orden, con su estado real. */
function FixtureList({ teams, teamsById }) {
  const { fixtures, groups, loading, error } = useLeagueFixtures(teamsById);
  const [competition, setCompetition] = useState('all');
  const clubOf = useMemo(() => makeClubLookup(teams), [teams]);
  const rounds = useMemo(() => {
    const map = new Map();
    for (const fixture of fixtures) {
      if (competition !== 'all' && fixture.competition !== competition) continue;
      const key = `${fixture.roundOrder}|${fixture.competitionLabel}|${fixture.roundLabel}`;
      if (!map.has(key)) map.set(key, { key, order: fixture.roundOrder, title: `${fixture.competitionLabel} · ${fixture.roundLabel}`, fixtures: [] });
      map.get(key).fixtures.push(fixture);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [fixtures, competition]);

  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  if (loading) return <div className="panel space-y-3 p-4" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-16 skeleton" />)}</div>;
  if (!fixtures.length) {
    return <EmptyState icon={CalendarDays} title="Todavía no hay partidos programados" description="El fixture aparece apenas se cargan las fechas del torneo." />;
  }
  return (
    <div className="space-y-8">
      {groups.live.length > 0 && (
        <section aria-label="En vivo">
          <h2 className="eyebrow mb-2 text-danger-soft">En vivo</h2>
          <ul className="panel divide-y divide-line/10 overflow-hidden p-0">
            {groups.live.map(fixture => <FixtureRow key={fixture.id} fixture={fixture} clubOf={clubOf} />)}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Competición">
        {COMPETITIONS.map(item => (
          <button key={item.id} type="button" aria-pressed={competition === item.id} onClick={() => setCompetition(item.id)}
            className={`btn btn-sm min-h-11 ${competition === item.id ? 'btn-primary' : 'btn-secondary'}`}>
            {item.label}
          </button>
        ))}
      </div>
      {rounds.length === 0 && <p className="text-base text-ink-2">Esta competición todavía no tiene partidos.</p>}
      {rounds.map(round => (
        <section key={round.key} aria-label={round.title}>
          <h2 className="eyebrow mb-2">{round.title}</h2>
          <ul className="panel divide-y divide-line/10 overflow-hidden p-0">
            {round.fixtures.map(fixture => <FixtureRow key={fixture.id} fixture={fixture} clubOf={clubOf} showCompetition={false} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

const VIEWS = [
  { id: 'fixture', label: 'Fixture y resultados', icon: CalendarDays },
  { id: 'registro', label: 'Registro del juego', icon: Gamepad2 },
];

/** Partidos: el fixture del torneo y el registro de todo lo que subió el bridge del PES. */
export default function LeagueMatchesScreen() {
  useDocumentTitle('Partidos');
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('vista') === 'registro' ? 'registro' : 'fixture';
  const { teams, teamsById } = useLeagueTeams();

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Partidos">
          El fixture con los resultados oficiales del torneo, y el minuto a minuto de cada partido jugado en el juego.
        </SectionHeading>
      </Reveal>
      <div className="mb-6">
        <Tabs label="Vista" value={view} onChange={id => setSearchParams(id === 'registro' ? { vista: 'registro' } : {}, { replace: true })} tabs={VIEWS} />
      </div>
      {view === 'fixture' ? <FixtureList teams={teams} teamsById={teamsById} /> : <GameLog teamsById={teamsById} />}
    </section>
  );
}

/** Registro de partidos: todo lo que subió el bridge del PES, en vivo y terminados. */
function GameLog({ teamsById }) {
  const { matches, loading, error } = useLiveMatches();
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

  return content;
}
