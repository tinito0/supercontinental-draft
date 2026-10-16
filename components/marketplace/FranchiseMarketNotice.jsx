import React from 'react';
import { Alert } from '../ui/Alert.jsx';
import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../../utils/constants.js';

/**
 * Shown on the marketplace while the admin has the market in "Mercado Franquicia" (marketStatus 'FranchiseMarket').
 * Every line restates a rule the server enforces (supabase/functions/_shared/market.js, franchise.js).
 * @param {{ hasUsedFranchise: boolean, franchisePlayerName?: string | null, className?: string }} props
 */
export function FranchiseMarketNotice({ hasUsedFranchise, franchisePlayerName, className = '' }) {
  return (
    <Alert tone="info" title="Mercado Franquicia activo" className={className}>
      <ul className="mt-1 space-y-1 list-disc pl-4 marker:text-ink-3">
        <li>
          Por ahora solo se ficha al <strong className="font-semibold text-ink">Jugador Franquicia</strong>. El mercado
          muestra únicamente a los elegibles: <span className="num">{FRANCHISE_MIN_AGE}</span> años o más y OVR
          entre <span className="num">{FRANCHISE_MIN_OVR}</span> y <span className="num">{FRANCHISE_MAX_OVR}</span>.
        </li>
        <li>Cada manager elige uno por temporada y es gratis: no descuenta presupuesto.</li>
        <li>Queda fijo en tu plantel: no se puede liberar. Solo el admin puede resetear la franquicia.</li>
        <li>
          {hasUsedFranchise
            ? <>Ya fichaste a tu Jugador Franquicia{franchisePlayerName ? <>: <strong className="font-semibold text-ink">{franchisePlayerName}</strong></> : null}. Los fichajes normales vuelven cuando el admin reabra el mercado.</>
            : <>Para ficharlo, abrí la ficha del jugador y tocá «Jugador Franquicia ($0)». Los fichajes normales vuelven cuando el admin reabra el mercado.</>}
        </li>
      </ul>
    </Alert>
  );
}

export default FranchiseMarketNotice;
