import React from 'react';
import { SoftValue } from './ui/SoftValue.jsx';

/** What to do when a rule fails, in the manager's terms. */
const FIX = {
  squad: 'Fichá en el mercado hasta completar el plantel.',
  bench: 'Mandá al banco a un jugador de más media o reemplazá a un suplente.',
  locals: 'Sumá jugadores del país del club.',
};

/** «21 / 21» for counts, «70,0 · mín. 73» for the bench (a floor, not a quota). */
export const ruleTarget = rule => (rule.id === 'bench' ? `mín. ${rule.target}` : `/ ${rule.target}`);

/**
 * The reglamento's squad rules for one club (Mi Equipo), one hairline row each: the figure against its minimum, and
 * for a failing rule what to do about it. A passing rule stays quiet. `result` comes from evaluateSquadRules.
 */
export function SquadRulesStats({ result, className = '' }) {
  const failing = result.rules.filter(rule => rule.applies && !rule.ok).length;
  return (
    <section aria-labelledby="squad-rules-heading" className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="squad-rules-heading" className="section-title">Reglas del plantel</h3>
        <p className={`text-sm font-medium ${failing === 0 ? 'text-success-soft' : 'text-danger-soft'}`}>
          {failing === 0 ? 'En regla' : `${failing} sin cumplir`}
        </p>
      </div>
      <dl className="mt-2 divide-y divide-line/[0.08]">
        {result.rules.map(rule => {
          const isFailing = rule.applies && !rule.ok;
          const note = isFailing ? FIX[rule.id] : !rule.applies ? rule.detail : null;
          return (
            <div key={rule.id} className="flex items-start justify-between gap-4 py-3 min-h-11">
              <dt className="min-w-0">
                <span className="block text-sm text-ink">{rule.label}</span>
                {note && <span className={`block mt-0.5 text-xs ${isFailing ? 'text-danger-soft' : 'text-ink-3'}`}>{note}</span>}
              </dt>
              <dd className="flex items-baseline gap-1.5 shrink-0">
                <SoftValue value={rule.value} className={`font-display num text-2xl font-bold leading-none ${isFailing ? 'text-danger-soft' : 'text-ink'}`} />
                <span className="text-xs text-ink-3 num">{ruleTarget(rule)}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export default SquadRulesStats;
