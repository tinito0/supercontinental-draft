import React, { memo, useCallback, useMemo, useState } from 'react';
import { introStep, introTeams, introWakeMs, lineupIntroRemainingMs, wipeSchedule, XI_MOTION } from '../../utils/lineupIntro.js';
import { BroadcastBadge } from './BroadcastFrame.jsx';
import { BroadcastCrest } from './BroadcastCrest.jsx';
import { shownKey, useRemaining } from './OverlayPopup.jsx';
import './wipe.css';
import './lineupIntro.css';

// Once inicial animado sobre el juego mientras carga el partido (pedido del usuario; referencia: las presentaciones
// de formaciones de la TV, con la estética de la liga). Cada equipo unos segundos. Todo entra y sale con barridos
// (wipe.css): nada se desliza, una barra descubre cada pieza en su lugar. Ritmo y orden: XI_MOTION de
// utils/lineupIntro.js. Datos: `lineupIntro` del doc del overlay, lo manda el bridge una vez por partido.

const ms = value => `${Math.round(value)}ms`;

/** Variables de un barrido: duraciones, retardos de entrada y de salida. */
function wipeVars({ inMs, outMs, dur, outDur }) {
  return { '--wipe-delay': ms(inMs), '--wipe-out-delay': ms(outMs), '--wipe-dur': ms(dur), '--wipe-out-dur': ms(outDur) };
}

function Silhouette() {
  return (
    <svg className="scl-xi-silhouette" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="36" r="19" />
      <path d="M12 100c0-23 17-40 38-40s38 17 38 40z" />
    </svg>
  );
}

const LONG_WORD = 11;
const hasLongWord = name => String(name || '').split(/\s+/).some(word => word.length > LONG_WORD);

function XiPlayer({ player, timing, motion }) {
  // Se recuerda qué foto falló: con otro jugador en el mismo lugar se vuelve a intentar.
  const [failedId, setFailedId] = useState(null);
  const style = { ...wipeVars({ ...timing, dur: motion.wipeMs, outDur: motion.outWipeMs }), left: player.x, top: player.y };
  return (
    <div className="scl-xi-player scl-wipe" data-wipe-in={motion.inDirection} data-wipe-out={motion.outDirection} style={style}>
      <div className="scl-xi-photo">
        <Silhouette />
        {failedId !== player.id && (
          <img src={`/fotos_jugadores/${player.id}.webp`} alt="" width={76} height={88} decoding="async" onError={() => setFailedId(player.id)} />
        )}
      </div>
      <div className="scl-xi-plate">
        <span className="scl-xi-number scl-wipe-detail">{player.number ?? ''}</span>
        <span className="scl-xi-copy">
          <strong className="scl-wipe-detail" data-long={hasLongWord(player.name) || undefined} style={{ '--detail-step': '60ms' }}>{player.name || `Jugador ${player.id}`}</strong>
          {player.roleLabel && <small className="scl-wipe-detail" style={{ '--detail-step': '120ms' }}>{player.roleLabel}</small>}
        </span>
      </div>
    </div>
  );
}

function XiCard({ team, logo, isLeaving, motion }) {
  const schedule = useMemo(() => wipeSchedule(team.cards, motion), [team.cards, motion]);
  // Encabezado: escudo, nombre, formación y sello, uno detrás del otro; a la salida, después de los jugadores.
  const playersOutMs = (team.cards.length - 1) * motion.outStaggerMs + motion.outWipeMs * 0.5;
  const head = step => wipeVars({ inMs: motion.headStartMs + step * motion.headStepMs, outMs: playersOutMs + step * motion.headOutStepMs, dur: motion.wipeMs, outDur: motion.headOutMs });
  const panel = wipeVars({ inMs: 0, outMs: motion.panelOutDelayMs, dur: motion.panelMs, outDur: motion.panelOutMs });
  return (
    <section className={`scl-xi scl-wipe ${isLeaving ? 'is-leaving' : ''}`} data-wipe-in={motion.inDirection} data-wipe-out={motion.outDirection}
      style={panel} aria-label={`Once inicial de ${team.name}`}>
      <header className="scl-xi-head">
        <div className="scl-xi-edge" aria-hidden="true" />
        <div className="scl-frame-ball" aria-hidden="true" />
        <div className="scl-xi-crest scl-wipe" data-wipe-in="up" data-wipe-out="up" style={head(0)}>
          <BroadcastCrest className="scl-xi-crest-img" name={team.name} logo={logo} />
        </div>
        <div className="scl-xi-titles scl-wipe" data-wipe-in={motion.inDirection} data-wipe-out={motion.outDirection} style={head(1)}>
          <span className="scl-xi-kicker">Once inicial</span>
          <span className="scl-xi-name">{team.name}</span>
        </div>
        {team.formation && (
          <div className="scl-xi-formation scl-wipe" data-wipe-in="left" data-wipe-out="left" style={head(2)}>
            <span>Formación</span>
            <strong>{team.formation}</strong>
          </div>
        )}
        <div className="scl-xi-seal scl-wipe" data-wipe-in="up" data-wipe-out="up" style={head(3)}><BroadcastBadge /></div>
      </header>
      <div className="scl-xi-pitch">
        <div className="scl-xi-field" aria-hidden="true">
          <span className="scl-xi-box" /><span className="scl-xi-half" />
        </div>
        {/* Cada uno en su lugar del juego (utils/lineupIntro.js pitchLayout); el orden y el ritmo, wipeSchedule. */}
        <div className="scl-xi-area">
          {team.cards.map(card => <XiPlayer key={card.id} player={card} timing={schedule[card.id]} motion={motion} />)}
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{ intro?: object|null, loaded?: boolean, logoOf: (team: { name: string, draftTeamId: string|null }) => string|null, motion?: object }} props
 *   loaded: false mientras la fuente espera el doc del overlay (una animación que ya pasó no vuelve a salir)
 *   motion: ritmo y direcciones (XI_MOTION por defecto)
 */
export const LineupIntro = memo(function LineupIntro({ intro, loaded = true, logoOf, motion = XI_MOTION }) {
  // El reloj despierta al empezar y al terminar la salida de cada equipo, no solo al final de toda la animación.
  const nextWakeMs = useCallback(left => introWakeMs(intro, left, motion.leaveMs), [intro, motion.leaveMs]);
  const remaining = useRemaining(intro, lineupIntroRemainingMs, loaded, nextWakeMs);
  const teams = useMemo(() => introTeams(intro), [intro]);
  const step = introStep(intro, remaining);
  if (!step || !teams[step.index]) return null;
  const team = teams[step.index];
  return (
    <XiCard key={`${shownKey(intro)}-${step.index}`} team={team} logo={logoOf(team)} motion={motion}
      isLeaving={step.remainingMs <= motion.leaveMs} />
  );
});

export default LineupIntro;
