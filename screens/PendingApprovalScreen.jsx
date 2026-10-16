import React, { memo } from 'react';
import { Hourglass, LogOut } from 'lucide-react';

/**
 * A new account waits here until the league admin approves its team (Admin → Equipos). The app shows the rest
 * as soon as that happens: it listens to the team document. Signing, offers and the chat are also refused by
 * the server and the rules until then (supabase/functions/_shared/membership.js).
 */
export const PendingApprovalScreen = memo(function PendingApprovalScreen({ teamName, onLogout }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="panel w-full max-w-md p-6 sm:p-8 text-center" role="status">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/[0.14] text-accent-soft">
          <Hourglass className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="page-title">Esperando aprobación</h1>
        <p className="mt-3 text-sm text-ink-2">
          Tu cuenta{teamName ? <> (<span className="font-semibold text-ink">{teamName}</span>)</> : null} ya está creada.
          El administrador de la liga tiene que aprobarla antes de que puedas fichar, ofertar y usar el chat.
        </p>
        <p className="mt-2 text-sm text-ink-3">Avisale por el grupo. Esta pantalla se actualiza sola cuando te aprueben.</p>
        <button type="button" onClick={onLogout} className="btn btn-ghost mt-6 min-h-11">
          <LogOut className="h-4 w-4" aria-hidden="true" />Cerrar sesión
        </button>
      </div>
    </main>
  );
});
