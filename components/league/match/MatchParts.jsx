import React from 'react';

/* Piezas chicas del registro de partidos (/partidos): escudo o monograma, estado y marcas de eventos. */

/** Escudo del club de la liga si el equipo del juego está asignado (Draft → PES); si no, sus iniciales. */
export function TeamMark({ team, teamsById, size = 'md' }) {
  const box = size === 'lg' ? 'h-16 w-16 text-xl' : size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-9 w-9 text-xs';
  const logo = team?.draftTeamId ? teamsById?.[team.draftTeamId]?.logoUrl : null;
  if (logo) return <img src={logo} alt="" width={size === 'lg' ? 64 : size === 'sm' ? 24 : 36} height={size === 'lg' ? 64 : size === 'sm' ? 24 : 36} className={`${box} shrink-0 object-contain`} loading="lazy" />;
  const initials = String(team?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return (
    <span aria-hidden="true" className={`${box} grid shrink-0 place-items-center rounded-full bg-raised font-display font-bold text-ink-2`}>
      {initials}
    </span>
  );
}

/** «En vivo 63'» con el indicador que late, o el estado final. */
export function MatchStatus({ status, className = '' }) {
  if (status.kind === 'live') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold text-danger-soft ${className}`}>
        <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
        <span className="num">{status.label}</span>
        <span className="sr-only">en vivo</span>
      </span>
    );
  }
  return <span className={`text-ink-3 ${className}`}>{status.label}</span>;
}

/** Tarjeta amarilla o roja: el color va con texto para lectores de pantalla. */
export function CardMark({ type }) {
  const label = type === 'red' ? 'Tarjeta roja' : 'Tarjeta amarilla';
  return (
    <span title={label} className={`inline-block h-3.5 w-2.5 shrink-0 rounded-[2px] ${type === 'red' ? 'bg-danger' : 'bg-warning'}`}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

// Valoración del juego (5,0–10,0): ≥ 7 en verde, < 6 en ámbar, el resto neutro; la mejor del partido en azul.
function ratingTone(value, isBest) {
  if (isBest) return 'bg-accent text-on-accent';
  if (value >= 7) return 'bg-success text-canvas';
  if (value < 6) return 'bg-warning text-canvas';
  return 'bg-overlay text-ink';
}

/** «6,5» en una pastilla; con `isBest`, la valoración más alta del partido. Nada sin valoración. */
export function RatingChip({ value, isBest = false, size = 'sm', className = '' }) {
  if (!Number.isFinite(value)) return null;
  const box = size === 'lg' ? 'min-w-12 px-2 py-1 text-xl' : 'min-w-8 px-1.5 py-0.5 text-xs';
  const label = `Valoración ${value.toFixed(1).replace('.', ',')}${isBest ? ', la mejor del partido' : ''}`;
  return (
    <span className={`num inline-flex items-center justify-center rounded-md font-bold leading-none ${box} ${ratingTone(value, isBest)} ${className}`}
      title={label} aria-label={label}>
      {value.toFixed(1).replace('.', ',')}
    </span>
  );
}
