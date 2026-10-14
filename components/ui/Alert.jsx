import React from 'react';
import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const TONES = {
  info: { icon: Info, box: 'border-accent/25 bg-accent/[0.06]', text: 'text-accent-soft' },
  success: { icon: CheckCircle2, box: 'border-success/25 bg-success/[0.06]', text: 'text-success-soft' },
  warning: { icon: AlertTriangle, box: 'border-warning/25 bg-warning/[0.07]', text: 'text-warning-soft' },
  danger: { icon: XCircle, box: 'border-danger/30 bg-danger/[0.07]', text: 'text-danger-soft' },
};

/** Inline feedback next to what it is about. Errors are announced (role="alert"), the rest politely. */
export function Alert({ tone = 'info', title, children, action, className = '' }) {
  const t = TONES[tone] || TONES.info;
  const Icon = t.icon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border px-4 py-3 ${t.box} ${className}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.text}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className={`font-semibold ${t.text}`}>{title}</p>}
        {children && <div className="text-ink-2 mt-0.5 first:mt-0">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export default Alert;
