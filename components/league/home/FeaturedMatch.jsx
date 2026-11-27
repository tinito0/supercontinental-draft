import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Vote } from 'lucide-react';
import { LeagueCrest } from '../match/FixtureRow.jsx';
import { LiveScore } from '../match/LiveScore.jsx';
import { BallIcon } from '../match/BallIcon.jsx';
import { CardMark } from '../match/MatchParts.jsx';
import { formatFixtureDate } from '../../../utils/leagueFixtures.js';
import { buildTimeline } from '../../../utils/matchCenter.js';

/* El partido de arriba de la portada: el que se juega ahora; si no hay, el próximo (primero el que está al aire); si
   no, el último resultado. En vivo es lo primero que se ve: marcador grande y minuto, goleadores, lo último que pasó
   y tres números del partido, todo del juego (live_matches) y al ritmo del puente. Se juega un partido a la vez. */

/** Qué partido destacar y con qué etiqueta. */
export function pickFeatured(groups) {
  if (groups?.live?.length) return { fixture: groups.live[0], kind: 'live' };
  if (groups?.upcoming?.length) return { fixture: groups.upcoming[0], kind: 'next' };
  if (groups?.results?.length) return { fixture: groups.results[0], kind: 'last' };
  return null;
}

const KIND_LABEL = { live: 'En vivo', next: 'Próximo partido', last: 'Último resultado' };

function Side({ team, club, isWinner, scorers = [] }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2.5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white p-2 sm:h-24 sm:w-24 sm:p-2.5">
        <LeagueCrest name={team.name} club={club} size="lg" />
      </span>
      <span className={`line-clamp-2 font-display text-lg leading-tight text-ink sm:text-xl ${isWinner ? 'font-bold' : 'font-semibold'}`}>{team.name}</span>
      {scorers.length > 0 && (
        <ul className="space-y-0.5 text-xs text-ink-2" aria-label={`Goles de ${team.name}`}>
          {scorers.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      )}
    </div>
  );
}

const LAST_EVENTS = 3;

/** Lados del partido del juego vistos desde el fixture (el local del fixture puede ser el visitante del juego). */
const sideOf = (fixture, gameSide) => (fixture.liveFlipped ? (gameSide === 'home' ? 'away' : 'home') : gameSide);

function scorerLine(event) {
  return `${event.player} ${event.minute}${event.penalty ? ' (p)' : ''}${event.ownGoal ? ' (e.c.)' : ''}`;
}

function EventMark({ event }) {
  if (event.type === 'goal') return <span role="img" aria-label={event.ownGoal ? 'Gol en contra' : 'Gol'}><BallIcon className="h-4 w-4" /></span>;
  if (event.type === 'card') return <CardMark type={event.card} />;
  return <span className="flex" title="Cambio"><ArrowUp className="h-3.5 w-3.5 text-success-soft" aria-hidden="true" /><ArrowDown className="-ml-1 h-3.5 w-3.5 text-danger-soft" aria-hidden="true" /><span className="sr-only">Cambio</span></span>;
}

function eventText(event) {
  if (event.type === 'goal') return { main: event.player, detail: event.ownGoal ? 'en contra' : event.penalty ? 'de penal' : event.assist ? `asist. ${event.assist}` : '' };
  if (event.type === 'card') return { main: event.player, detail: '' };
  return { main: event.playerIn, detail: `por ${event.playerOut}` };
}

/** Lo último que pasó, lo más nuevo arriba. Una línea por evento: minuto, marca, jugador y su club. */
function LastEvents({ events, fixture, clubOf }) {
  if (!events.length) return <p className="text-sm text-ink-3">Todavía no hubo goles, tarjetas ni cambios.</p>;
  return (
    <ol className="divide-y divide-line/10" aria-label="Lo último del partido">
      {events.map(event => {
        const team = fixture[sideOf(fixture, event.side)];
        const { main, detail } = eventText(event);
        return (
          <li key={`${event.type}-${event.minute}-${main}`} className="flex min-h-11 items-center gap-3 py-1.5 animate-in fade-in">
            <span className="num w-9 shrink-0 font-display text-sm font-semibold text-ink-2">{event.minute}</span>
            <span className="grid w-5 shrink-0 place-items-center"><EventMark event={event} /></span>
            <span className="min-w-0 flex-1 text-sm">
              <span className={`${event.type === 'goal' ? 'font-semibold text-ink' : 'text-ink'}`}>{main}</span>
              {detail && <span className="text-ink-3"> · {detail}</span>}
            </span>
            <span className="grid h-6 w-6 shrink-0 place-items-center" title={team.name}>
              <LeagueCrest name={team.name} club={clubOf(team.name)} size="sm" />
              <span className="sr-only">{team.name}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const STAT_ROWS = [
  { label: 'Posesión', get: (summary, side) => summary?.possession?.[side], unit: '%' },
  { label: 'Tiros', get: (summary, side) => summary?.teamStats?.[side]?.shots },
  { label: 'Tiros al arco', get: (summary, side) => summary?.teamStats?.[side]?.shotsOnTarget },
];

/** Tres números del partido, local a la izquierda. La barra muestra la proporción y crece con scaleX (300 ms). */
function LiveStats({ summary, fixture }) {
  const rows = STAT_ROWS.map(row => {
    const home = Number(row.get(summary, fixture.liveFlipped ? 'away' : 'home'));
    const away = Number(row.get(summary, fixture.liveFlipped ? 'home' : 'away'));
    return Number.isFinite(home) && Number.isFinite(away) ? { ...row, home, away } : null;
  }).filter(Boolean);
  if (!rows.length) return null;
  return (
    <ul className="space-y-3">
      {rows.map(row => {
        const total = row.home + row.away;
        const share = total > 0 ? row.home / total : 0.5;
        return (
          <li key={row.label}>
            <span className="sr-only">{row.label}: {fixture.home.name} {row.home}{row.unit && ` ${row.unit}`}, {fixture.away.name} {row.away}{row.unit && ` ${row.unit}`}</span>
            <div className="flex items-baseline justify-between text-sm" aria-hidden="true">
              <span className={`num font-semibold ${row.home >= row.away ? 'text-ink' : 'text-ink-2'}`}>{row.home}{row.unit && ` ${row.unit}`}</span>
              <span className="text-xs text-ink-2">{row.label}</span>
              <span className={`num font-semibold ${row.away >= row.home ? 'text-ink' : 'text-ink-2'}`}>{row.away}{row.unit && ` ${row.unit}`}</span>
            </div>
            <div className="mt-1 flex h-1.5 gap-1" aria-hidden="true">
              <span className="flex-1 overflow-hidden rounded-full bg-raised">
                <span className="block h-full origin-right rounded-full bg-accent transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${share})` }} />
              </span>
              <span className="flex-1 overflow-hidden rounded-full bg-raised">
                <span className="block h-full origin-left rounded-full bg-ink-3 transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${1 - share})` }} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * @param {{ featured: { fixture, kind }, clubOf: Function, prediction?: object|null, liveMatch?: object|null }} props
 *   liveMatch: el partido del juego vinculado al fixture (parseMatchDoc), para goles, eventos y estadísticas
 */
export function FeaturedMatch({ featured, clubOf, prediction, liveMatch = null }) {
  const { fixture, kind } = featured;
  const score = fixture.score || fixture.liveScore;
  const hasScore = score && score.home != null && score.away != null;
  const href = fixture.liveMatchKey ? `/partidos/${fixture.liveMatchKey}` : '/partidos';
  const timeline = useMemo(() => (liveMatch ? buildTimeline(liveMatch.summary) : []), [liveMatch]);
  const showDetail = kind === 'live' && liveMatch;
  const scorers = side => timeline.filter(event => event.type === 'goal' && sideOf(fixture, event.side) === side).map(scorerLine);
  const lastEvents = timeline.slice(-LAST_EVENTS).reverse();
  const canPredict = kind === 'next' && fixture.isOnAir && prediction && !prediction.closedAt;
  const action = kind === 'live'
    ? { to: href, label: 'Seguí el partido', primary: true }
    : canPredict
      ? { to: '/en-vivo', label: '¿Quién gana? Votá tu predicción', icon: Vote, primary: true }
      : { to: href, label: kind === 'last' ? 'Ver el partido' : 'Ver todos los partidos' };

  return (
    <article className={`panel p-4 sm:p-7 ${kind === 'live' ? 'border-danger/40' : ''}`} aria-labelledby={`featured-${fixture.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`featured-${fixture.id}`} className={`inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${kind === 'live' ? 'text-danger-soft' : 'text-ink-2'}`}>
          {kind === 'live' && <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />}
          {KIND_LABEL[kind]}
        </h2>
        <span className="text-sm font-medium text-ink-2">{fixture.competitionLabel} · {fixture.roundLabel}</span>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-5">
        <Side team={fixture.home} club={clubOf(fixture.home.name)} isWinner={fixture.winner === 'home'} scorers={showDetail ? scorers('home') : []} />
        <div className="pt-4 text-center sm:pt-6">
          {hasScore ? (
            <LiveScore key={fixture.id} home={score.home} away={score.away} className="text-5xl sm:text-6xl" />
          ) : (
            <p className="font-display text-2xl font-bold uppercase leading-none text-ink">vs</p>
          )}
          <p className={`mt-2 text-sm font-semibold ${kind === 'live' ? 'text-danger-soft' : 'text-ink-2'}`}>
            {kind === 'live' ? (fixture.minute || 'En vivo') : kind === 'last' ? (fixture.pens ? 'Final · penales' : 'Final') : (formatFixtureDate(fixture) || 'A confirmar')}
          </p>
        </div>
        <Side team={fixture.away} club={clubOf(fixture.away.name)} isWinner={fixture.winner === 'away'} scorers={showDetail ? scorers('away') : []} />
      </div>

      {showDetail && (
        <div className="mt-5 grid gap-5 border-t border-line/10 pt-4 sm:grid-cols-2 sm:gap-6">
          <section aria-labelledby={`featured-last-${fixture.id}`}>
            <h3 id={`featured-last-${fixture.id}`} className="eyebrow mb-1">Lo último</h3>
            <LastEvents events={lastEvents} fixture={fixture} clubOf={clubOf} />
          </section>
          <section aria-labelledby={`featured-stats-${fixture.id}`} className="sm:border-l sm:border-line/10 sm:pl-6">
            <h3 id={`featured-stats-${fixture.id}`} className="eyebrow mb-2">El partido</h3>
            <LiveStats summary={liveMatch.summary} fixture={fixture} />
          </section>
        </div>
      )}

      {fixture.pens && kind === 'last' && (
        <p className="mt-5 border-t border-line/10 pt-4 text-center text-base font-semibold text-ink">
          {fixture.winner === 'home' || fixture.winner === 'away' ? (
            <>Ganó {fixture.winner === 'away' ? fixture.away.name : fixture.home.name} por penales{' '}
              <span className="num">{fixture.winner === 'away' ? `${fixture.pens.away}-${fixture.pens.home}` : `${fixture.pens.home}-${fixture.pens.away}`}</span></>
          ) : <>Penales <span className="num">{fixture.pens.home}-{fixture.pens.away}</span></>}
        </p>
      )}
      <Link to={action.to} className={`btn btn-lg mt-5 w-full ${action.primary ? 'btn-primary' : 'btn-secondary'}`}>
        {action.icon && <action.icon className="h-4 w-4" aria-hidden="true" />} {action.label}
      </Link>

    </article>
  );
}

export default FeaturedMatch;
