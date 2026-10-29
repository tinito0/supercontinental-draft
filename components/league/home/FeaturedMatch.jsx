import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Vote } from 'lucide-react';
import { LeagueCrest } from '../match/FixtureRow.jsx';
import { formatFixtureDate } from '../../../utils/leagueFixtures.js';

/* El partido de la portada, al lado del título: el que se juega ahora; si no hay, el próximo (primero el que está
   al aire); si no, el último resultado. Escudos grandes, marcador o horario, y la acción que corresponde
   (votar el MVP, predecir, ver el partido). */

/** Qué partido destacar y con qué etiqueta. */
export function pickFeatured(groups) {
  if (groups?.live?.length) return { fixture: groups.live[0], kind: 'live' };
  if (groups?.upcoming?.length) return { fixture: groups.upcoming[0], kind: 'next' };
  if (groups?.results?.length) return { fixture: groups.results[0], kind: 'last' };
  return null;
}

const KIND_LABEL = { live: 'En vivo', next: 'Próximo partido', last: 'Último resultado' };

function Side({ team, club, isWinner }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white p-2.5 sm:h-24 sm:w-24">
        <LeagueCrest name={team.name} club={club} size="lg" />
      </span>
      <span className={`line-clamp-2 font-display text-lg leading-tight text-ink sm:text-xl ${isWinner ? 'font-bold' : 'font-semibold'}`}>{team.name}</span>
    </div>
  );
}

export function FeaturedMatch({ featured, clubOf, prediction }) {
  const { fixture, kind } = featured;
  const score = fixture.score || fixture.liveScore;
  const hasScore = score && score.home != null && score.away != null;
  const href = fixture.liveMatchKey ? `/partidos/${fixture.liveMatchKey}` : '/partidos';
  const canPredict = kind === 'next' && fixture.isOnAir && prediction && !prediction.closedAt;
  const action = kind === 'live'
    ? { to: '/en-vivo', label: 'Votá el MVP del partido', icon: Vote, primary: true }
    : canPredict
      ? { to: '/en-vivo', label: '¿Quién gana? Votá tu predicción', icon: Vote, primary: true }
      : { to: href, label: kind === 'last' ? 'Ver el partido' : 'Ver el fixture' };

  return (
    <article className={`panel p-5 sm:p-7 ${kind === 'live' ? 'border-danger/40' : ''}`} aria-labelledby="featured-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="featured-title" className={`inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${kind === 'live' ? 'text-danger-soft' : 'text-ink-2'}`}>
          {kind === 'live' && <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />}
          {KIND_LABEL[kind]}
        </h2>
        <span className="text-sm font-medium text-ink-2">{fixture.competitionLabel} · {fixture.roundLabel}</span>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
        <Side team={fixture.home} club={clubOf(fixture.home.name)} isWinner={fixture.winner === 'home'} />
        <div className="text-center">
          {hasScore ? (
            <p className="num font-display text-5xl font-bold leading-none text-ink sm:text-6xl" aria-label={`${score.home} a ${score.away}`}>
              {score.home}<span className="mx-1.5 text-ink-3">-</span>{score.away}
            </p>
          ) : (
            <p className="font-display text-2xl font-bold uppercase leading-none text-ink">vs</p>
          )}
          <p className={`mt-2 text-sm font-semibold ${kind === 'live' ? 'text-danger-soft' : 'text-ink-2'}`}>
            {kind === 'live' ? (fixture.minute || 'En vivo') : kind === 'last' ? (fixture.pens ? 'Final · penales' : 'Final') : (formatFixtureDate(fixture) || 'A confirmar')}
          </p>
        </div>
        <Side team={fixture.away} club={clubOf(fixture.away.name)} isWinner={fixture.winner === 'away'} />
      </div>

      {fixture.pens && kind === 'last' && (
        <p className="mt-5 flex items-center justify-center gap-2 border-t border-line/10 pt-4 text-base font-semibold text-ink">
          <span className="h-4 w-1 rounded bg-accent" aria-hidden="true" />
          {fixture.winner === 'home' || fixture.winner === 'away' ? (
            <>Ganó {fixture.winner === 'away' ? fixture.away.name : fixture.home.name} por penales{' '}
              <span className="num">{fixture.winner === 'away' ? `${fixture.pens.away}-${fixture.pens.home}` : `${fixture.pens.home}-${fixture.pens.away}`}</span></>
          ) : <>Penales <span className="num">{fixture.pens.home}-{fixture.pens.away}</span></>}
        </p>
      )}
      <Link to={action.to} className={`btn btn-lg mt-6 w-full ${action.primary ? 'btn-primary' : 'btn-secondary'}`}>
        {action.icon && <action.icon className="h-4 w-4" aria-hidden="true" />} {action.label} <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

export default FeaturedMatch;
