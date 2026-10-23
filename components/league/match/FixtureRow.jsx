import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatFixtureDate } from '../../../utils/leagueFixtures.js';

/* Una fila de partido del fixture (utils/leagueFixtures.js), al estilo de los centros de partidos: estado a la
   izquierda, los dos clubes con escudo, el marcador a la derecha. La usan la portada y /partidos. */

/** Buscador de clubes del draft por nombre (sin mayúsculas ni espacios de más), como identifica el torneo. */
export function makeClubLookup(teams) {
  const byKey = new Map((teams || []).map(team => [String(team.teamName || '').trim().toLowerCase(), team]));
  return name => byKey.get(String(name || '').trim().toLowerCase()) || null;
}

/** Escudo del club o, si no tiene, sus iniciales. `club`: el equipo del draft (logoUrl) o null. */
export function LeagueCrest({ name, club, size = 'md' }) {
  const box = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  if (club?.logoUrl) return <img src={club.logoUrl} alt="" className={`${box} shrink-0 object-contain`} loading="lazy" />;
  const initials = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return (
    <span aria-hidden="true" className={`${box} grid shrink-0 place-items-center rounded-full bg-raised font-display font-bold text-ink-2`}>
      {initials || '–'}
    </span>
  );
}

const STATUS = {
  nosignal: { label: 'Sin señal', className: 'text-warning-soft' },
  played: { label: 'Jugado', className: 'text-ink-2' },
  abandoned: { label: 'Suspendido', className: 'text-warning-soft' },
  postponed: { label: 'Postergado', className: 'text-warning-soft' },
};

function StatusCell({ fixture }) {
  if (fixture.status === 'live') {
    return (
      <span className="inline-flex flex-col items-start gap-0.5 font-semibold text-danger-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
          <span className="num">{fixture.minute || 'En vivo'}</span>
        </span>
        <span className="sr-only">en vivo</span>
      </span>
    );
  }
  if (fixture.status === 'finished') {
    return <span className="font-semibold text-ink-2">{fixture.pens ? 'Final (pen.)' : 'Final'}</span>;
  }
  if (STATUS[fixture.status]) return <span className={STATUS[fixture.status].className}>{STATUS[fixture.status].label}</span>;
  const when = formatFixtureDate(fixture);
  return <span className="text-ink-2">{when || 'A confirmar'}</span>;
}

function TeamLine({ team, club, score, outcome }) {
  // El que perdió no se apaga en gris: se lee igual de claro, solo el ganador va en negrita.
  const tone = outcome === 'win' ? 'font-bold text-ink' : 'font-medium text-ink';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LeagueCrest name={team.name} club={club} size="sm" />
      <span className={`min-w-0 flex-1 truncate ${tone}`} title={team.name}>{team.name}</span>
      {score != null && <span className={`num w-6 text-right font-display text-lg ${outcome === 'win' ? 'font-bold text-ink' : 'text-ink'}`}>{score}</span>}
    </div>
  );
}

/**
 * @param {{ fixture: object, clubOf: (name: string) => object | null, showCompetition?: boolean, action?: React.ReactNode }} props
 */
export function FixtureRow({ fixture, clubOf, showCompetition = true, action }) {
  const score = fixture.score || fixture.liveScore;
  const outcome = side => (fixture.winner ? (fixture.winner === side ? 'win' : 'loss') : null);
  const href = fixture.liveMatchKey ? `/partidos/${fixture.liveMatchKey}` : null;
  const body = (
    <>
      <div className="pt-0.5 text-sm leading-tight">
        <StatusCell fixture={fixture} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <TeamLine team={fixture.home} club={clubOf(fixture.home.name)} score={score?.home} outcome={outcome('home')} />
        <TeamLine team={fixture.away} club={clubOf(fixture.away.name)} score={score?.away} outcome={outcome('away')} />
        {(showCompetition || fixture.pens) && (
          <p className="text-[13px] text-ink-3">
            {showCompetition && <>{fixture.competitionLabel} · {fixture.roundLabel}</>}
            {fixture.pens && <>{showCompetition ? ' · ' : ''}Penales <span className="num">{fixture.pens.home}-{fixture.pens.away}</span></>}
            {fixture.status === 'played' && ' · Resultado a confirmar'}
          </p>
        )}
      </div>
      {href ? <ChevronRight className="mt-1 h-4 w-4 text-ink-3" aria-hidden="true" /> : <span aria-hidden="true" />}
    </>
  );
  const rowClass = `grid grid-cols-[5.5rem_minmax(0,1fr)_1rem] items-start gap-3 px-4 py-3 ${fixture.status === 'live' ? 'bg-danger/[0.05]' : ''}`;
  return (
    <li>
      {href
        ? <Link to={href} className={`${rowClass} min-h-11 transition-colors hover:bg-white/[0.03]`}>{body}</Link>
        : <div className={rowClass}>{body}</div>}
      {action && <div className="px-4 pb-3 pl-[7rem]">{action}</div>}
    </li>
  );
}
