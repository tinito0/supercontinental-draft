import React from 'react';

/* Piezas chicas del registro de partidos (/partidos): escudo o monograma, estado y marcas de eventos. */

/** Escudo del club de la liga si el equipo del juego está asignado (Draft → PES); si no, sus iniciales. */
export function TeamMark({ team, teamsById, size = 'md' }) {
  const box = size === 'lg' ? 'h-16 w-16 text-xl' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-xs';
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
