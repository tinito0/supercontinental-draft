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
  const box = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-xs';
  const px = size === 'lg' ? 56 : size === 'sm' ? 24 : 32;
  if (club?.logoUrl) return <img src={club.logoUrl} alt="" width={px} height={px} className={`${box} shrink-0 object-contain`} loading="lazy" decoding="async" />;
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
    return <span className="font-semibold text-ink-2">{fixture.pens ? 'Final · pen.' : 'Final'}</span>;
  }
  if (STATUS[fixture.status]) return <span className={STATUS[fixture.status].className}>{STATUS[fixture.status].label}</span>;
  const when = formatFixtureDate(fixture);
  return <span className="text-ink-2">{when || 'A confirmar'}</span>;
}

function TeamLine({ team, club, score, pens, outcome }) {
  // El que perdió no se apaga en gris: se lee igual de claro, solo el ganador va en negrita.
  const tone = outcome === 'win' ? 'font-bold text-ink' : 'font-medium text-ink';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LeagueCrest name={team.name} club={club} size="sm" />
      <span className={`min-w-0 flex-1 truncate ${tone}`} title={team.name}>{team.name}</span>
      {/* Penales al lado del marcador, como en los centros de partidos: «1 (5)». */}
      {pens != null && <span className={`num text-sm ${outcome === 'win' ? 'font-bold text-ink' : 'text-ink-2'}`} aria-label={`${pens} en los penales`}>({pens})</span>}
      {score != null && <span className={`num w-6 text-right font-display text-lg ${outcome === 'win' ? 'font-bold text-ink' : 'text-ink'}`}>{score}</span>}
    </div>
  );
}

/** «Fecha 2», o la competición y la ronda en las copas: de qué fecha es cada partido, arriba del estado. */
function RoundCell({ fixture }) {
  return (
    <span className="mb-1 block">
      {fixture.competition !== 'liga' && <span className="block text-xs font-semibold text-ink-2">{fixture.competitionLabel}</span>}
      <span className="block font-display text-base font-bold uppercase leading-tight text-ink">{fixture.roundLabel}</span>
    </span>
  );
}

/** Un partido definido por penales: quién ganó y cómo, en una línea que se ve. */
function ShootoutLine({ fixture }) {
  if (!fixture.pens) return null;
  const winner = fixture.winner === 'home' ? fixture.home.name : fixture.winner === 'away' ? fixture.away.name : '';
  const [hi, lo] = fixture.winner === 'away' ? [fixture.pens.away, fixture.pens.home] : [fixture.pens.home, fixture.pens.away];
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
      <span className="h-3.5 w-1 shrink-0 rounded bg-accent" aria-hidden="true" />
      {winner ? <>Ganó {winner} por penales <span className="num">{hi}-{lo}</span></> : <>Penales <span className="num">{fixture.pens.home}-{fixture.pens.away}</span></>}
    </p>
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
        {showCompetition && <RoundCell fixture={fixture} />}
        <StatusCell fixture={fixture} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <TeamLine team={fixture.home} club={clubOf(fixture.home.name)} score={score?.home} pens={fixture.pens?.home} outcome={outcome('home')} />
        <TeamLine team={fixture.away} club={clubOf(fixture.away.name)} score={score?.away} pens={fixture.pens?.away} outcome={outcome('away')} />
        <ShootoutLine fixture={fixture} />
        {fixture.status === 'played' && <p className="text-sm text-ink-2">Resultado a confirmar</p>}
      </div>
      {href ? <ChevronRight className="mt-1 h-4 w-4 text-ink-3" aria-hidden="true" /> : <span aria-hidden="true" />}
    </>
  );
  const rowClass = `grid grid-cols-[6.5rem_minmax(0,1fr)_1rem] items-start gap-3 px-4 py-3 ${fixture.status === 'live' ? 'bg-danger/[0.05]' : ''}`;
  return (
    <li>
      {href
        ? <Link to={href} className={`${rowClass} min-h-11 transition-colors hover:bg-white/[0.03]`}>{body}</Link>
        : <div className={rowClass}>{body}</div>}
      {action && <div className="px-4 pb-3 pl-[8rem]">{action}</div>}
    </li>
  );
}
