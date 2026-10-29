import React from 'react';
import { Reveal } from './Reveal.jsx';
import { RULE_GROUPS } from './rules.js';

/** The draft rules in two columns (draft landing and the league site's Reglamento). */
export function RuleGroups() {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      {RULE_GROUPS.map((group, gi) => (
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
