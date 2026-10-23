import React, { memo, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Lock, Star, Unlock, Vote } from 'lucide-react';
import { setVotingClosed } from '../../services/communityAdminService.js';
import { useLiveMatches, useMvpVotes, usePrediction } from '../../hooks/useLeagueData.js';
import { mvpRanking, pickMvpMatch, predictionShares } from '../../utils/communityView.js';
import { MVP_GRACE_MS } from '../../supabase/functions/_shared/communityVote.js';
import { Alert } from '../ui/Alert.jsx';
import { CupPollAdmin } from './CupPollAdmin.jsx';
import { ResetVotesButton } from './ResetVotesButton.jsx';

/* Administración → Comunidad: cómo van los votos del público (docs/COMMUNITY_PLATFORM.md). La predicción del partido
   al aire (se puede cerrar o reabrir a mano: closedAt), la votación del MVP del partido del juego y las encuestas de
   las copas. Los votos los suma la función community-vote; acá se miran, se abren o cierran y se reinician. */

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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${isOpen ? 'bg-success/15 text-success-soft' : 'bg-raised text-ink-2'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-success' : 'bg-ink-3'}`} aria-hidden="true" />
      {isOpen ? openLabel : closedLabel}
    </span>
  );
}

function PredictionStatus({ overlay, showStatusMessage }) {
  const matchId = overlay?.matchId || null;
  const { data: prediction } = usePrediction(matchId);
  const [busy, setBusy] = useState(false);
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
        <h3 id="admin-prediction" className="section-title flex items-center gap-2"><Vote className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Predicción «¿Quién gana?»</h3>
        {matchId && <StatusBadge isOpen={!isClosed} />}
      </div>
      {!matchId ? (
        <p className="text-sm text-ink-2">No hay partido al aire. La predicción se abre sola al mandar al aire un partido sin jugar (Torneo y transmisión → Escenas).</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{home}</span> vs <span className="font-semibold text-ink">{away}</span>
            {' · '}Se cierra sola cuando el colector manda el partido en vivo.
          </p>
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
          </div>
        </>
      )}
    </section>
  );
}

function MvpStatus({ showStatusMessage }) {
  const now = useClock();
  const { matches } = useLiveMatches();
  const { match, open: inWindow } = pickMvpMatch(matches, now);
  const { data: votes } = useMvpVotes(match?.key || null);
  const [busy, setBusy] = useState(false);
  const closedByAdmin = Boolean(votes?.closedAt);
  const open = inWindow && !closedByAdmin;
  const total = Number(votes?.total) || 0;

  const setClosed = async closed => {
    setBusy(true);
    try {
      await setVotingClosed('mvp', match.key, closed);
      showStatusMessage?.('success', closed ? 'Votación del MVP cerrada.' : 'Votación del MVP reabierta.');
    } catch (error) {
      console.error('[CommunityAdminSection] mvp', error);
      showStatusMessage?.('error', 'No se pudo cambiar la votación del MVP. Revisá la conexión.');
    } finally {
      setBusy(false);
    }
  };
  const ranking = useMemo(() => mvpRanking(votes?.votes, match?.summary, 3), [votes, match?.summary]);
  const closesIn = match?.status.kind === 'finished' && Number.isFinite(match.finishedAtMs ?? match.updatedAtMs)
    ? Math.max(0, Math.ceil(((match.finishedAtMs ?? match.updatedAtMs) + MVP_GRACE_MS - now) / 60_000)) : null;

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="admin-mvp">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="admin-mvp" className="section-title flex items-center gap-2"><Star className="h-5 w-5 text-accent-soft" aria-hidden="true" /> MVP del partido</h3>
        {match && <StatusBadge isOpen={open} />}
      </div>
      {!match ? (
        <p className="text-sm text-ink-2">No hay votación abierta. Se abre sola con el partido en vivo y cierra 15 minutos después del final, o si el colector deja de mandar datos 10 minutos.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{match.home.name} {match.home.score}-{match.away.score} {match.away.name}</span>
            {closesIn != null && !closedByAdmin && <> · cierra en <span className="num font-semibold text-ink">{closesIn}</span> min</>}
            {closedByAdmin && ' · cerrada a mano'}
            {' · '}<span className="num font-semibold text-ink">{total}</span> votos
          </p>
          {ranking.length > 0 && (
            <ol className="space-y-1 text-sm">
              {ranking.map((entry, index) => <li key={entry.id} className="text-ink"><span className="num font-bold">{index + 1}.</span> {entry.name} · <span className="num">{entry.pct}%</span></li>)}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            {closedByAdmin ? (
              <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => setClosed(false)}>
                <Unlock className="h-4 w-4" aria-hidden="true" /> Reabrir MVP
              </button>
            ) : (
              <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => setClosed(true)}>
                <Lock className="h-4 w-4" aria-hidden="true" /> Cerrar ahora
              </button>
            )}
            {total > 0 && <ResetVotesButton kind="mvp" target={match.key} label="el MVP del partido" total={total} showStatusMessage={showStatusMessage} />}
          </div>
        </>
      )}
    </section>
  );
}

export const CommunityAdminSection = memo(function CommunityAdminSection({ broadcastOverlayData, tournamentData, showStatusMessage }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Lo que vota el público sin cuenta en la página /en-vivo (el QR del stream). Un voto por navegador.</p>
        <a href="/en-vivo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm min-h-11"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver /en-vivo</a>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PredictionStatus overlay={broadcastOverlayData} showStatusMessage={showStatusMessage} />
        <MvpStatus showStatusMessage={showStatusMessage} />
      </div>
      {!tournamentData && <Alert tone="info" title="Sin torneo cargado">Las encuestas de las copas sugieren equipos cuando hay tabla.</Alert>}
      <CupPollAdmin tournamentData={tournamentData} showStatusMessage={showStatusMessage} />
    </div>
  );
});

export default CommunityAdminSection;
