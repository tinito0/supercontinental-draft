import React from 'react';
import { Check, Loader2, RotateCw, X } from 'lucide-react';
import { Alert } from '../ui/Alert.jsx';
import { useStatusSwap } from '../../hooks/useStatusSwap.js';
import { useReportDirty } from '../../hooks/useUnsavedGuard.js';
import { SAVE_STATUS } from './boardSaveState.js';

const LINES = {
  [SAVE_STATUS.idle]: { icon: Check, text: 'Se guarda solo', tone: 'text-ink-3' },
  [SAVE_STATUS.pending]: { text: 'Cambios sin guardar', tone: 'text-warning-soft' },
  [SAVE_STATUS.saving]: { icon: Loader2, spin: true, text: 'Guardando…', tone: 'text-accent-soft' },
  [SAVE_STATUS.saved]: { icon: Check, text: 'Guardado', tone: 'text-success-soft' },
  [SAVE_STATUS.error]: { icon: X, text: 'No se pudo guardar', tone: 'text-danger-soft' },
  [SAVE_STATUS.blocked]: { icon: X, text: 'Sin guardar: banco bajo', tone: 'text-danger-soft' },
};

/** One line under the board's title: the board saves itself, and this says where that stands (audit PIZ-5). */
export function SaveStatusLine({ status }) {
  const { shown, isLeaving } = useStatusSwap(status);
  const line = LINES[shown] || LINES[SAVE_STATUS.idle];
  const Icon = line.icon;
  return (
    <p role="status" className="h-5 text-xs font-medium whitespace-nowrap">
      <span key={shown} data-leaving={isLeaving || undefined} className={`status-swap items-center gap-1.5 ${line.tone}`}>
        {Icon && <Icon className={`w-3.5 h-3.5 ${line.spin ? 'animate-spin' : ''}`} aria-hidden="true" />}
        {line.text}
      </span>
    </p>
  );
}

/** Tells the board's unsaved-changes guard (hooks/useUnsavedGuard.js) whether edits are still unsaved. */
export function DirtyReporter({ isDirty }) {
  useReportDirty(isDirty);
  return null;
}

/** «Guardar ahora»: only while an edit waits for the autosave. */
export function SaveNowButton({ status, onSave }) {
  if (status !== SAVE_STATUS.pending) return null;
  return (
    <button type="button" onClick={onSave} className="btn btn-secondary btn-sm shrink-0">Guardar ahora</button>
  );
}

/** Why the board is not saved, kept on screen until a save goes through (audit PIZ-1, PIZ-5). */
export function SaveProblem({ problem, onRetry, isSaving, className = '' }) {
  if (!problem) return null;
  const isBench = problem.tone === 'warning';
  return (
    <Alert
      tone={problem.tone}
      title={isBench ? 'Este once no se guarda' : 'No se pudo guardar la táctica'}
      className={className}
      action={problem.canRetry ? (
        <button type="button" onClick={onRetry} disabled={isSaving} className="btn btn-secondary btn-sm">
          <RotateCw className="w-4 h-4" aria-hidden="true" />Reintentar
        </button>
      ) : null}
    >
      {isBench ? `${problem.message} Hasta que cumpla, queda guardada la última alineación válida.` : `${problem.message} Tus cambios siguen en la táctica.`}
    </Alert>
  );
}
