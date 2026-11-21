import React from 'react';
import { Link } from 'react-router-dom';
import { PlayerPhoto } from '../match/MatchDetailViews.jsx';
import { RatingChip } from '../match/MatchParts.jsx';
import { catalogEntry } from '../../../hooks/useSeasonStats.js';

/* Piezas de las estadísticas de temporada (/estadisticas y /jugadores/:id). */

// Campos que son porcentajes (utils/seasonStats.js finishPlayer).
const PERCENT_FIELDS = new Set(['shotConversion', 'passAccuracy']);

/** Nombre del jugador: el del juego (match_lines), si no el del catálogo, si no su id. */
export function playerDisplayName(player, catalog) {
  return player?.name || catalogEntry(catalog, player?.id)?.name || `Jugador ${player?.id}`;
}

/** Valor de una tabla: la valoración va en su pastilla, el resto como número grande. */
export function LeaderValue({ field, value, size = 'md' }) {
  if (field === 'rating') return <RatingChip value={value} size={size === 'lg' ? 'lg' : 'sm'} />;
  const text = size === 'lg' ? 'text-5xl' : 'text-xl';
  return (
    <span className={`num font-display font-bold leading-none text-ink ${text}`}>
      {value}{PERCENT_FIELDS.has(field) && <span className="ml-0.5 text-[0.6em] text-ink-2">%</span>}
    </span>
  );
}

/** Una fila de tabla de líderes: puesto, foto, nombre y club, valor. Toda la fila lleva a la ficha del jugador.
    hideClub: en la página de un club todos son de ese club. */
export function SeasonLeaderRow({ player, rank, field, catalog, hideClub = false }) {
  return (
    <li>
      <Link to={`/jugadores/${player.id}`} className="flex min-h-11 items-center gap-3 py-1.5 transition-colors hover:bg-white/[0.03]">
        <span className="num w-4 shrink-0 text-sm text-ink-3">{rank}</span>
        <PlayerPhoto id={player.id} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{playerDisplayName(player, catalog)}</span>
          {player.clubName && !hideClub && <span className="block truncate text-xs text-ink-3">{player.clubName}</span>}
        </span>
        <LeaderValue field={field} value={player[field]} />
      </Link>
    </li>
  );
}
