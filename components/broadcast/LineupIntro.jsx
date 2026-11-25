import React, { memo, useEffect, useMemo, useState } from 'react';
import { introStep, introTeams, lineupIntroRemainingMs } from '../../utils/lineupIntro.js';
import { BroadcastBadge } from './BroadcastFrame.jsx';
import { BroadcastCrest } from './BroadcastCrest.jsx';
import { LEAVE_MS, shownKey, useRemaining } from './OverlayPopup.jsx';
import './lineupIntro.css';

// Once inicial animado sobre el juego mientras carga el partido (pedido del usuario; referencia: la presentación de
// formaciones de la TV de la Libertadores, con la estética de la liga). Cada equipo unos segundos: encabezado con
// escudo y dibujo, y las líneas del arco hacia adelante; cada jugador entra como silueta y después aparece su foto.
// Datos: `lineupIntro` del doc del overlay (utils/lineupIntro.js), lo manda el bridge una vez por partido.

const FIRST_LINE_MS = 520;
const LINE_STEP_MS = 360;
const PLAYER_STEP_MS = 70;

function Silhouette() {
  return (
    <svg className="scl-xi-silhouette" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="36" r="19" />
      <path d="M12 100c0-23 17-40 38-40s38 17 38 40z" />
    </svg>
  );
}

function XiPlayer({ player, delayMs }) {
  // Se recuerda qué foto falló: con otro jugador en el mismo lugar se vuelve a intentar.
  const [failedId, setFailedId] = useState(null);
  return (
    <div className="scl-xi-player" style={{ '--d': `${delayMs}ms`, '--line': player.line, left: player.x, top: player.y }}>
      <div className="scl-xi-photo">
        <Silhouette />
        {failedId !== player.id && (
          <img src={`/fotos_jugadores/${player.id}.webp`} alt="" width={76} height={88} decoding="async" onError={() => setFailedId(player.id)} />
        )}
      </div>
      <div className="scl-xi-plate">
        <span className="scl-xi-number">{player.number ?? ''}</span>
        <span className="scl-xi-copy">
          <strong>{player.name || `Jugador ${player.id}`}</strong>
          {player.roleLabel && <small>{player.roleLabel}</small>}
        </span>
      </div>
    </div>
  );
}

function XiCard({ team, logo, isLeaving }) {
  return (
    <section className={`scl-xi ${isLeaving ? 'is-leaving' : ''}`} aria-label={`Once inicial de ${team.name}`}>
      <header className="scl-xi-head">
        <div className="scl-xi-edge" aria-hidden="true" />
        <div className="scl-frame-ball" aria-hidden="true" />
        <div className="scl-xi-crest"><BroadcastCrest className="scl-xi-crest-img" name={team.name} logo={logo} /></div>
        <div className="scl-xi-titles">
          <span className="scl-xi-kicker">Once inicial</span>
          <span className="scl-xi-name">{team.name}</span>
        </div>
        {team.formation && (
          <div className="scl-xi-formation">
            <span>Formación</span>
            <strong>{team.formation}</strong>
          </div>
        )}
        <BroadcastBadge />
      </header>
      <div className="scl-xi-pitch">
        <div className="scl-xi-field" aria-hidden="true"><span className="scl-xi-box" /><span className="scl-xi-half" /></div>
        {/* Cada uno en su lugar del juego (utils/lineupIntro.js pitchLayout); entran por líneas, del arco hacia adelante. */}
        <div className="scl-xi-area">
          {team.cards.map(card => (
            <XiPlayer key={card.id} player={card} delayMs={FIRST_LINE_MS + card.line * LINE_STEP_MS + card.slot * PLAYER_STEP_MS} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{ intro?: object|null, loaded?: boolean, logoOf: (team: { name: string, draftTeamId: string|null }) => string|null }} props
 *   loaded: false mientras la fuente espera el doc del overlay (una animación que ya pasó no vuelve a salir)
 */
export const LineupIntro = memo(function LineupIntro({ intro, loaded = true, logoOf }) {
  const remaining = useRemaining(intro, lineupIntroRemainingMs, loaded);
  const teams = useMemo(() => introTeams(intro), [intro]);
  const step = introStep(intro, remaining);
  // useRemaining despierta cada segundo; el cambio de equipo y su salida necesitan su momento exacto.
  const [, setTick] = useState(0);
  const teamLeft = step?.remainingMs ?? 0;
  useEffect(() => {
    if (!teamLeft) return undefined;
    const delay = teamLeft > LEAVE_MS ? teamLeft - LEAVE_MS : teamLeft;
    const timer = setTimeout(() => setTick(n => n + 1), delay + 10);
    return () => clearTimeout(timer);
  }, [teamLeft]);
  if (!step || !teams[step.index]) return null;
  const team = teams[step.index];
  return (
    <XiCard key={`${shownKey(intro)}-${step.index}`} team={team} logo={logoOf(team)} isLeaving={step.remainingMs <= LEAVE_MS} />
  );
});

export default LineupIntro;
