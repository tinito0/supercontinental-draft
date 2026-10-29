import React, { memo } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Alert } from '../ui/Alert.jsx';
import { teamKey } from '../../utils/competitionRules.js';

/**
 * Empates de la tabla que ningún criterio del reglamento resuelve: el admin decide el orden (`tieBreakOrder`).
 * Antes el aviso pedía decidirlo pero cada guardado volvía a ordenar alfabéticamente.
 * @param {{ groups: string[][], order: string[], onChange: (order: string[]) => void }} props
 */
export const TieBreakEditor = memo(function TieBreakEditor({ groups, order = [], onChange }) {
  if (!groups?.length) return null;

  const sortGroup = group => {
    const keys = order.map(teamKey);
    return [...group].sort((a, b) => {
      const ia = keys.indexOf(teamKey(a));
      const ib = keys.indexOf(teamKey(b));
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    });
  };

  const move = (group, from, to) => {
    const sorted = sortGroup(group);
    if (to < 0 || to >= sorted.length) return;
    [sorted[from], sorted[to]] = [sorted[to], sorted[from]];
    const groupKeys = new Set(group.map(teamKey));
    onChange([...order.filter(name => !groupKeys.has(teamKey(name))), ...sorted]);
  };

  return (
    <Alert tone="warning" title="Empates que el reglamento no resuelve">
      <p className="mb-2">Iguales en puntos, diferencia, victorias y goles. Ordenalos vos: el orden se guarda y se respeta mientras sigan empatados.</p>
      <div className="space-y-3">
        {groups.map(group => {
          const sorted = sortGroup(group);
          const list = (
            <ol key={group.join('|')} className="space-y-1" aria-label={`Empate entre ${group.join(', ')}`}>
              {sorted.map((name, index) => (
                <li key={name} className="flex min-h-11 items-center gap-2 rounded-lg bg-white/[0.04] pl-3">
                  <span className="num w-5 text-xs text-ink-3">{index + 1}</span>
                  <span className="flex-1 truncate text-sm text-ink">{name}</span>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`Subir a ${name}`} disabled={index === 0} onClick={() => move(group, index, index - 1)}>
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`Bajar a ${name}`} disabled={index === sorted.length - 1} onClick={() => move(group, index, index + 1)}>
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          );
          // Un empate grande (p. ej. media tabla igualada) arranca plegado para no ocupar toda la pantalla.
          if (group.length <= 4) return list;
          return (
            <details key={group.join('|')} className="rounded-lg bg-white/[0.03] px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink">
                <span className="num mr-1">{group.length}</span> clubes empatados · ordenar
              </summary>
              <div className="pb-3">{list}</div>
            </details>
          );
        })}
      </div>
    </Alert>
  );
});

export default TieBreakEditor;
