import React from 'react';
import { SoftValue } from './ui/SoftValue.jsx';
import { RuleMeter, RuleState, ruleTone } from './RuleMeter.jsx';

const VALUE_TEXT = { ok: 'text-ink', fail: 'text-danger-soft', idle: 'text-ink-2' };

/** «/ 21» for counts (the bar fills up to it), «mín. 73» for the bench (a floor on an OVR scale). */
export const ruleTarget = rule => (rule.tick != null ? `mín. ${rule.target}` : `/ ${rule.target}`);

/**
 * The reglamento's squad rules for one club (Mi Equipo): each one as a figure against its minimum, a bar and its
 * state in words. `result` comes from evaluateSquadRules (utils/squadRules.js).
 */
export function SquadRulesStats({ result, className = '' }) {
  const passing = result.rules.filter(rule => rule.ok).length;
  return (
    <section aria-labelledby="squad-rules-heading" className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="squad-rules-heading" className="eyebrow">Reglas del plantel</h3>
        <p className="text-xs text-ink-3">
          <span className="num font-semibold text-ink">{passing}</span> de <span className="num">{result.rules.length}</span> en regla
        </p>
      </div>
      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5">
        {result.rules.map(rule => {
          const tone = ruleTone(rule);
          return (
            <li key={rule.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <p className="text-sm text-ink-2">{rule.label}</p>
                <p className="flex items-baseline gap-1.5 sm:mt-1">
                  <SoftValue value={rule.value} className={`font-display num text-[28px] font-bold leading-none ${VALUE_TEXT[tone]}`} />
                  <span className="text-sm text-ink-3 num">{ruleTarget(rule)}</span>
                </p>
              </div>
              <RuleMeter fill={rule.fill} tick={rule.tick} tone={tone} className="mt-2.5" />
              <RuleState tone={tone} className="mt-2">{rule.detail}</RuleState>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default SquadRulesStats;
