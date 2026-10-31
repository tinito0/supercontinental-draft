import React from 'react';
import { Check, AlertTriangle, Clock } from 'lucide-react';

const FILL = { ok: 'bg-success', fail: 'bg-danger', idle: 'bg-ink-3/40' };
const TEXT = { ok: 'text-success-soft', fail: 'text-danger-soft', idle: 'text-ink-3' };
const ICON = { ok: Check, fail: AlertTriangle, idle: Clock };

/** 'ok' | 'fail' | 'idle' (not measured yet) for a rule from evaluateSquadRules / checkBench. */
export function ruleTone(rule) {
  if (!rule.applies) return 'idle';
  return rule.ok ? 'ok' : 'fail';
}

/**
 * A squad rule's bar, drawn like the «Fuerza del once» bars: it grows with `scale` (.meter-fill) when the squad or
 * the XI changes. `tick` marks the minimum on scales where full is not the target (the bench floor). Decorative:
 * the number and the state next to it carry the information.
 */
export function RuleMeter({ fill, tick = null, tone, className = '' }) {
  return (
    <span className={`relative block h-1.5 rounded-sm bg-overlay ${className}`} aria-hidden="true">
      <span className="absolute inset-0 overflow-hidden rounded-sm">
        <span className={`meter-fill block h-full ${FILL[tone]}`} style={{ scale: `${Math.max(0, Math.min(1, fill || 0))} 1` }} />
      </span>
      {tick != null && (
        <span className="absolute -top-1 -bottom-1 w-0.5 rounded-sm bg-ink-2" style={{ left: `calc(${tick * 100}% - 1px)` }} />
      )}
    </span>
  );
}

/**
 * The rule's state in words with an icon, so it never depends on color alone. `quiet`: a passing rule shows only the
 * check (its words stay for screen readers), so in a long board what fails is what stands out.
 */
export function RuleState({ tone, children, quiet = false, className = '' }) {
  const Icon = ICON[tone];
  if (quiet && tone === 'ok') {
    return (
      <span className={`inline-flex items-center ${TEXT.ok} ${className}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">{children}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TEXT[tone]} ${className}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
