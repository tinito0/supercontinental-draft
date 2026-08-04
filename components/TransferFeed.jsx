import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, History, Star, TrendingUp, X } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { APP_ID } from '../utils/constants.js';
import { formatPriceShort } from '../utils/helpers.js';
import { TransferPlayerCard } from './TransferPlayerCard.jsx';

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
      <span className="relative w-6 h-6 rounded-full bg-black/35 overflow-hidden flex-shrink-0 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.14)]">
        <img
          src={team.logoUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          onError={event => { event.currentTarget.style.display = 'none'; }}
        />
      </span>
    );
  }
  return (
    <span className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center text-[8px] font-black text-blue-200 flex-shrink-0 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.14)]">
      {getInitials(teamName)}
    </span>
  );
});

const TransferSkeleton = memo(function TransferSkeleton() {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 animate-pulse shadow-[inset_0_0_0_1px_rgba(59,130,246,0.06)]">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/8" />
        </div>
        <div className="h-7 w-16 rounded-lg bg-white/10" />
      </div>
      <div className="mt-4 h-9 rounded-xl bg-white/8" />
    </div>
  );
});

const TransferCard = memo(function TransferCard({ transfer, isReleased, allTeams }) {
  if (transfer.type === 'match_result') {
    return (
      <article className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-emerald-950/15 p-4 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.04)]">
        <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-emerald-300"><span>Resultado final</span><span>{transfer.round || 'Torneo'}</span></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <span className="truncate text-sm font-black uppercase text-white">{transfer.homeTeam}</span>
          <strong className="rounded-xl bg-black/30 px-3 py-2 text-xl font-black text-emerald-300">{transfer.homeScore} - {transfer.awayScore}</strong>
          <span className="truncate text-sm font-black uppercase text-white">{transfer.awayTeam}</span>
        </div>
        {transfer.mvp && <p className="mt-3 text-center text-xs font-bold text-yellow-300">MVP: {transfer.mvp}</p>}
      </article>
    );
  }
  const isFranchise = transfer.isFranchise === true;
  const isTransfer = transfer.type === 'transfer';
  const time = getTransferTime(transfer.timestamp);
  const accent = isReleased ? 'bg-red-500/50' : isTransfer ? 'bg-purple-500/70' : isFranchise ? 'bg-yellow-500/70' : 'bg-blue-500/60';

  if (isTransfer && !isReleased) {
    return <TransferPlayerCard transfer={transfer} allTeams={allTeams} compact />;
  }

  return (
    <article
      className={`group rounded-2xl p-4 transition-all duration-300 relative overflow-hidden ${
        isReleased
          ? 'bg-white/[0.015] opacity-55 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.08)]'
          : 'bg-white/[0.035] hover:bg-white/[0.065] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.06)] hover:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]'
      }`}
      style={isReleased ? { animation: 'transferFeedFadeOut 5s ease-out forwards' } : undefined}
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-950 overflow-hidden flex-shrink-0 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]">
            <img
              src={`/fotos_jugadores/${transfer.playerId}.webp`}
              alt={transfer.playerName}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(event) => {
                event.currentTarget.src = `https://placehold.co/48x48/111/333?text=${transfer.playerName?.charAt(0) || '?'}`;
              }}
            />
          </div>
          <div className="min-w-0">
            <h4 className={`text-sm font-black leading-tight truncate ${isReleased ? 'text-gray-600 line-through' : 'text-white group-hover:text-blue-200'}`}>
              {transfer.playerName}
            </h4>
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wide ${
                isTransfer ? 'text-purple-300' : isFranchise ? 'text-yellow-300' : 'text-blue-300'
              }`}>
                {isTransfer ? 'Traspaso' : isFranchise ? 'Franquicia' : 'Fichaje'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                <Clock className="w-3 h-3" /> {time}
              </span>
            </div>
          </div>
        </div>

        {isReleased ? (
          <span className="shrink-0 rounded-lg bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-red-300 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.12)]">
            Liberado
          </span>
        ) : isFranchise ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-yellow-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-yellow-300 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.12)]">
            <Star className="w-3 h-3" fill="currentColor" /> Gratis
          </span>
        ) : (
          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-black ${
            isTransfer
              ? 'bg-purple-500/10 text-purple-300 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]'
              : 'bg-emerald-500/10 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]'
          }`}>
            {formatPriceShort(transfer.price)}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-black/18 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
        {isTransfer ? (
          <div className="flex items-center gap-2 min-w-0">
            <TeamVisual teamId={transfer.fromTeamId} teamName={transfer.fromTeamName} allTeams={allTeams} />
            <span className="min-w-0 truncate text-[11px] font-black uppercase text-gray-500">{transfer.fromTeamName}</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
            <TeamVisual teamId={transfer.teamId} teamName={transfer.teamName} allTeams={allTeams} />
            <span className="min-w-0 truncate text-[11px] font-black uppercase text-gray-200">{transfer.teamName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <TeamVisual teamId={transfer.teamId} teamName={transfer.teamName} allTeams={allTeams} />
            <p className="min-w-0 truncate text-[11px] text-gray-400">
              Fichado por <span className="font-black uppercase text-gray-200">{transfer.teamName}</span>
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
    // A market event is historical news. A later sale must not make the
    // original signing disappear from the live feed.
    return undefined;

    const newlyReleased = [];
    transfers.forEach(transfer => {
      const lock = playerLocks[transfer.playerId];
      const isStillLocked = lock && lock.lockedBy === transfer.teamId;
      if (!isStillLocked && !releasedIds.has(transfer.id)) {
        newlyReleased.push(transfer.id);
      }
    });

    if (newlyReleased.length > 0) {
      setReleasedIds(prev => {
        const next = new Set(prev);
        newlyReleased.forEach(id => next.add(id));
        return next;
      });
    }

    newlyReleased.forEach(id => {
      if (releaseTimersRef.current[id]) return;
      releaseTimersRef.current[id] = setTimeout(() => {
        setTransfers(prev => prev.filter(transfer => transfer.id !== id));
        setReleasedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        delete releaseTimersRef.current[id];
      }, 5000);
    });

    return undefined;
  }, [playerLocks, releasedIds, transfers]);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end sm:items-center sm:justify-end z-[70] animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="w-full sm:max-w-md h-[100dvh] sm:h-full bg-[#090b0f] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={event => event.stopPropagation()}
      >
        <div className="shrink-0 p-4 sm:p-6 bg-gradient-to-r from-blue-900/20 to-transparent flex items-center justify-between shadow-[0_1px_0_rgba(59,130,246,0.08)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-600/16 flex items-center justify-center flex-shrink-0 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.14)]">
              <TrendingUp className="w-5 h-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white tracking-tight uppercase">Noticias en Vivo</h2>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Últimos movimientos</p>
            </div>
          </div>
          <button onClick={onClose} className="min-w-11 min-h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition">
            <X size={20} />
          </button>
        </div>

        <div className="shrink-0 flex gap-2 px-4 pb-3 sm:px-6">
          {[
            ['all', 'Todo'],
            ['transfers', 'Traspasos'],
            ['signings', 'Fichajes'],
            ['matches', 'Partidos'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide transition ${filter === id ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-3">
          {loading ? (
            <>
              {[0, 1, 2, 3].map(item => <TransferSkeleton key={item} />)}
            </>
          ) : visibleTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8 space-y-4 opacity-55">
              <History size={48} className="text-gray-600" />
              <p className="text-gray-400 font-bold">Aún no hay movimientos en este mercado.</p>
              <p className="text-xs text-gray-600">Cuando haya fichajes o traspasos, aparecen acá.</p>
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

        <div className="shrink-0 p-4 sm:p-5 bg-black/20 text-center pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-1px_0_rgba(59,130,246,0.08)]">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em]">
            SCL Draft Monitoring System
          </p>
        </div>
      </div>

      <style>{`
        @keyframes transferFeedFadeOut {
          0% { opacity: 0.55; max-height: 220px; }
          80% { opacity: 0.12; max-height: 220px; }
          100% { opacity: 0; max-height: 0; padding: 0; margin: 0; border: none; overflow: hidden; }
        }
      `}</style>
    </div>
  );
});
