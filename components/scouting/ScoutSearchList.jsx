import React, { useMemo, useState } from 'react';
import { Clock, Search, Star, Trash2, UserPlus } from 'lucide-react';
import { formatPriceShort, getFlagUrl, getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { getTimeLeft, resultStatus, splitSearches, VISIBLE_DONE_SEARCHES } from '../../utils/scoutView.js';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';

function ScoutResultCard({ player, status, isWatchlisted, onAddToWatchlist, onPlayerClick }) {
  const ovr = player.OVR_CALCULADO || 0;
  return (
    <li className="rounded-xl border border-line/[0.12] bg-raised p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img src={`/fotos_jugadores/${player.Id}.webp`} alt="" width={48} height={48}
          className="w-12 h-12 rounded-lg object-cover object-top bg-surface flex-shrink-0"
          onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{player.Name}</p>
          <p className="flex items-center gap-2 mt-1 text-xs text-ink-3">
            <span className={`px-1.5 rounded text-2xs font-bold ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
            <img src={getFlagUrl(player.Country1)} alt="" width={16} height={12} className="w-4 h-3 rounded-[2px]" onError={e => { e.currentTarget.style.display = 'none'; }} />
            {player.Age} años
          </p>
          {player.PlayingStyle && player.PlayingStyle !== 'Ninguno' && (
            <p className="mt-0.5 text-2xs text-ink-3 truncate">{player.PlayingStyle}</p>
          )}
        </div>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-display num text-base font-bold shrink-0 ${getStatAndOvrColorClass(ovr)}`}>{ovr}</span>
      </div>
      <p className="flex items-center justify-between gap-2 text-xs text-ink-3 border-t border-line/[0.07] pt-2.5">
        <span>Velocidad <span className="num font-semibold text-ink-2">{player.Speed || '-'}</span></span>
        <span>Finalización <span className="num font-semibold text-ink-2">{player.Finishing || '-'}</span></span>
        <span className="num font-semibold text-ink">{formatPriceShort(status.price)}</span>
      </p>
      {status.signed && (
        <p className="text-xs font-semibold text-warning-soft">
          {status.signedByMe ? 'Ya está en tu club' : 'Ya fichado por otro club'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 mt-auto">
        <button type="button" disabled={isWatchlisted} onClick={() => onAddToWatchlist(player.Id)} aria-pressed={Boolean(isWatchlisted)}
          title={isWatchlisted ? 'Ya está en tus favoritos' : undefined} className="btn btn-secondary btn-sm min-h-11">
          <Star className="w-3.5 h-3.5" fill={isWatchlisted ? 'currentColor' : 'none'} aria-hidden="true" />
          {isWatchlisted ? 'En favoritos' : 'Favorito'}
        </button>
        <button type="button" onClick={() => onPlayerClick(player)} className="btn btn-primary btn-sm min-h-11">
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />{status.signed ? 'Ver jugador' : 'Ver y negociar'}
        </button>
      </div>
    </li>
  );
}

/** «Mis búsquedas»: searches in progress, then the latest finished ones with «Ver más». */
export function ScoutSearchList({
  searches, isLoading, hasError, userId, allPlayers, playerLocks, wishlistSet, onDismiss, onAddToWatchlist, onPlayerClick,
}) {
  const [showAll, setShowAll] = useState(false);
  const priceById = useMemo(() => new Map((allPlayers || []).map(player => [String(player.Id), player.Precio])), [allPlayers]);
  const { visible, hiddenCount } = splitSearches(searches, VISIBLE_DONE_SEARCHES, showAll);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="sr-only" role="status">Cargando tus búsquedas</p>
        <div className="space-y-3" aria-hidden="true">{[0, 1].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      </div>
    );
  }
  if (hasError) return null;
  if (searches.length === 0) {
    return <EmptyState icon={Search} title="Todavía no mandaste ningún ojeador" description="Elegí los criterios en «Nueva búsqueda» y enviá a un ojeador a buscar." />;
  }

  return (
    <div className="space-y-4">
      {visible.map(search => (
        <article key={search.id} className="panel-flat overflow-hidden" aria-label={`Búsqueda de ${search.scoutName || 'ojeador'}`}>
          <header className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-line/[0.08]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{search.scoutName || 'Ojeador'} <span className="text-ink-3 font-normal">· calidad <span className="num">{search.scoutQuality || '-'}</span></span></p>
              <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${search.status === 'done' ? 'text-success-soft' : 'text-ink-3'}`}>
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {search.status === 'searching' ? getTimeLeft(search.resolvesAt) : search.status === 'done' ? 'Resultados listos' : 'Descartada'}
              </p>
            </div>
            {search.status !== 'dismissed' && (
              <button type="button" onClick={() => onDismiss(search.id)} className="btn btn-ghost btn-sm min-h-11 text-danger-soft hover:text-danger-soft">
                <Trash2 className="w-4 h-4" aria-hidden="true" />Descartar
              </button>
            )}
          </header>

          {search.status === 'done' && (search.results || []).length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
              {search.results.map(player => (
                <ScoutResultCard
                  key={player.Id}
                  player={player}
                  status={resultStatus(player, playerLocks, userId, priceById)}
                  isWatchlisted={wishlistSet?.has(player.Id)}
                  onAddToWatchlist={onAddToWatchlist}
                  onPlayerClick={onPlayerClick}
                />
              ))}
            </ul>
          )}
        </article>
      ))}
      {hiddenCount > 0 && (
        <Button variant="secondary" className="w-full min-h-11" onClick={() => setShowAll(true)}>
          Ver más ({hiddenCount})
        </Button>
      )}
    </div>
  );
}
