import React, { useMemo } from 'react';
import { Reveal } from './Reveal.jsx';
import { buildRuleGroups } from './rules.js';
import { useSquadRulesConfig } from '../../hooks/useSquadRulesConfig.js';

/** The draft rules, one column per group (draft landing only; the league's Reglamento uses RuleBody). */
export function RuleGroups() {
  const { benchMin } = useSquadRulesConfig();
  const groups = useMemo(() => buildRuleGroups(benchMin), [benchMin]);
  return (
    <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 md:gap-14">
      {groups.map((group, gi) => (
        <Reveal key={group.title} delay={gi * 100}>
          <h3 className="section-title border-b border-line/[0.14] pb-3 text-accent-soft">{group.title}</h3>
          <dl className="mt-2">
            {group.rules.map(rule => (
              <div key={rule.title} className="py-4">
                <dt className="font-display text-xl font-semibold text-ink">{rule.title}</dt>
                <dd className="mt-1 text-ink-2">{rule.desc}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      ))}
    </div>
  );
}

export default RuleGroups;
