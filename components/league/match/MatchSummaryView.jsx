import React, { useRef } from 'react';
import { ArrowDown, ArrowUp, Goal } from 'lucide-react';
import { CardMark, MatchStatus, TeamMark } from './MatchParts.jsx';

/* Encabezado y minuto a minuto del partido (screens/league/LeagueMatchScreen.jsx). Datos: utils/matchCenter.js. */

function scorersOf(timeline, side) {
  return timeline
    .filter(event => event.type === 'goal' && event.side === side)
    .map(event => `${event.player} ${event.minute}${event.penalty ? ' (p)' : ''}${event.ownGoal ? ' (e.c.)' : ''}`);
}

export function MatchHeader({ match, timeline, teamsById }) {
  // Un gol en vivo hace destellar el marcador (.value-flash en index.css); al abrir la página no destella.
  const score = `${match.home.score}-${match.away.score}`;
  const firstScore = useRef(score);
  const scoreChanged = score !== firstScore.current;
  const date = match.startedAt
    ? new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(match.startedAt)
    : '';
  const team = (side, align) => (
    <div className={`flex min-w-0 flex-col items-center gap-2 text-center ${align}`}>
      <TeamMark team={match[side]} teamsById={teamsById} size="lg" />
      <span className="font-display text-lg font-bold leading-tight text-ink sm:text-xl">{match[side].name}</span>
      <ul className="space-y-0.5 text-xs text-ink-3">
        {scorersOf(timeline, side).map((line, index) => <li key={index}>{line}</li>)}
      </ul>
    </div>
  );
  return (
    <header className="panel p-5 sm:p-6">
      <p className="eyebrow text-center first-letter:uppercase">{match.competition} · {date}</p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-6">
        {team('home', '')}
        <div className="flex flex-col items-center pt-3">
          <div key={score} className={`num font-display text-5xl font-bold leading-none text-ink sm:text-6xl ${scoreChanged ? 'value-flash' : ''}`} aria-label={`${match.home.score} a ${match.away.score}`}>
            {match.home.score}<span className="px-2 text-ink-3">-</span>{match.away.score}
          </div>
          <MatchStatus status={match.status} className="mt-2 text-sm" />
          {match.shootout && (
            <p className="mt-1 text-xs text-ink-3">Penales <span className="num text-ink-2">{match.shootout.home}-{match.shootout.away}</span></p>
          )}
        </div>
        {team('away', '')}
      </div>
    </header>
  );
}

const PERIOD_LABEL = { 1: 'Primer tiempo', 2: 'Segundo tiempo', 3: 'Alargue', 4: 'Alargue' };

function EventBody({ event }) {
  if (event.type === 'goal') {
    return (
      <>
        <span className="font-semibold text-ink">{event.player}</span>
        <span className="block text-xs text-ink-3">
          {event.ownGoal ? 'En contra' : event.penalty ? 'De penal' : event.freeKick ? 'De tiro libre' : event.assist ? `Asistencia: ${event.assist}` : 'Gol'}
        </span>
      </>
    );
  }
  if (event.type === 'card') {
    return <span className="text-ink-2">{event.player}</span>;
  }
  return (
    <>
      <span className="flex items-center gap-1 text-ink-2 justify-[inherit]"><ArrowUp className="h-3.5 w-3.5 text-success-soft" aria-label="Entra" />{event.playerIn}</span>
      <span className="flex items-center gap-1 text-xs text-ink-3 justify-[inherit]"><ArrowDown className="h-3.5 w-3.5 text-danger-soft" aria-label="Sale" />{event.playerOut}</span>
    </>
  );
}

function EventIcon({ event }) {
  if (event.type === 'goal') return <Goal className={`h-4 w-4 ${event.ownGoal ? 'text-danger-soft' : 'text-accent-soft'}`} aria-label={event.ownGoal ? 'Gol en contra' : 'Gol'} />;
  if (event.type === 'card') return <CardMark type={event.card} />;
  return <span className="sr-only">Cambio</span>;
}

/** Eventos a cada lado (local a la izquierda), con el minuto al centro y un corte por tiempo. */
export function MatchTimeline({ timeline, match }) {
  if (!timeline.length) {
    return <p className="panel px-4 py-8 text-center text-sm text-ink-3">Todavía no hubo goles, tarjetas ni cambios.</p>;
  }
  const rows = [];
  let period = null;
  for (const [index, event] of timeline.entries()) {
    const eventPeriod = event.clock?.period ?? null;
    if (eventPeriod !== period && PERIOD_LABEL[eventPeriod] && PERIOD_LABEL[eventPeriod] !== PERIOD_LABEL[period]) {
      rows.push(<li key={`p${index}`} className="eyebrow py-2 text-center">{PERIOD_LABEL[eventPeriod]}</li>);
    }
    period = eventPeriod;
    const isHome = event.side === 'home';
    rows.push(
      <li key={index} className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2 py-2.5">
        <div className={`flex items-center gap-2 justify-end text-right ${isHome ? '' : 'invisible'}`}>
          {isHome && <><div className="min-w-0 text-sm">{<EventBody event={event} />}</div><EventIcon event={event} /></>}
        </div>
        <div className="text-center">
          <span className="num font-display text-sm font-semibold text-ink-2">{event.minute}</span>
          {event.score && <span className="block num text-xs font-semibold text-ink">{event.score}</span>}
        </div>
        <div className={`flex items-center gap-2 text-left ${isHome ? 'invisible' : ''}`}>
          {!isHome && <><EventIcon event={event} /><div className="min-w-0 text-sm">{<EventBody event={event} />}</div></>}
        </div>
      </li>,
    );
  }
  if (match.status.kind === 'finished') {
    rows.push(
      <li key="end" className="eyebrow py-2 text-center">
        Final {match.home.score}-{match.away.score}{match.shootout ? ` · penales ${match.shootout.home}-${match.shootout.away}` : ''}
      </li>,
    );
  }
  return <ol className="panel divide-y divide-line/10 px-4 py-2" aria-label="Minuto a minuto">{rows}</ol>;
}
