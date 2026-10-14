import React from 'react';

const TONES = { default: 'text-ink', accent: 'text-accent-soft', success: 'text-success-soft', warning: 'text-warning-soft', danger: 'text-danger-soft' };

/**
 * A key number: small label above, big condensed tabular value, optional hint below.
 * No box of its own — place several in a row separated by spacing or a divider.
 */
export function Stat({ label, value, hint, tone = 'default', size = 'md', className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className={`font-display num font-bold leading-none mt-1.5 ${size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-[28px]'} ${TONES[tone] || TONES.default}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3 truncate">{hint}</p>}
    </div>
  );
}

export default Stat;
