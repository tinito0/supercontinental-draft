import React, { memo, useMemo } from 'react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { TOURNAMENT_THEME } from './TournamentUI.jsx';

export const DEFAULT_BROADCAST_OVERLAY = {
  scene: 'live',
  homeTeamId: '',
  awayTeamId: '',
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
}) {
  const data = { ...DEFAULT_BROADCAST_OVERLAY, ...(overlayData || {}) };
  const scene = forcedScene || data.scene || 'live';
  const home = useMemo(() => getTeam(data.homeTeamId, allTeams, 'LOCAL'), [data.homeTeamId, allTeams]);
  const away = useMemo(() => getTeam(data.awayTeamId, allTeams, 'VISITANTE'), [data.awayTeamId, allTeams]);
  const isPanelScene = ['previa', 'descanso', 'final', 'tabla', 'bracket', 'goleadores'].includes(scene);
  const isFinal = scene === 'final' || data.matchStatus === 'FINAL';
  const theme = TOURNAMENT_THEME;

  return (
    <div className="broadcast-overlay-root" aria-label="SCL OBS overlay">
      <style>{`
        body, html, #root { background: transparent !important; }
        .broadcast-overlay-root {
          position: relative;
          width: 1920px;
          height: 1080px;
          overflow: hidden;
          color: ${theme.text};
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: transparent;
          letter-spacing: 0;
        }
        .broadcast-overlay-root * { box-sizing: border-box; }
        .broadcast-top-score {
          position: absolute;
          top: 36px;
          left: 50%;
          transform: translateX(-50%);
          width: 1040px;
          height: 116px;
          display: grid;
          grid-template-columns: 1fr 180px 1fr;
          align-items: stretch;
          background: linear-gradient(90deg, rgba(2,6,23,0.94), ${theme.panel}f5, rgba(2,6,23,0.94));
          border: 2px solid rgba(56,189,248,0.62);
          box-shadow: 0 18px 55px rgba(0,0,0,0.55), 0 0 34px rgba(14,165,233,0.24);
          clip-path: polygon(2.5% 0, 97.5% 0, 100% 24%, 100% 100%, 0 100%, 0 24%);
        }
        .broadcast-team {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 18px 34px;
        }
        .broadcast-team.away { justify-content: flex-end; text-align: right; }
        .broadcast-team-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          flex: 0 0 auto;
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.45));
        }
        .broadcast-team-name {
          min-width: 0;
          max-width: 300px;
          font-size: 31px;
          line-height: 1;
          font-weight: 1000;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .broadcast-score-core {
          background: linear-gradient(180deg, #e0f2fe, #38bdf8 44%, #075985);
          color: #020617;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-inline: 2px solid rgba(255,255,255,0.5);
        }
        .broadcast-score {
          font-size: 58px;
          line-height: 0.9;
          font-weight: 1000;
          font-variant-numeric: tabular-nums;
        }
        .broadcast-clock {
          margin-top: 7px;
          padding: 4px 10px;
          background: rgba(2,6,23,0.92);
          color: ${theme.text};
          font-size: 16px;
          font-weight: 900;
          border-radius: 999px;
          min-width: 86px;
          text-align: center;
        }
        .broadcast-meta {
          position: absolute;
          top: 150px;
          left: 50%;
          transform: translateX(-50%);
          height: 34px;
          min-width: 560px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 14px;
          padding: 0 26px;
          background: rgba(2,6,23,0.9);
          border: 1px solid rgba(125,211,252,0.45);
          color: #bae6fd;
          font-size: 15px;
          font-weight: 900;
          text-transform: uppercase;
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
        }
        .broadcast-live-dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 16px #22c55e;
        }
        .broadcast-lower {
          position: absolute;
          left: 70px;
          right: 70px;
          bottom: 86px;
          min-height: 118px;
          display: grid;
          grid-template-columns: 270px 1fr;
          background: linear-gradient(90deg, rgba(2,6,23,0.95), ${theme.panel}f2);
          border: 2px solid rgba(14,165,233,0.58);
          box-shadow: 0 18px 60px rgba(0,0,0,0.55);
        }
        .broadcast-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0ea5e9, #172554);
          border-right: 2px solid rgba(255,255,255,0.2);
          text-transform: uppercase;
        }
        .broadcast-brand-logo {
          width: 92px;
          height: 70px;
          object-fit: contain;
          filter: drop-shadow(0 10px 20px rgba(0,0,0,0.45));
        }
        .broadcast-brand strong {
          font-size: 36px;
          line-height: 0.92;
          font-weight: 1000;
          font-style: italic;
        }
        .broadcast-brand span {
          margin-top: 5px;
          color: #dbeafe;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }
        .broadcast-headline {
          min-width: 0;
          padding: 18px 28px 16px;
          text-transform: uppercase;
        }
        .broadcast-headline strong {
          display: block;
          font-size: 48px;
          line-height: 0.95;
          font-weight: 1000;
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .broadcast-headline span {
          display: block;
          margin-top: 9px;
          color: #bae6fd;
          font-size: 19px;
          font-weight: 850;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .broadcast-ticker {
          position: absolute;
          left: 70px;
          right: 70px;
          bottom: 40px;
          height: 38px;
          display: flex;
          align-items: center;
          gap: 18px;
          background: rgba(2,6,23,0.96);
          border: 1px solid rgba(148,163,184,0.42);
          overflow: hidden;
        }
        .broadcast-ticker-label {
          align-self: stretch;
          display: flex;
          align-items: center;
          padding: 0 18px;
          background: #38bdf8;
          color: #020617;
          font-size: 13px;
          font-weight: 1000;
          text-transform: uppercase;
        }
        .broadcast-ticker-text {
          min-width: 0;
          color: #e2e8f0;
          font-size: 18px;
          font-weight: 780;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .broadcast-panel {
          position: absolute;
          left: 50%;
          top: 52%;
          transform: translate(-50%, -50%);
          width: 1180px;
          min-height: 470px;
          padding: 42px 50px;
          background: linear-gradient(145deg, rgba(2,6,23,0.96), ${theme.panel}f0);
          border: 2px solid rgba(56,189,248,0.58);
          box-shadow: 0 28px 90px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .broadcast-panel-kicker {
          color: ${theme.sky};
          font-size: 22px;
          font-weight: 1000;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .broadcast-panel-title {
          margin-top: 14px;
          font-size: 72px;
          line-height: 0.92;
          font-weight: 1000;
          font-style: italic;
          text-transform: uppercase;
        }
        .broadcast-versus {
          margin-top: 44px;
          display: grid;
          grid-template-columns: 1fr 110px 1fr;
          align-items: center;
          gap: 28px;
        }
        .broadcast-versus-team {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 20px;
          background: rgba(15,23,42,0.72);
          border: 1px solid rgba(148,163,184,0.32);
        }
        .broadcast-versus-team.away { flex-direction: row-reverse; text-align: right; }
        .broadcast-versus-team img {
          width: 96px;
          height: 96px;
          object-fit: contain;
        }
        .broadcast-versus-team strong {
          min-width: 0;
          font-size: 34px;
          line-height: 1;
          font-weight: 1000;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .broadcast-vs {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 110px;
          border-radius: 999px;
          background: #38bdf8;
          color: #020617;
          font-size: 30px;
          font-weight: 1000;
        }
        .broadcast-final-score {
          margin-top: 36px;
          text-align: center;
          font-size: 86px;
          line-height: 0.9;
          font-weight: 1000;
          font-variant-numeric: tabular-nums;
          color: ${theme.text};
        }
        .broadcast-rankings {
          margin-top: 28px;
          display: grid;
          gap: 10px;
        }
        .broadcast-ranking-row {
          height: 54px;
          display: grid;
          grid-template-columns: 54px 1fr 96px;
          align-items: center;
          gap: 14px;
          background: rgba(15,23,42,0.75);
          border: 1px solid rgba(148,163,184,0.24);
          padding-right: 16px;
        }
        .broadcast-ranking-pos {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(56,189,248,0.18);
          color: #7dd3fc;
          font-size: 20px;
          font-weight: 1000;
        }
        .broadcast-ranking-name {
          min-width: 0;
          display: flex;
          flex-direction: column;
          text-transform: uppercase;
        }
        .broadcast-ranking-name strong {
          font-size: 22px;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .broadcast-ranking-name small {
          margin-top: 4px;
          color: ${theme.muted};
          font-size: 12px;
          font-weight: 850;
        }
        .broadcast-ranking-value {
          display: flex;
          align-items: baseline;
          justify-content: flex-end;
          gap: 6px;
          color: #e0f2fe;
        }
        .broadcast-ranking-value strong { font-size: 31px; line-height: 1; }
        .broadcast-ranking-value small { font-size: 11px; font-weight: 900; color: #7dd3fc; }
        .broadcast-empty {
          padding: 44px;
          color: #94a3b8;
          text-align: center;
          border: 1px dashed rgba(148,163,184,0.34);
          text-transform: uppercase;
          font-weight: 900;
        }
      `}</style>

      {data.showScoreboard && !isPanelScene && (
        <>
          <div className="broadcast-top-score">
            <div className="broadcast-team">
              <img className="broadcast-team-logo" src={home.logoUrl} alt="" onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
              <div className="broadcast-team-name">{home.name}</div>
            </div>
            <div className="broadcast-score-core">
              <div className="broadcast-score">{data.homeScore || 0}-{data.awayScore || 0}</div>
              <div className="broadcast-clock">{data.clock || data.matchStatus}</div>
            </div>
            <div className="broadcast-team away">
              <div className="broadcast-team-name">{away.name}</div>
              <img className="broadcast-team-logo" src={away.logoUrl} alt="" onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
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
        <div className="broadcast-panel">
          <div className="broadcast-panel-kicker">{data.competitionLabel}</div>
          <div className="broadcast-panel-title">{SCENE_LABELS[scene] || data.matchStatus}</div>
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
                  <img src={home.logoUrl} alt="" onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
                  <strong>{home.name}</strong>
                </div>
                <div className="broadcast-vs">VS</div>
                <div className="broadcast-versus-team away">
                  <img src={away.logoUrl} alt="" onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }} />
                  <strong>{away.name}</strong>
                </div>
              </div>
              {(isFinal || scene === 'descanso') && <div className="broadcast-final-score">{data.homeScore || 0}-{data.awayScore || 0}</div>}
            </>
          )}
        </div>
      )}

      {data.showLowerThird && (
        <div className="broadcast-lower">
          <div className="broadcast-brand">
            <img className="broadcast-brand-logo" src={DEFAULT_LOGO} alt="SCL" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
            <span>Directo</span>
          </div>
          <div className="broadcast-headline">
            <strong>{data.headline}</strong>
            <span>{data.subheadline}</span>
          </div>
        </div>
      )}

      {data.showTicker && (
        <div className="broadcast-ticker">
          <div className="broadcast-ticker-label">Ultimo momento</div>
          <div className="broadcast-ticker-text">{data.ticker}</div>
        </div>
      )}
    </div>
  );
});
