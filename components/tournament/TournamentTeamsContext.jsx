import React, { createContext, useContext, memo } from 'react';

export const TournamentTeamsContext = createContext([]);

export const TeamSelect = memo(function TeamSelect({ value, onChange, className = '' }) {
  const teams = useContext(TournamentTeamsContext);
  const currentValue = value || '';
  const hasCurrentValue = currentValue && !teams.some(team => team.name === currentValue);
  return (
    <select
      value={currentValue}
      onChange={event => onChange(event.target.value)}
      className={`bg-surface text-ink rounded-lg border border-line/[0.12] px-2 py-1 outline-none focus:border-accent text-xs transition-colors ${className}`}
    >
      <option value="">Seleccionar club...</option>
      {hasCurrentValue && <option value={currentValue}>{currentValue}</option>}
      {teams.map(team => <option key={team.id} value={team.name}>{team.name}</option>)}
    </select>
  );
});

export default TournamentTeamsContext;
