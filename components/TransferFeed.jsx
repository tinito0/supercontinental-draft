import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, History, Star, TrendingUp, X } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { APP_ID } from '../utils/constants.js';
import { formatPriceShort } from '../utils/helpers.js';
import { TransferPlayerCard } from './TransferPlayerCard.jsx';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';

function getTransferTime(timestamp) {
  return timestamp?.toDate
    ? new Date(timestamp.toDate()).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : 'Recién';
}

function getInitials(teamName) {
  return String(teamName || '??')
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

const TeamVisual = memo(function TeamVisual({ teamId, teamName, allTeams }) {
  const team = allTeams?.[teamId];
  if (team?.logoUrl) {
    return (
      <span className="relative w-5 h-5 rounded-full bg-raised overflow-hidden flex-shrink-0 border border-line/20">
        <img
          src={team.logoUrl}
          alt=""
          loading="lazy"
          width={20}
          height={20}
          className="w-full h-full object-contain"
          onError={event => { event.currentTarget.style.display = 'none'; }}
        />
      </span>
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center text-[8px] font-bold text-accent flex-shrink-0 border border-accent/20">
      {getInitials(teamName)}
    </span>
  );
});

const TransferSkeleton = memo(function TransferSkeleton() {
  return (
    <div className="rounded-xl bg-surface/60 p-3.5 animate-pulse border border-line/15">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg bg-raised" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-raised" />
          <div className="h-2.5 w-1/2 rounded bg-raised/70" />
        </div>
        <div className="h-6 w-14 rounded bg-raised" />
      </div>
      <div className="mt-3 h-8 rounded-lg bg-raised/50" />
    </div>
  );
});

const TransferCard = memo(function TransferCard({ transfer, isReleased, allTeams }) {
  if (transfer.type === 'match_result') {
    return (
      <article className="relative overflow-hidden rounded-xl border border-success/20 bg-emerald-950/20 p-3.5">
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-success-soft">
          <span>Resultado Final</span>
          <span>{transfer.round || 'Torneo'}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <span className="truncate text-xs font-bold text-ink-2">{transfer.homeTeam}</span>
          <strong className="rounded-lg bg-success/20 px-2.5 py-1 text-sm font-bold text-success-soft tabular-nums">
            {transfer.homeScore} - {transfer.awayScore}
          </strong>
          <span className="truncate text-xs font-bold text-ink-2">{transfer.awayTeam}</span>
        </div>
        {transfer.mvp && <p className="mt-2 text-center text-[11px] font-medium text-warning-soft">MVP: {transfer.mvp}</p>}
      </article>
    );
  }

  const isFranchise = transfer.isFranchise === true;
  const isTransfer = transfer.type === 'transfer';
  const time = getTransferTime(transfer.timestamp);

  if (isTransfer && !isReleased) {
    return <TransferPlayerCard transfer={transfer} allTeams={allTeams} compact />;
  }

  const borderLeftTone = isReleased
    ? 'border-l-rose-500'
    : isTransfer
    ? 'border-l-accent'
    : isFranchise
    ? 'border-l-amber-500'
    : 'border-l-accent-soft';

  return (
    <article
      className={`group rounded-xl p-3.5 border border-line/[0.12] border-l-[3px] ${borderLeftTone} transition-all duration-200 bg-surface shadow-sm hover:shadow ${
        isReleased ? 'opacity-60 line-through' : ''
      }`}
      style={isReleased ? { animation: 'transferFeedFadeOut 5s ease-out forwards' } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-lg bg-raised overflow-hidden flex-shrink-0 border border-line/20">
            <img
              src={`/fotos_jugadores/${transfer.playerId}.webp`}
              alt={transfer.playerName}
              loading="lazy"
              className="w-full h-full object-cover object-top"
              onError={(event) => {
                event.currentTarget.src = playerPlaceholder(transfer.playerName?.charAt(0) || '?');
              }}
            />
          </div>
          <div className="min-w-0">
            <h4 className={`text-xs font-bold leading-snug truncate ${isReleased ? 'text-ink-3 line-through' : ' text-ink'}`}>
              {transfer.playerName}
            </h4>
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isTransfer ? ' text-accent-soft' : isFranchise ? ' text-warning-soft' : ' text-accent'
              }`}>
                {isTransfer ? 'Traspaso' : isFranchise ? 'Franquicia' : 'Fichaje'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-ink-3 font-medium">
                <Clock className="w-3 h-3" /> {time}
              </span>
            </div>
          </div>
        </div>

        {isReleased ? (
          <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-danger/10 text-danger-soft border border-danger/20">
            Liberado
          </span>
        ) : isFranchise ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-warning/10 text-warning-soft border border-warning/20">
            <Star className="w-3 h-3" fill="currentColor" /> Gratis
          </span>
        ) : (
          <span className="shrink-0 rounded px-2 py-0.5 text-xs font-bold bg-success/10 text-success-soft border border-success/20 tabular-nums">
            {formatPriceShort(transfer.price)}
          </span>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-surface/60 px-2.5 py-1.5 border border-line/15">
        {isTransfer ? (
          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <TeamVisual teamId={transfer.fromTeamId} teamName={transfer.fromTeamName} allTeams={allTeams} />
            <span className="min-w-0 truncate font-medium text-ink-3">{transfer.fromTeamName}</span>
            <ArrowRight className="w-3 h-3 text-ink-3 flex-shrink-0" />
            <TeamVisual teamId={transfer.teamId} teamName={transfer.teamName} allTeams={allTeams} />
            <span className="min-w-0 truncate font-semibold text-ink">{transfer.teamName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <TeamVisual teamId={transfer.teamId} teamName={transfer.teamName} allTeams={allTeams} />
            <p className="min-w-0 truncate text-ink-3">
              Fichado por <span className="font-semibold text-ink">{transfer.teamName}</span>
            </p>
          </div>
        )}
      </div>
    </article>
  );
});

export const TransferFeed = memo(function TransferFeed({ db, isVisible, shouldPrefetch = false, onClose, playerLocks, allTeams }) {
  const [transfers, setTransfers] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [releasedIds, setReleasedIds] = useState(() => new Set());
  const releaseTimersRef = useRef({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isVisible && !shouldPrefetch) return undefined;

    const transfersRef = collection(db, `artifacts/${APP_ID}/public/data/transfers`);
    const q = query(transfersRef, orderBy('timestamp', 'desc'), limit(30));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const seen = new Map();
      const deduped = [];
      snapshot.docs.forEach(docSnap => {
        const transfer = { id: docSnap.id, ...docSnap.data() };
        const ts = transfer.timestamp?.toDate?.() ? transfer.timestamp.toDate().getTime() : 0;
        const key = `${transfer.playerId}_${transfer.teamId}_${transfer.type || 'signing'}`;
        const previous = seen.get(key);
        if (previous && Math.abs(ts - previous) < 60000) return;
        seen.set(key, ts);
        deduped.push(transfer);
      });
      setTransfers(deduped.slice(0, 20));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching transfers:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isVisible, shouldPrefetch]);

  useEffect(() => {
    if (!isVisible && !shouldPrefetch) return undefined;
    const newsRef = collection(db, `artifacts/${APP_ID}/public/data/news`);
    const unsubscribe = onSnapshot(query(newsRef, orderBy('publishedAt', 'desc'), limit(20)), snapshot => {
      setNews(snapshot.docs.map(docSnap => ({ id: `news-${docSnap.id}`, ...docSnap.data(), timestamp: docSnap.data().publishedAt })));
    }, error => console.error('Error fetching live news:', error));
    return () => unsubscribe();
  }, [db, isVisible, shouldPrefetch]);

  useEffect(() => {
    return () => {
      Object.values(releaseTimersRef.current).forEach(clearTimeout);
      releaseTimersRef.current = {};
    };
  }, []);

  const visibleTransfers = useMemo(() => [...transfers, ...news].sort((a, b) => {
    const aTime = a.timestamp?.toDate?.()?.getTime?.() || 0;
    const bTime = b.timestamp?.toDate?.()?.getTime?.() || 0;
    return bTime - aTime;
  }).filter(transfer => {
    if (filter === 'transfers') return transfer.type === 'transfer';
    if (filter === 'signings') return transfer.type !== 'transfer' && transfer.type !== 'match_result';
    if (filter === 'matches') return transfer.type === 'match_result';
    return true;
  }), [filter, news, transfers]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center sm:justify-end z-[70] animate-in fade-in" onClick={onClose}>
      <div
        className="w-full sm:max-w-md h-[100dvh] sm:h-full bg-surface flex flex-col shadow-2xl border-l border-line/20 animate-in slide-in-from-right"
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-line/20 flex items-center justify-between bg-surface/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 text-accent">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink tracking-tight">Centro de Traspasos</h2>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-danger/10 text-danger-soft border border-danger/20">
                  En Vivo
                </span>
              </div>
              <p className="text-xs text-ink-3 font-medium">Últimos movimientos del mercado</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar centro de traspasos"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-raised transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="shrink-0 flex gap-1.5 px-4 py-2.5 sm:px-5 border-b border-line/15 bg-surface/20" role="tablist" aria-label="Filtrar movimientos">
          {[
            ['all', 'Todo'],
            ['transfers', 'Traspasos'],
            ['signings', 'Fichajes'],
            ['matches', 'Partidos'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`min-h-8 rounded-lg px-3 text-xs font-semibold transition cursor-pointer ${
                filter === id
                  ? ' bg-white text-slate-950 shadow-sm'
                  : ' text-ink-3 hover:bg-raised'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List Content */}
        <div
          role="feed"
          aria-label="Movimientos del mercado"
          aria-live="polite"
          className="flex-grow min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2.5"
        >
          {loading ? (
            <>
              {[0, 1, 2, 3].map(item => <TransferSkeleton key={item} />)}
            </>
          ) : visibleTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8 space-y-3 opacity-60">
              <History size={40} className="text-ink-3" />
              <p className="text-sm font-semibold text-ink-2">Aún no hay movimientos en este mercado.</p>
              <p className="text-xs text-ink-3">Cuando haya fichajes o traspasos, aparecerán aquí.</p>
            </div>
          ) : (
            visibleTransfers.map(transfer => (
              <TransferCard
                key={transfer.id}
                transfer={transfer}
                isReleased={releasedIds.has(transfer.id)}
                allTeams={allTeams}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 bg-surface/40 border-t border-line/20 text-center pb-[max(12px,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-ink-3 font-medium">
            Supercontinental League • Mercado Oficial
          </p>
        </div>
      </div>

      <style>{`
        @keyframes transferFeedFadeOut {
          0% { opacity: 0.6; max-height: 200px; }
          80% { opacity: 0.15; max-height: 200px; }
          100% { opacity: 0; max-height: 0; padding: 0; margin: 0; border: none; overflow: hidden; }
        }
      `}</style>
    </div>
  );
});
