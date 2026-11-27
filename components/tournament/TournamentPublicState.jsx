import React from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';

/**
 * What /draft/torneo shows while there is no tournament data to render.
 * status: 'loading' | 'missing' (document does not exist) | 'error' (read failed).
 */
export function TournamentPublicState({ status, onRetry }) {
  return (
    <main className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4 py-10">
      {status === 'loading' && (
        <div role="status" className="flex items-center gap-2 font-bold tracking-wider uppercase text-ink">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Cargando torneo...
        </div>
      )}
      {status === 'missing' && (
        <EmptyState
          icon={Trophy}
          title="Todavía no hay torneo"
          description="Cuando la liga cargue el torneo, la tabla y los cruces aparecen acá."
        >
          <a href="/torneo" className="btn btn-primary mt-5 min-h-[44px]">Ver el torneo en el sitio de la liga</a>
        </EmptyState>
      )}
      {status === 'error' && (
        <Alert
          tone="danger"
          title="No se pudo cargar el torneo"
          className="w-full max-w-md"
          action={<Button variant="secondary" className="min-h-[44px]" onClick={onRetry}>Reintentar</Button>}
        >
          Falló la conexión con el servidor. Revisá tu internet y probá de nuevo.
        </Alert>
      )}
    </main>
  );
}

export default TournamentPublicState;
