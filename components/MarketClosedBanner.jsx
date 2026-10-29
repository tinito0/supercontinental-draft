import React, { memo, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { parseOpenTime } from '../supabase/functions/_shared/marketTime.js';
import { formatCountdown } from '../utils/marketCountdown.js';

const TICK_MS = 1000;

/**
 * Shown on top of every tab while the market is closed. The rest of the app (tactics, tournament, chat, team
 * views) keeps working; signing, offers and releases are disabled until it opens. A scheduled opening shows the
 * date and a live countdown; app.jsx re-renders at that instant (setMarketClock), which removes the banner.
 */
export const MarketClosedBanner = memo(function MarketClosedBanner({ marketStatus }) {
  const openAt = marketStatus?.status === 'scheduled' ? parseOpenTime(marketStatus.openTime) : null;
  const openAtMs = openAt ? openAt.getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!openAtMs) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [openAtMs]);

  const openLabel = openAt?.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const countdown = openAt ? formatCountdown(openAt.getTime() - now) : '';

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <Lock className="w-5 h-5 shrink-0 mt-0.5 text-warning-soft" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-ink">Mercado cerrado</p>
        <p className="text-ink-2">
          {openAt
            ? <>Abre el <span className="font-semibold text-ink">{openLabel}</span>{countdown && <> · faltan <span className="num font-semibold text-warning-soft">{countdown}</span></>}.</>
            : 'El administrador pausó el mercado. Atento al grupo para novedades.'}
          {' '}Mientras tanto podés ver tu plantel, armar tácticas y seguir el torneo; los fichajes, ofertas y liberaciones vuelven cuando abra.
        </p>
      </div>
    </div>
  );
});
