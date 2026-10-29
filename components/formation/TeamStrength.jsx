import React from 'react';
import { SoftValue } from '../ui/SoftValue.jsx';
import { getStatAndOvrColorClass } from '../../utils/helpers.js';
import { teamStrength, strengthBarScale, STRENGTH_LINES } from '../../utils/teamStrength.js';

const show = value => (value == null ? '–' : String(value));

/**
 * Average OVR of each line of the starting XI (utils/teamStrength.js), as PES shows team strength next to the squad.
 * Values cross-fade and bars grow when the lineup changes. `starters`: [{ pos, ovr }] with the role each one plays.
 */
export function TeamStrength({ starters, className = '' }) {
  const strength = teamStrength(starters);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Fuerza del once</p>
        <p className="flex items-baseline gap-1.5 text-xs text-ink-3">
          Media
          <SoftValue value={show(strength.overall)} className="font-display num text-xl font-bold text-ink" />
        </p>
      </div>
      <dl className="mt-2 space-y-1.5">
        {STRENGTH_LINES.map(line => {
          const value = strength[line.key];
          return (
            <div key={line.key} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
              <dt className="text-xs text-ink-2">{line.label}</dt>
              <dd className="flex items-center gap-3">
                <span className="h-1.5 flex-1 rounded-sm bg-overlay overflow-hidden" aria-hidden="true">
                  <span
                    className={`strength-bar-fill block h-full ${value == null ? '' : getStatAndOvrColorClass(value)}`}
                    style={{ scale: `${strengthBarScale(value)} 1` }}
                  />
                </span>
                <SoftValue value={show(value)} className="w-7 font-display num text-base font-bold text-ink" />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export default TeamStrength;
