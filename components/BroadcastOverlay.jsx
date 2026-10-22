import React, { memo, useMemo } from 'react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { BroadcastFrame } from './broadcast/BroadcastFrame.jsx';
import { OverlayPopup } from './broadcast/OverlayPopup.jsx';
import { CommunityCard } from './broadcast/CommunityCard.jsx';
import { BroadcastMvp, BroadcastPrediction, BroadcastScorers } from './broadcast/BroadcastMatchExtras.jsx';

export const DEFAULT_BROADCAST_OVERLAY = {
  scene: 'live',
  matchId: '',
  homeTeamId: '',
  awayTeamId: '',
  homeTeamName: '',
  awayTeamName: '',
  homeScore: '0',
  awayScore: '0',
  matchStatus: 'EN VIVO',
  clock: '00:00',
  competitionLabel: 'SUPERCONTINENTAL LEAGUE',
  roundLabel: '',
  headline: 'SUPERCONTINENTAL LEAGUE',
  subheadline: 'Transmision oficial',
  ticker: 'Bienvenidos a la transmision de la Supercontinental League.',
  showScoreboard: true,
  showLowerThird: true,
  showTicker: true,
};

const SCENE_LABELS = {
  live: 'EN VIVO',
  previa: 'PREVIA',
  descanso: 'DESCANSO',
  final: 'FINAL',
  tabla: 'TABLA',
  bracket: 'LLAVES',
  goleadores: 'GOLEADORES',
};

function getTeam(teamId, teams, fallbackName) {
  const team = teamId && teams?.[teamId] ? teams[teamId] : null;
  return {
    name: team?.teamName || fallbackName,
    logoUrl: team?.logoUrl || DEFAULT_LOGO,
  };
}

function StatRows({ tournamentData, type }) {
  const rows = type === 'goleadores'
    ? (tournamentData?.topScorers || []).map(item => ({
        name: item.name || 'Jugador',
        team: item.team || 'Equipo',
        value: item.goals || 0,
        label: 'G',
      }))
    : (tournamentData?.league || []).slice(0, 8).map(item => ({
        name: item.name || 'Club',
        team: `${Number(item.gf || 0) - Number(item.gc || 0)} DG`,
        value: item.pts || 0,
        label: 'PTS',
      }));

  return (
    <div className="broadcast-rankings">
      {rows.length === 0 ? (
        <div className="broadcast-empty">Sin datos cargados</div>
      ) : rows.map((row, index) => (
        <div className="broadcast-ranking-row" key={`${row.name}-${index}`}>
          <span className="broadcast-ranking-pos">{index + 1}</span>
          <div className="broadcast-ranking-name">
            <strong>{row.name}</strong>
            <small>{row.team}</small>
          </div>
          <div className="broadcast-ranking-value">
            <strong>{row.value}</strong>
            <small>{row.label}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

export const BroadcastOverlay = memo(function BroadcastOverlay({
  overlayData,
  allTeams,
  tournamentData,
  forcedScene,
  live,
}) {
  const data = { ...DEFAULT_BROADCAST_OVERLAY, ...(overlayData || {}) };
  const scene = forcedScene || data.scene || 'live';
  // homeTeamName/awayTeamName vienen del partido elegido en el panel: cubren clubes del torneo sin cuenta.
  const home = useMemo(() => getTeam(data.homeTeamId, allTeams, data.homeTeamName || 'LOCAL'), [data.homeTeamId, data.homeTeamName, allTeams]);
  const away = useMemo(() => getTeam(data.awayTeamId, allTeams, data.awayTeamName || 'VISITANTE'), [data.awayTeamId, data.awayTeamName, allTeams]);
  const isPanelScene = ['previa', 'descanso', 'final', 'tabla', 'bracket', 'goleadores'].includes(scene);
  const isFinal = scene === 'final' || data.matchStatus === 'FINAL';
  // Durante el partido el juego ya muestra marcador y reloj: el overlay queda limpio y solo aparece el popup con QR.
  const isMatchScene = scene === 'live';
  const showsResult = isFinal || scene === 'descanso';
  // El marcador del juego (bridge) manda sobre el que cargó el admin a mano.
  const score = live?.score || { home: data.homeScore || 0, away: data.awayScore || 0 };

  return (
    <div className="broadcast-overlay-root scl-broadcast" aria-label="SCL OBS overlay">
      {/* Solo en la página del overlay: OBS necesita el fondo transparente. */}
      <style>{'body, html, #root { background: transparent !important; }'}</style>

      {data.showScoreboard && !isPanelScene && !isMatchScene && (
        <>
          <div className="broadcast-top-score">
            <div className="broadcast-team">
              <img className="broadcast-team-logo" src={home.logoUrl} alt="" width={70} height={70} onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
              <div className="broadcast-team-name">{home.name}</div>
            </div>
            <div className="broadcast-score-core">
              <div className="broadcast-score">{data.homeScore || 0}-{data.awayScore || 0}</div>
              <div className="broadcast-clock">{data.clock || data.matchStatus}</div>
            </div>
            <div className="broadcast-team away">
              <div className="broadcast-team-name">{away.name}</div>
              <img className="broadcast-team-logo" src={away.logoUrl} alt="" width={70} height={70} onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
            </div>
          </div>
          <div className="broadcast-meta">
            <span className="broadcast-live-dot"></span>
            <span>{data.matchStatus || SCENE_LABELS[scene] || 'EN VIVO'}</span>
            <span>{data.competitionLabel}</span>
            {data.roundLabel && <span>{data.roundLabel}</span>}
          </div>
        </>
      )}

      {isPanelScene && (
        <BroadcastFrame
          className="broadcast-panel"
          kicker={data.competitionLabel}
          title={SCENE_LABELS[scene] || data.matchStatus}
          aside={data.roundLabel || null}
        >
          {['tabla', 'goleadores'].includes(scene) ? (
            <StatRows tournamentData={tournamentData} type={scene} />
          ) : scene === 'bracket' ? (
            <StatRows tournamentData={{ league: tournamentData?.bracket?.quarters?.map((match, index) => ({
              name: `${match.teamA || 'TBD'} vs ${match.teamB || 'TBD'}`,
              pts: `${match.scoreA || '-'}-${match.scoreB || '-'}`,
              gf: index + 1,
              gc: 0,
            })) }} type="tabla" />
          ) : (
            <>
              <div className="broadcast-versus">
                <div className="broadcast-versus-team">
                  <img src={home.logoUrl} alt="" width={96} height={96} onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
                  <strong>{home.name}</strong>
                </div>
                <div className="broadcast-vs">VS</div>
                <div className="broadcast-versus-team away">
                  <img src={away.logoUrl} alt="" width={96} height={96} onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
                  <strong>{away.name}</strong>
                </div>
              </div>
              {showsResult && (
                <>
                  <div className="broadcast-final-score">{score.home}-{score.away}</div>
                  <BroadcastScorers scorers={live?.scorers} />
                </>
              )}
              {scene === 'previa' && live?.prediction && <BroadcastPrediction shares={live.prediction} />}
              {isFinal && live?.mvp && <BroadcastMvp mvp={live.mvp} />}
            </>
          )}
        </BroadcastFrame>
      )}

      {data.showLowerThird && !isMatchScene && (
        <div className="broadcast-lower">
          <div className="broadcast-brand">
            <img className="broadcast-brand-logo" src={DEFAULT_LOGO} alt="SCL" width={72} height={72} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
          </div>
          <div className="broadcast-headline">
            <strong>{data.headline}</strong>
            <span>{data.subheadline}</span>
          </div>
        </div>
      )}

      {data.showTicker && !isMatchScene && (
        <div className="broadcast-ticker">
          <div className="broadcast-ticker-label">Último momento</div>
          <div className="broadcast-ticker-text">{data.ticker}</div>
        </div>
      )}

      <CommunityCard card={overlayData?.card} live={live} homeName={home.name} awayName={away.name} />
      <OverlayPopup popup={overlayData?.popup} />
    </div>
  );
});
