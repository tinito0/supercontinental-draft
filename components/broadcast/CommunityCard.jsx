import React, { memo } from 'react';
import { BroadcastFrame } from './BroadcastFrame.jsx';
import { LEAVE_MS, shownKey, useRemaining } from './OverlayPopup.jsx';

// Tarjeta de la comunidad sobre el overlay de OBS (lado izquierdo, el popup con QR va a la derecha): el MVP que va
// ganando, la predicción del partido o la encuesta de la copa, con los votos en vivo (utils/overlayLive.js).
// La muestran el admin, Macro Deck (action card) o match-feed solo (al arrancar y desde el minuto 70).

const PREDICTION_LABEL = { home: null, draw: 'Empate', away: null };

function ShareRow({ label, pct, isLeader, detail }) {
  return (
    <li className={`scl-card-row ${isLeader ? 'is-leader' : ''}`}>
      <div className="scl-card-row-head">
        <span className="scl-card-row-name">{label}</span>
        <span className="scl-card-row-pct">{pct}%</span>
      </div>
      <div className="scl-card-bar" aria-hidden="true"><span style={{ transform: `scaleX(${pct / 100})` }} /></div>
      {detail && <div className="scl-card-row-detail">{detail}</div>}
    </li>
  );
}

function verdict(shares, homeName, awayName) {
  if (!shares.leader) return 'Dividida';
  if (shares.leader === 'draw') return 'Ven empate';
  return `Ganan: ${shares.leader === 'home' ? homeName : awayName}`;
}

function cardContent(kind, live, homeName, awayName) {
  if (kind === 'mvp' && live?.mvpTop?.length) {
    return {
      title: 'MVP en vivo',
      aside: 'Votá en /en-vivo',
      rows: live.mvpTop.map((entry, index) => ({ key: String(entry.id), label: entry.name, pct: entry.pct, isLeader: index === 0 })),
    };
  }
  if (kind === 'prediction' && live?.prediction) {
    const shares = live.prediction;
    const names = { ...PREDICTION_LABEL, home: homeName, away: awayName };
    return {
      title: 'La comunidad predijo',
      aside: verdict(shares, homeName, awayName),
      rows: ['home', 'draw', 'away'].map(side => ({ key: side, label: names[side], pct: shares[side], isLeader: shares.leader === side })),
      footer: `${shares.total} ${shares.total === 1 ? 'voto' : 'votos'}`,
    };
  }
  if (kind === 'cup' && live?.cup?.total) {
    return {
      title: live.cup.title,
      aside: live.cup.open ? 'Votá en /en-vivo' : 'Encuesta cerrada',
      rows: live.cup.options.map((option, index) => ({ key: option.id, label: option.name, pct: option.pct, isLeader: index === 0 && option.votes > 0 })),
      footer: `${live.cup.total} ${live.cup.total === 1 ? 'voto' : 'votos'}`,
    };
  }
  return null;
}

export const CommunityCard = memo(function CommunityCard({ card, live, homeName, awayName, side = 'left' }) {
  const remaining = useRemaining(card);
  if (remaining === 0) return null;
  // Sin votos no hay nada que mostrar: la tarjeta no aparece vacía.
  const content = cardContent(card.kind, live, homeName, awayName);
  if (!content) return null;
  const isLeaving = remaining !== null && remaining <= LEAVE_MS;
  return (
    <BroadcastFrame
      key={`${shownKey(card)}|${card.kind}`}
      className={`scl-popup scl-card ${isLeaving ? 'is-leaving' : ''}`}
      dataPosition={side}
      kicker="Comunidad"
      title={content.title}
    >
      <div className="scl-card-aside">{content.aside}</div>
      <ol className="scl-card-rows">
        {content.rows.map(({ key, ...row }) => <ShareRow key={key} {...row} />)}
      </ol>
      {content.footer && <div className="scl-card-footer">{content.footer}</div>}
    </BroadcastFrame>
  );
});

export default CommunityCard;
