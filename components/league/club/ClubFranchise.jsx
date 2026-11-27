import React from 'react';
import { FranchisePlayerCard } from '../FranchisePlayerCard.jsx';
import { Alert } from '../../ui/Alert.jsx';
import { isOfflineError } from '../../../utils/leagueDataErrors.js';

/* Jugador Franquicia del club, al costado de su historia. Un club que todavía no lo fichó lo dice, sin inventar;
   si la lectura falló, dice eso y no que no lo fichó. */

export function ClubFranchise({ player, loading = false, error = '' }) {
  return (
    <section aria-labelledby="club-franchise" className="space-y-3">
      <h2 id="club-franchise" className="font-display text-lg font-bold uppercase tracking-wide text-crest-soft">Jugador franquicia</h2>
      {player ? (
        <FranchisePlayerCard player={player} />
      ) : loading ? (
        <div className="skeleton h-[7.5rem] w-full rounded-2xl" aria-hidden="true" />
      ) : error ? (
        <Alert tone="danger" title="No se pudo cargar el jugador franquicia.">
          {isOfflineError(error) ? 'No hay conexión. Aparece apenas vuelva.' : 'Recargá la página para intentar de nuevo.'}
        </Alert>
      ) : (
        <p className="rounded-2xl border border-dashed border-line/15 p-5 text-sm text-ink-2">
          Este club todavía no fichó su jugador franquicia.
        </p>
      )}
    </section>
  );
}

export default ClubFranchise;
