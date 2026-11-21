import React, { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { FixtureRow, makeClubLookup } from '../../components/league/match/FixtureRow.jsx';
import { FeaturedMatch } from '../../components/league/home/FeaturedMatch.jsx';
import { LeagueLeaders } from '../../components/league/match/LeagueLeaders.jsx';
import { useLeagueFixtures } from '../../hooks/useLeagueFixtures.js';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useLeagueTeams } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { groupMatchesByDay } from '../../utils/matchCenter.js';

function winnerSide(match) {
  if (match.status.kind !== 'finished') return null;
  if (match.home.score !== match.away.score) return match.home.score > match.away.score ? 'home' : 'away';
  if (match.shootout && match.shootout.home !== match.shootout.away) return match.shootout.home > match.shootout.away ? 'home' : 'away';
  return null;
}

const timeFormat = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
// Sin competición conocida no se muestra nada arriba de la hora («Partido» no dice nada).
const GENERIC_COMPETITIONS = new Set(['Liga', 'Partido', '']);

/**
 * Un partido del registro (live_matches) con la forma de una fila del fixture, así el registro se ve igual que el
 * fixture y la portada (FixtureRow): la hora va donde va la fecha, y la competición arriba si no es la liga.
 */
function gameLogFixture(match) {
  const status = match.status.kind === 'live' ? 'live' : match.status.kind === 'abandoned' ? 'abandoned' : 'finished';
  return {
    id: match.key,
    liveMatchKey: match.key,
    status,
    minute: match.status.kind === 'live' ? match.status.label : '',
    competition: GENERIC_COMPETITIONS.has(match.competition || '') ? 'liga' : 'otra',
    competitionLabel: match.competition,
    roundLabel: match.startedAt ? timeFormat.format(match.startedAt) : 'Sin hora',
    home: { name: match.home.name },
    away: { name: match.away.name },
    score: { home: match.home.score, away: match.away.score },
    pens: match.shootout || null,
    winner: winnerSide(match),
  };
}

/** Escudos del registro: por el club del draft que trae cada lado (los nombres del juego pueden no coincidir). */
function gameLogClubs(matches, teamsById) {
  const byName = new Map();
  for (const match of matches) {
    for (const side of [match.home, match.away]) {
      const club = side.draftTeamId ? teamsById?.[side.draftTeamId] : null;
      if (club) byName.set(String(side.name || '').trim().toLowerCase(), club);
    }
  }
  return name => byName.get(String(name || '').trim().toLowerCase()) || null;
}

const COMPETITIONS = [
  { id: 'all', label: 'Todo' },
  { id: 'liga', label: 'Liga' },
  { id: 'oro', label: 'Copa de Oro' },
  { id: 'plata', label: 'Copa de Plata' },
];

/** Fixture completo (utils/leagueFixtures.js): en vivo arriba, después cada ronda en orden, con su estado real. */
function FixtureList({ teams, teamsById }) {
  const { fixtures, groups, liveMatches, prediction, loading, error } = useLeagueFixtures(teamsById);
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
        // Lo que se juega ahora, en grande: marcador, goles y números del juego (se juega un partido a la vez).
        <section aria-label="En vivo" className="space-y-4">
          {groups.live.map(fixture => (
            <FeaturedMatch key={fixture.id} featured={{ fixture, kind: 'live' }} clubOf={clubOf} prediction={prediction}
              liveMatch={(liveMatches || []).find(match => match.key === fixture.liveMatchKey) || null} />
          ))}
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
          <h2 className="mb-3 font-display text-2xl font-bold uppercase leading-none text-ink">{round.title}</h2>
          <ul className="panel divide-y divide-line/10 overflow-hidden p-0">
            {round.fixtures.map(fixture => <FixtureRow key={fixture.id} fixture={fixture} clubOf={clubOf} showCompetition={false} quietLive />)}
          </ul>
        </section>
      ))}
      <OtherGameMatches fixtures={fixtures} liveMatches={liveMatches} teamsById={teamsById} />
    </div>
  );
}

/**
 * Game matches the bridge uploaded that belong to no fixture (friendlies, tests): official ones already open their
 * minute-by-minute from the fixture above, so only the rest is listed, by day. Nothing shows when there are none.
 */
function OtherGameMatches({ fixtures, liveMatches, teamsById }) {
  const others = useMemo(() => {
    const linked = new Set(fixtures.map(fixture => fixture.liveMatchKey).filter(Boolean));
    return (liveMatches || []).filter(match => !linked.has(match.key));
  }, [fixtures, liveMatches]);
  const groups = useMemo(() => groupMatchesByDay(others), [others]);
  const clubOf = useMemo(() => gameLogClubs(others, teamsById), [others, teamsById]);
  if (!others.length) return null;
  return (
    <section aria-labelledby="other-matches" className="space-y-4 border-t border-line/10 pt-8">
      <div>
        <h2 id="other-matches" className="font-display text-2xl font-bold uppercase leading-none text-ink">Otros partidos del PES</h2>
        <p className="mt-2 text-sm text-ink-2">Amistosos y pruebas que el juego subió y no son del torneo. No suman en la tabla.</p>
      </div>
      {groups.map(group => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-2 text-sm font-semibold text-ink-2 first-letter:uppercase">{group.label}</h3>
          <ul className="panel divide-y divide-line/10 overflow-hidden p-0">
            {group.matches.map(match => <FixtureRow key={match.key} fixture={gameLogFixture(match)} clubOf={clubOf} />)}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** Partidos: el fixture del torneo con sus resultados y, si los hay, los partidos del PES que no son del torneo. */
export default function LeagueMatchesScreen() {
  useDocumentTitle('Partidos');
  const { teams, teamsById } = useLeagueTeams();

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Partidos">
          El fixture del torneo con los resultados oficiales. Cada partido jugado abre su minuto a minuto.
        </SectionHeading>
      </Reveal>
      <LeagueLeaders />
      <FixtureList teams={teams} teamsById={teamsById} />
    </section>
  );
}
