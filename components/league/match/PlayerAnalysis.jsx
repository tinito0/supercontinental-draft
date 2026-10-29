import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getPosColorClass } from '../../../utils/helpers.js';
import { roleLabel } from '../../../utils/matchAnalysis.js';
import { bestRated, formatStat, playerLeaders, playerProfile } from '../../../utils/matchStats.js';
import { PlayerPhoto } from './MatchDetailViews.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { RatingChip } from './MatchParts.jsx';
import { Heatmap } from './Heatmap.jsx';

/* Pestaña Jugadores: la lista de un equipo por vez (selector arriba) y, al lado, la ficha del elegido y los que más
   hicieron cada cosa. Datos: utils/matchStats.js. Debajo de lg es maestro → detalle
   (lista, luego la ficha con «volver»). */

function PositionChip({ position }) {
  const label = roleLabel(position);
  if (!label) return null;
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${getPosColorClass(label)}`} title="Posición registrada">{label}</span>;
}

function PlayerList({ rows, match, summary, selected, onSelect, side, onSide }) {
  const teams = ['home', 'away'].map(id => ({ id, label: match[id].name }));
  const best = bestRated(summary);
  return (
    <div className="space-y-3">
      <Tabs tabs={teams} value={side} onChange={onSide} label="Equipo" className="w-full" />
      <ul className="divide-y divide-line/10" aria-label={`Jugadores de ${match[side].name}`}>
        {rows.filter(row => row.side === side).map(row => {
          const isSelected = selected?.side === side && selected.id === row.id;
          return (
            <li key={row.id}>
              <button type="button" onClick={() => onSelect({ side, id: row.id })} aria-current={isSelected ? 'true' : undefined}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/[0.03] ${isSelected ? 'bg-overlay' : ''}`}>
                <span className="num w-6 shrink-0 text-right text-sm text-ink-2">{summary.teamPlans?.[side]?.numbers?.[row.id] ?? ''}</span>
                <span className="min-w-0 flex-1 truncate text-base text-ink">{row.name}</span>
                <PositionChip position={summary.names?.positions?.[row.id]} />
                <RatingChip value={row.rating} isBest={best.includes(row.id)} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Profile({ profile, match, heatmaps, onBack }) {
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm min-h-11 -ml-2 lg:hidden">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Jugadores
      </button>
      <header className="flex items-center gap-4 border-b border-line/10 pb-4">
        <PlayerPhoto id={profile.id} size={72} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-2xl font-bold uppercase leading-tight text-ink">{profile.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
            <span>{match[profile.side].name}</span>
            {profile.number != null && <span className="num">· #{profile.number}</span>}
            <PositionChip position={profile.position} />
          </p>
        </div>
        {profile.rating != null && (
          <div className="flex flex-col items-end gap-1">
            <RatingChip value={profile.rating} isBest={profile.isBest} size="lg" />
            <span className="text-sm text-ink-2">{profile.isBest ? 'la mejor nota' : 'nota del juego'}</span>
          </div>
        )}
        <div className="text-right">
          <span className="num block font-display text-4xl font-bold leading-none text-ink">{profile.minutes ?? '—'}</span>
          <span className="text-sm text-ink-2">minutos</span>
        </div>
      </header>
      {!profile.hasStats && <p className="text-sm text-ink-3">El juego todavía no registró nada de este jugador.</p>}
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {profile.groups.map(group => (
          <section key={group.title} aria-label={group.title}>
            <h4 className="eyebrow mb-1">{group.title}</h4>
            <dl className="divide-y divide-line/10">
              {group.rows.map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 py-2 text-base">
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
      {profile.heat && heatmaps && (
        <section aria-label="Mapa de calor">
          <h4 className="eyebrow mb-1">Mapa de calor</h4>
          <Heatmap cells={profile.heat} cols={heatmaps.cols} rows={heatmaps.rows} label={`Mapa de calor de ${profile.name}`} />
        </section>
      )}
      <p className="text-sm text-ink-2">
        {profile.rating == null ? 'Sin valoración: el partido se grabó antes de leerla. ' : ''}
        {profile.heat ? 'El mapa sale de las posiciones que el juego actualiza cada 2 o 3 segundos: muestra por dónde anduvo, no cada paso. ' : ''}
        Los minutos se calculan con los cambios y las rojas.
      </p>
    </div>
  );
}

function Leaders({ summary, match, className = '' }) {
  const leaders = playerLeaders(summary);
  if (!leaders.length) return null;
  return (
    <section className={`panel p-4 sm:p-5 ${className}`} aria-label="Los que más">
      <h3 className="section-title mb-3">Los que más</h3>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
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
  const [side, setSide] = useState(null);
  if (!rows.length) return <p className="panel px-4 py-8 text-center text-sm text-ink-3">Las estadísticas de los jugadores aparecen al arrancar el partido.</p>;
  const current = selected || { side: rows[0].side, id: rows[0].id };
  const profile = playerProfile(summary, current.side, current.id);
  const listSide = side || current.side;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div className={`panel p-3 ${selected ? 'hidden lg:block' : ''}`}>
          <PlayerList rows={rows} match={match} summary={summary} selected={current} onSelect={setSelected} side={listSide} onSide={setSide} />
        </div>
        {/* Escritorio: la ficha y «Los que más» comparten la columna de la derecha, al lado de la lista. */}
        <div className="space-y-4">
          <div className={`panel p-5 sm:p-6 ${selected ? '' : 'hidden lg:block'}`}>
            <Profile profile={profile} match={match} heatmaps={summary.heatmaps} onBack={() => setSelected(null)} />
          </div>
          <Leaders summary={summary} match={match} className="hidden lg:block" />
        </div>
      </div>
      <Leaders summary={summary} match={match} className="lg:hidden" />
    </div>
  );
}
