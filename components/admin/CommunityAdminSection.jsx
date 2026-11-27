import React, { memo, useEffect, useMemo, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { ExternalLink, Lock, Unlock, UserRoundCheck, Vote, X } from 'lucide-react';
import { setVotingClosed } from '../../services/communityAdminService.js';
import { useLiveMatches, usePrediction } from '../../hooks/useLeagueData.js';
import { useManagerRound } from '../../hooks/useManagerRound.js';
import { managerRanking, predictionShares } from '../../utils/communityView.js';
import { EMPTY_OVERLAY_MATCH } from '../../utils/broadcastMatches.js';
import { fixtureIsPredictable } from '../../supabase/functions/_shared/communityVote.js';
import { Alert } from '../ui/Alert.jsx';
import { CupPollAdmin } from './CupPollAdmin.jsx';
import { ResetVotesButton } from './ResetVotesButton.jsx';

/* Administración → Comunidad: cómo van los votos del público (docs/COMMUNITY_PLATFORM.md). La predicción del partido
   al aire (se puede cerrar o reabrir a mano: closedAt), la votación del manager de la última fecha terminada y las
   encuestas de las copas. Los votos los suma la función community-vote; acá se miran, se abren o cierran y se reinician. */

const PREDICTION_LABELS = { home: 'Local', draw: 'Empate', away: 'Visitante' };

function useClock(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function StatusBadge({ isOpen, openLabel = 'Abierta', closedLabel = 'Cerrada' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${isOpen ? 'bg-success/15 text-success-soft' : 'bg-raised text-ink-2'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-success' : 'bg-ink-3'}`} aria-hidden="true" />
      {isOpen ? openLabel : closedLabel}
    </span>
  );
}

function PredictionStatus({ overlay, tournament, onUpdateBroadcastOverlay, showStatusMessage }) {
  const matchId = overlay?.matchId || null;
  const { data: prediction } = usePrediction(matchId);
  const [busy, setBusy] = useState(false);
  // Un cruce sin los dos equipos («Ganador 2° Red.») o de otra temporada: la web no lo deja votar, pero OBS lo sigue
  // mostrando hasta que se quita del aire.
  const isPredictable = fixtureIsPredictable(tournament, matchId);

  const clearMatch = async () => {
    if (!onUpdateBroadcastOverlay) return;
    setBusy(true);
    try {
      await onUpdateBroadcastOverlay({ ...EMPTY_OVERLAY_MATCH, updatedAt: serverTimestamp(), updatedBy: 'admin' }, 'Partido quitado del aire.');
    } finally {
      setBusy(false);
    }
  };
  const shares = predictionShares(prediction?.votes);
  const isClosed = Boolean(prediction?.closedAt);
  const home = prediction?.homeTeam || overlay?.homeTeamName || PREDICTION_LABELS.home;
  const away = prediction?.awayTeam || overlay?.awayTeamName || PREDICTION_LABELS.away;

  const setClosed = async closed => {
    if (!matchId) return;
    setBusy(true);
    try {
      await setVotingClosed('prediction', matchId, closed);
      showStatusMessage?.('success', closed ? 'Predicción cerrada: ya no se puede votar.' : 'Predicción reabierta.');
    } catch (error) {
      console.error('[CommunityAdminSection] prediction', error);
      showStatusMessage?.('error', 'No se pudo cambiar la predicción. Revisá la conexión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="admin-prediction">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="admin-prediction" className="section-title flex items-center gap-2"><Vote className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Predicción «¿Quién gana?»</h2>
        {matchId && <StatusBadge isOpen={!isClosed} />}
      </div>
      {!matchId ? (
        <p className="text-sm text-ink-2">No hay partido al aire. La predicción se abre sola al mandar al aire un partido sin jugar (Transmisión → Escenas).</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{home}</span> vs <span className="font-semibold text-ink">{away}</span>
            {' · '}Se cierra sola cuando el colector manda el partido en vivo.
          </p>
          {!isPredictable && (
            <Alert tone="warning" title="Este partido no se puede votar">
              El cruce todavía no tiene los dos equipos, o ya no está en el torneo. El público no lo ve en /en-vivo, pero sigue
              al aire en OBS hasta que lo quites.
            </Alert>
          )}
          <dl className="grid grid-cols-4 gap-2 rounded-xl bg-raised p-3 text-center">
            {[['Local', shares.home], ['Empate', shares.draw], ['Visitante', shares.away]].map(([label, pct]) => (
              <div key={label}><dt className="text-xs font-semibold text-ink-2">{label}</dt><dd className="num font-display text-xl font-bold text-ink">{pct}%</dd></div>
            ))}
            <div><dt className="text-xs font-semibold text-ink-2">Votos</dt><dd className="num font-display text-xl font-bold text-ink">{shares.total}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {isClosed ? (
              <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => setClosed(false)}>
                <Unlock className="h-4 w-4" aria-hidden="true" /> Reabrir predicción
              </button>
            ) : (
              <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => setClosed(true)}>
                <Lock className="h-4 w-4" aria-hidden="true" /> Cerrar ahora
              </button>
            )}
            {shares.total > 0 && <ResetVotesButton kind="prediction" target={matchId} label={`la predicción ${home} vs ${away}`} total={shares.total} showStatusMessage={showStatusMessage} />}
            {onUpdateBroadcastOverlay && (
              <button type="button" className="btn btn-ghost min-h-11" disabled={busy} onClick={clearMatch}>
                <X className="h-4 w-4" aria-hidden="true" /> Quitar partido del aire
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ManagerStatus({ tournament, showStatusMessage }) {
  const now = useClock();
  const { matches } = useLiveMatches();
  const { round } = useManagerRound(tournament, matches);
  const [busy, setBusy] = useState(false);
  const votes = round?.votes;
  const closedByAdmin = Boolean(votes?.closedAt);
  const total = Number(votes?.total) || 0;

  const setClosed = async closed => {
    setBusy(true);
    try {
      await setVotingClosed('manager', round.roundId, closed);
      showStatusMessage?.('success', closed ? 'Votación del mánager cerrada.' : 'Votación del mánager reabierta.');
    } catch (error) {
      console.error('[CommunityAdminSection] manager', error);
      showStatusMessage?.('error', 'No se pudo cambiar la votación del mánager. Revisá la conexión.');
    } finally {
      setBusy(false);
    }
  };
  const ranking = useMemo(() => managerRanking(votes?.votes, 3), [votes]);
  const closesAt = round?.window.closesAtMs;
  const closesInHours = Number.isFinite(closesAt) && closesAt > now ? Math.ceil((closesAt - now) / 3_600_000) : null;

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="admin-manager">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="admin-manager" className="section-title flex items-center gap-2"><UserRoundCheck className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Mánager de la fecha</h2>
        {round && <StatusBadge isOpen={round.open} />}
      </div>
      {!round ? (
        <p className="text-sm text-ink-2">Ninguna fecha terminó todavía. La votación se abre sola cuando se carga el último resultado de una fecha y queda abierta 24 horas.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{round.title}</span>
            {round.open && closesInHours != null && <> · cierra en <span className="num font-semibold text-ink">{closesInHours}</span> h</>}
            {round.open && closesInHours == null && ' · las 24 h corren desde el primer voto'}
            {closedByAdmin && ' · cerrada a mano'}
            {!round.open && !closedByAdmin && ` · ${round.window.reason}`}
            {' · '}<span className="num font-semibold text-ink">{total}</span> votos
          </p>
          {ranking.length > 0 && (
            <ol className="space-y-1 text-sm">
              {ranking.map((entry, index) => <li key={entry.club} className="text-ink"><span className="num font-bold">{index + 1}.</span> {entry.club} · <span className="num">{entry.pct}%</span></li>)}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            {closedByAdmin ? (
              <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => setClosed(false)}>
                <Unlock className="h-4 w-4" aria-hidden="true" /> Reabrir
              </button>
            ) : round.open && (
              <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => setClosed(true)}>
                <Lock className="h-4 w-4" aria-hidden="true" /> Cerrar ahora
              </button>
            )}
            {total > 0 && <ResetVotesButton kind="manager" target={round.roundId} label={`el mánager de la ${round.title}`} total={total} showStatusMessage={showStatusMessage} />}
          </div>
        </>
      )}
    </section>
  );
}

export const CommunityAdminSection = memo(function CommunityAdminSection({ broadcastOverlayData, tournamentData, onUpdateBroadcastOverlay, showStatusMessage }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Lo que vota el público sin cuenta en la página /en-vivo (el QR del stream). Un voto por navegador.</p>
        <a href="/en-vivo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm min-h-11"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver /en-vivo</a>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PredictionStatus overlay={broadcastOverlayData} tournament={tournamentData} onUpdateBroadcastOverlay={onUpdateBroadcastOverlay} showStatusMessage={showStatusMessage} />
        <ManagerStatus tournament={tournamentData} showStatusMessage={showStatusMessage} />
      </div>
      {!tournamentData && <Alert tone="info" title="Sin torneo cargado">Las encuestas de las copas sugieren equipos cuando hay tabla.</Alert>}
      <CupPollAdmin tournamentData={tournamentData} showStatusMessage={showStatusMessage} />
    </div>
  );
});

export default CommunityAdminSection;
