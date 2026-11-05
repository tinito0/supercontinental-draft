import React from 'react';
import { formatDecimal } from '../../utils/matchStats.js';

// Piezas de las escenas Previa, Entretiempo y Final con datos en vivo (utils/overlayLive.js). Estilos en broadcast.css.

/** Goleadores de cada lado, en el orden en que llegaron los goles. */
export function BroadcastScorers({ scorers }) {
  if (!scorers || (!scorers.home.length && !scorers.away.length)) return null;
  const column = (side, goals) => (
    <ul className={`broadcast-scorers-side ${side}`}>
      {goals.map(goal => (
        <li key={goal.key}>
          <span className="broadcast-scorer-name">{goal.name}</span>
          <span className="broadcast-scorer-minute">{goal.minute}{goal.tag && ` ${goal.tag}`}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="broadcast-scorers" aria-label="Goles">
      {column('home', scorers.home)}
      {column('away', scorers.away)}
    </div>
  );
}

/** Predicción de la comunidad antes del partido: local, empate y visitante. */
export function BroadcastPrediction({ shares }) {
  const segments = [['home', 'Local'], ['draw', 'Empate'], ['away', 'Visitante']].filter(([side]) => shares[side] > 0);
  return (
    <div className="broadcast-community">
      <div className="broadcast-community-label">
        <span>La comunidad dice</span>
        <span>{shares.total} {shares.total === 1 ? 'voto' : 'votos'}</span>
      </div>
      <div className="broadcast-prediction-bar" role="img" aria-label={`Local ${shares.home}%, empate ${shares.draw}%, visitante ${shares.away}%`}>
        {segments.map(([side, label]) => (
          <span key={side} className={side} style={{ flexGrow: shares[side] }}>
            {shares[side] >= 12 ? `${side === 'draw' ? `${label} ` : ''}${shares[side]}%` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** El más votado como MVP del partido. */
export function BroadcastMvp({ mvp }) {
  return (
    <div className="broadcast-community broadcast-mvp">
      <span className="broadcast-community-label"><span>MVP de la comunidad</span><span>{mvp.pct}%</span></span>
      <strong>{mvp.name}</strong>
    </div>
  );
}

/** Mejor valoración del juego; si empatan, todos. */
export function BroadcastTopRated({ topRated }) {
  return (
    <div className={`broadcast-community broadcast-mvp${topRated.names.length > 1 ? ' is-tie' : ''}`}>
      <span className="broadcast-community-label"><span>Mejor valoración</span><span>{formatDecimal(topRated.rating, 1)}</span></span>
      <strong aria-label={topRated.names.join(' y ')}>
        {topRated.names.map(name => <span key={name}>{name}</span>)}
      </strong>
    </div>
  );
}

/** Final: el MVP que votó la comunidad y la mejor valoración del juego, lado a lado cuando están los dos. */
export function BroadcastFinalAwards({ mvp, topRated }) {
  if (!mvp && !topRated) return null;
  return (
    <div className="broadcast-final-awards">
      {mvp && <BroadcastMvp mvp={mvp} />}
      {topRated && <BroadcastTopRated topRated={topRated} />}
    </div>
  );
}

const FORM_LETTER = { W: 'G', D: 'E', L: 'P' };
const FORM_LABEL = { W: 'ganó', D: 'empató', L: 'perdió' };

function FormRow({ form, side }) {
  return (
    <ol className={`broadcast-form ${side}`}
      aria-label={`Últimos resultados, el más nuevo ${side === 'home' ? 'al final' : 'primero'}: ${form.map(r => FORM_LABEL[r]).join(', ') || 'sin partidos'}`}>
      {form.map((result, index) => <li key={index} className={`broadcast-form-${result}`} aria-hidden="true">{FORM_LETTER[result]}</li>)}
    </ol>
  );
}

/** Previa: forma de cada club (últimos cinco, el más nuevo junto al centro) y el cara a cara (utils/seasonStats.js matchupFacts). */
export function BroadcastSeasonFacts({ facts }) {
  const { h2h } = facts;
  return (
    <div className="broadcast-community">
      <div className="broadcast-community-label"><span>Forma</span><span>Últimos 5</span></div>
      <div className="broadcast-season-facts">
        <FormRow form={[...facts.homeForm].reverse()} side="home" />
        <div className="broadcast-h2h">
          {h2h.played ? <><strong>{h2h.won}G {h2h.drawn}E {h2h.lost}P</strong><small>cara a cara</small></> : <small>primer cruce</small>}
        </div>
        <FormRow form={facts.awayForm} side="away" />
      </div>
    </div>
  );
}
