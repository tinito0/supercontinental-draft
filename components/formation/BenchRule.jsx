import React from 'react';
import { SoftValue } from '../ui/SoftValue.jsx';
import { RuleMeter, RuleState, ruleTone } from '../RuleMeter.jsx';
import { BENCH_MIN_AVG_OVR, formatAverage } from '../../utils/squadRules.js';
import { strengthBarScale } from '../../utils/teamStrength.js';

/**
 * The reglamento's bench floor next to «Fuerza del once», on the same OVR scale as its bars, with the 73 marked.
 * The average cross-fades and the bar grows as the XI changes, so the manager sees a save would be blocked before
 * making it. `check` comes from checkBench (utils/squadRules.js).
 */
export function BenchRule({ check, className = '' }) {
  const tone = ruleTone(check);
  const state = tone === 'idle' ? check.reason : tone === 'fail' ? 'Por debajo del mínimo: no se guarda' : 'Cumple';
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Media del banco</p>
        <p className="flex items-baseline gap-1.5 text-xs text-ink-3">
          mín. <span className="num">{BENCH_MIN_AVG_OVR}</span>
          <SoftValue
            value={formatAverage(check.average)}
            className={`font-display num text-xl font-bold ${tone === 'fail' ? 'text-danger-soft' : 'text-ink'}`}
          />
        </p>
      </div>
      <RuleMeter fill={strengthBarScale(check.average)} tick={strengthBarScale(BENCH_MIN_AVG_OVR)} tone={tone} className="mt-2" />
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <RuleState tone={tone}>{state}</RuleState>
        {check.benchCount > 0 && <span className="text-xs text-ink-3"><span className="num">{check.benchCount}</span> suplentes</span>}
      </p>
    </div>
  );
}

export default BenchRule;
