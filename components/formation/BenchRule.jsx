import React from 'react';
import { SoftValue } from '../ui/SoftValue.jsx';
import { getStatAndOvrColorClass } from '../../utils/helpers.js';
import { BENCH_MIN_AVG_OVR, formatAverage } from '../../utils/squadRules.js';
import { strengthBarScale } from '../../utils/teamStrength.js';

/**
 * The reglamento's bench floor under «Fuerza del once», drawn like its bars (same OVR scale and stat colours) with the
 * 73 marked on the track: the manager sees how far the bench is from the floor, not just a pass/fail light. The
 * average cross-fades and the bar grows as the XI changes. `check` comes from checkBench (utils/squadRules.js).
 */
export function BenchRule({ check, className = '' }) {
  const failing = check.applies && !check.ok;
  const note = !check.applies ? check.reason : failing ? `Por debajo de ${BENCH_MIN_AVG_OVR}: la alineación no se guarda` : null;
  return (
    <div className={className}>
      <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
        <p className="text-xs text-ink-2">Banco</p>
        <div className="flex items-center gap-3">
          <span className="relative h-1.5 flex-1 rounded-sm bg-overlay" aria-hidden="true">
            <span className="absolute inset-0 overflow-hidden rounded-sm">
              <span
                className={`strength-bar-fill block h-full ${check.average == null ? '' : getStatAndOvrColorClass(check.average)}`}
                style={{ scale: `${strengthBarScale(check.average)} 1` }}
              />
            </span>
            <span className="absolute -top-1 -bottom-1 w-0.5 rounded-sm bg-ink" style={{ left: `calc(${strengthBarScale(BENCH_MIN_AVG_OVR) * 100}% - 1px)` }} />
          </span>
          <SoftValue value={formatAverage(check.average)} className={`w-9 text-right font-display num text-base font-bold ${failing ? 'text-danger-soft' : 'text-ink'}`} />
        </div>
      </div>
      <p className={`mt-1 text-xs ${failing ? 'text-danger-soft' : 'text-ink-3'}`}>
        {note || <>Mínimo <span className="num">{BENCH_MIN_AVG_OVR}</span> · <span className="num">{check.benchCount}</span> suplentes</>}
      </p>
    </div>
  );
}

export default BenchRule;
