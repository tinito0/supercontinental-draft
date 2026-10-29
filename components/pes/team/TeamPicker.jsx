import React, { useMemo } from 'react';

/**
 * Native select of game teams (keyboard type-ahead and screen reader support come with it).
 * League teams are grouped first; an unknown stored id stays selectable as «ID n» so it is never lost.
 */
export function TeamPicker({ id, value, teams, leagueIds = [], noneValue, noneLabel = 'Ninguno', excludeId, disabled, onChange, ...aria }) {
  // ~870 options per picker and three pickers per section: build them once per team list.
  const { known, groups } = useMemo(() => {
    const league = new Set(leagueIds);
    const options = teams.filter(t => t.id !== excludeId && t.name).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const opt = t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>;
    const inLeague = options.filter(t => league.has(t.id));
    const rest = options.filter(t => !league.has(t.id));
    return {
      known: new Set(options.map(t => t.id)),
      groups: inLeague.length > 0 ? (
        <>
          <optgroup label="Equipos de la liga">{inLeague.map(opt)}</optgroup>
          <optgroup label="Todos">{rest.map(opt)}</optgroup>
        </>
      ) : rest.map(opt),
    };
  }, [teams, leagueIds, excludeId]);
  const isKnown = value === noneValue || known.has(value);
  return (
    <select id={id} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} className="select w-full" {...aria}>
      {noneValue != null && <option value={noneValue}>{noneLabel}</option>}
      {!isKnown && <option value={value}>ID {value}</option>}
      {groups}
    </select>
  );
}
