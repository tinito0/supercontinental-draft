import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { BallIcon } from './BallIcon.jsx';
import { CardMark, MatchStatus, TeamMark } from './MatchParts.jsx';
import { LiveScore } from './LiveScore.jsx';
import { shootoutSentence } from '../../../utils/bracketModel.js';

/* Encabezado y minuto a minuto del partido (screens/league/LeagueMatchScreen.jsx). Datos: utils/matchCenter.js. */

/** Name of the team that won the shootout; '' while it is level. */
function shootoutWinner(match) {
  const { home, away } = match.shootout;
  if (home === away) return '';
  return home > away ? match.home.name : match.away.name;
}

function scorersOf(timeline, side) {
  return timeline
    .filter(event => event.type === 'goal' && event.side === side)
    .map(event => `${event.player} ${event.minute}${event.penalty ? ' (p)' : ''}${event.ownGoal ? ' (e.c.)' : ''}`);
}

/** `as`: h1 on the match page; h2 when embedded in another page that already has its own h1 (/en-vivo). */
export function MatchHeader({ match, timeline, teamsById, as: Heading = 'h1' }) {
  // Fecha corta en 24 h, para que entre en una línea en el teléfono.
  const date = match.startedAt
    ? new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(match.startedAt)
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
      <Heading className="sr-only">{match.home.name} {match.home.score}-{match.away.score} {match.away.name}</Heading>
      <p className="eyebrow text-center first-letter:uppercase">{match.competition} · {date}</p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-6">
        {team('home', '')}
        <div className="flex flex-col items-center pt-3">
          {/* Un gol en vivo hace entrar solo el número que cambió (LiveScore); al abrir la página no se anima. */}
          <LiveScore home={match.home.score} away={match.away.score} className="text-5xl sm:text-6xl" />
          <MatchStatus status={match.status} className="mt-2 text-sm" />
        </div>
        {team('away', '')}
      </div>
      {/* Debajo de los equipos y a todo el ancho: en la columna del marcador no entra en el teléfono. */}
      {match.shootout && (
        <p className="num mt-4 border-t border-line/10 pt-3 text-center text-sm font-semibold text-ink">
          {shootoutSentence(shootoutWinner(match), match.shootout.home, match.shootout.away)}
        </p>
      )}
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
  if (event.type === 'goal') return <span role="img" aria-label={event.ownGoal ? 'Gol en contra' : 'Gol'} className={`inline-flex rounded-full ${event.ownGoal ? 'ring-2 ring-danger' : ''}`}><BallIcon className="h-4 w-4" /></span>;
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
    // The team is in the text, not only in the column (WCAG 1.4.1 / 1.3.1).
    const teamName = <span className="sr-only">{match[event.side]?.name}: </span>;
    rows.push(
      <li key={index} className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2 py-2.5">
        <div className={`flex items-center gap-2 justify-end text-right ${isHome ? '' : 'invisible'}`}>
          {isHome && <><div className="min-w-0 text-sm">{teamName}<EventBody event={event} /></div><EventIcon event={event} /></>}
        </div>
        <div className="text-center">
          <span className="num font-display text-sm font-semibold text-ink-2">{event.minute}</span>
          {event.score && <span className="block num text-xs font-semibold text-ink">{event.score}</span>}
        </div>
        <div className={`flex items-center gap-2 text-left ${isHome ? 'invisible' : ''}`}>
          {!isHome && <><EventIcon event={event} /><div className="min-w-0 text-sm">{teamName}<EventBody event={event} /></div></>}
        </div>
      </li>,
    );
  }
  if (match.status.kind === 'finished') {
    rows.push(
      <li key="end" className="eyebrow py-2 text-center">
        Final {match.home.score}-{match.away.score}{match.shootout ? ` · ${shootoutSentence(shootoutWinner(match), match.shootout.home, match.shootout.away)}` : ''}
      </li>,
    );
  }
  return <ol className="panel divide-y divide-line/10 px-4 py-2" aria-label="Minuto a minuto">{rows}</ol>;
}
