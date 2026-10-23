import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getPosColorClass } from '../../../utils/helpers.js';
import { roleLabel } from '../../../utils/matchAnalysis.js';
import { formatStat, playerLeaders, playerProfile } from '../../../utils/matchStats.js';
import { PlayerPhoto } from './MatchDetailViews.jsx';

/* Pestaña Jugadores: lista de los dos equipos, ficha del elegido y los que más hicieron cada cosa. Datos:
   utils/matchStats.js. Debajo de lg es maestro → detalle (lista, luego la ficha con «volver»). */

function PositionChip({ position }) {
  const label = roleLabel(position);
  if (!label) return null;
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${getPosColorClass(label)}`} title="Posición registrada">{label}</span>;
}

function PlayerList({ rows, match, summary, selected, onSelect }) {
  return (
    <div className="space-y-4">
      {['home', 'away'].map(side => (
        <section key={side} aria-label={match[side].name}>
          <h3 className="section-title mb-1 truncate">{match[side].name}</h3>
          <ul className="divide-y divide-line/10">
            {rows.filter(row => row.side === side).map(row => {
              const isSelected = selected?.side === side && selected.id === row.id;
              return (
                <li key={row.id}>
                  <button type="button" onClick={() => onSelect({ side, id: row.id })} aria-current={isSelected ? 'true' : undefined}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/[0.03] ${isSelected ? 'bg-overlay' : ''}`}>
                    <span className="num w-6 shrink-0 text-right text-xs text-ink-3">{summary.teamPlans?.[side]?.numbers?.[row.id] ?? ''}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{row.name}</span>
                    <PositionChip position={summary.names?.positions?.[row.id]} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Profile({ profile, match, onBack }) {
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm min-h-11 -ml-2 lg:hidden">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Jugadores
      </button>
      <header className="flex items-center gap-3">
        <PlayerPhoto id={profile.id} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl font-bold text-ink">{profile.name}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
            <span>{match[profile.side].name}</span>
            {profile.number != null && <span className="num">· #{profile.number}</span>}
            <PositionChip position={profile.position} />
          </p>
        </div>
        <div className="text-right">
          <span className="num block font-display text-2xl font-bold text-ink">{profile.minutes ?? '—'}</span>
          <span className="text-xs text-ink-3">minutos</span>
        </div>
      </header>
      {!profile.hasStats && <p className="text-sm text-ink-3">El juego todavía no registró nada de este jugador.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {profile.groups.map(group => (
          <section key={group.title} aria-label={group.title}>
            <h4 className="eyebrow mb-1">{group.title}</h4>
            <dl className="divide-y divide-line/10">
              {group.rows.map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <dt className="text-ink-2">{row.label}</dt>
                  <dd className="num font-semibold text-ink">{formatStat(row.value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {profile.shots.length > 0 && (
        <section aria-label="Tiros">
          <h4 className="eyebrow mb-1">Tiros</h4>
          <ul className="text-sm">
            {profile.shots.map(shot => (
              <li key={shot.index} className="flex justify-between gap-3 py-1">
                <span className="num text-ink-2">{shot.minute}</span>
                <span className="text-ink">{shot.outcomeLabel}{shot.penalty ? ' (penal)' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-ink-3">Sin calificación: el juego no la deja leer y no se inventa. Los minutos se calculan con los cambios y las rojas.</p>
    </div>
  );
}

function Leaders({ summary, match }) {
  const leaders = playerLeaders(summary);
  if (!leaders.length) return null;
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="leaders-title">
      <h3 id="leaders-title" className="section-title mb-3">Los que más</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {leaders.map(stat => (
          <div key={stat.key}>
            <h4 className="eyebrow mb-1">{stat.label}</h4>
            <ol className="text-sm">
              {stat.players.map(player => (
                <li key={`${player.side}:${player.id}`} className="flex items-center justify-between gap-2 py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${player.side === 'home' ? 'bg-accent' : 'bg-ink-3'}`} aria-label={match[player.side].name} />
                    <span className="truncate text-ink">{player.name}</span>
                  </span>
                  <span className="num font-semibold text-ink">{player.value}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlayerAnalysis({ rows, summary, match }) {
  const [selected, setSelected] = useState(null);
  if (!rows.length) return <p className="panel px-4 py-8 text-center text-sm text-ink-3">Las estadísticas de los jugadores aparecen al arrancar el partido.</p>;
  const current = selected || { side: rows[0].side, id: rows[0].id };
  const profile = playerProfile(summary, current.side, current.id);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <div className={`panel p-3 ${selected ? 'hidden lg:block' : ''}`}>
          <PlayerList rows={rows} match={match} summary={summary} selected={current} onSelect={setSelected} />
        </div>
        <div className={`panel p-4 sm:p-5 ${selected ? '' : 'hidden lg:block'}`}>
          <Profile profile={profile} match={match} onBack={() => setSelected(null)} />
        </div>
      </div>
      <Leaders summary={summary} match={match} />
    </div>
  );
}
