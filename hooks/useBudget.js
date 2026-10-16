import { useState, useMemo, useRef, useEffect } from 'react';
import { committedInOffers as sumCommitted, spentOnLocks } from '../supabase/functions/_shared/budget.js';
import { ownedLockEntries } from '../utils/squadSync.js';

/**
 * Presupuesto con la misma cuenta que el servidor (supabase/functions/_shared/budget.js):
 * base del equipo − precio de catálogo de los jugadores propios (según player_locks, no el carrito) −
 * ofertas pendientes enviadas. El Jugador Franquicia no cuesta.
 * @param {number} baseBudget teams/{uid}.budget (el servidor lo cambia en los traspasos)
 * @param {(playerId: string) => number} priceOf precio en millones
 */
export function calculateBudget({ baseBudget, playerLocks, userId, sentOffers = [], priceOf, franchisePlayerId }) {
  const spent = spentOnLocks(ownedLockEntries(playerLocks, userId), priceOf, { franchisePlayerId });
  const committed = userId
    ? sumCommitted((sentOffers || []).filter(o => o.senderId === userId && o.status === 'pending'))
    : 0;
  const base = Number(baseBudget) || 0;
  return { base, spent, committed, remaining: base - spent - committed };
}

/**
 * @param {boolean} [pricesKnown] false while some owned player has no price yet (bought, catalog loading):
 *   the alert waits, so a transient high balance followed by the real one does not trigger it.
 */
export function useBudget({ userProfile, baseBudget, playerLocks, userId, sentOffers = [], priceOf, pricesKnown = true }) {
  const franchisePlayerId = userProfile?.franchisePlayerId;
  const { base, spent: totalCartCost, committed: committedInOffers, remaining } = useMemo(
    () => calculateBudget({ baseBudget: baseBudget ?? userProfile?.budget, playerLocks, userId, sentOffers, priceOf, franchisePlayerId }),
    [baseBudget, userProfile?.budget, playerLocks, userId, sentOffers, priceOf, franchisePlayerId],
  );
  const remainingBudget = userProfile ? remaining : 0;

  const [showBudgetAlert, setShowBudgetAlert] = useState(false);

  const budgetPercent = base ? Math.max(0, (remainingBudget / base) * 100) : 100;

  // Mostrar alerta modal automáticamente cuando un fichaje hace caer el saldo por debajo del 20%
  const prevBudgetPercentRef = useRef(null);
  useEffect(() => {
    if (!pricesKnown) return;
    if (prevBudgetPercentRef.current === null) {
      prevBudgetPercentRef.current = budgetPercent;
      return;
    }
    const hasShownAlert = sessionStorage.getItem('budget_alert_shown') === 'true';
    if (!hasShownAlert && prevBudgetPercentRef.current > 20 && budgetPercent <= 20 && budgetPercent > 0) {
      setShowBudgetAlert(true);
      try { sessionStorage.setItem('budget_alert_shown', 'true'); } catch {}
    }
    prevBudgetPercentRef.current = budgetPercent;
  }, [budgetPercent, pricesKnown]);

  return {
    budgetBase: base,
    totalCartCost,
    committedInOffers,
    remainingBudget,
    budgetPercent,
    showBudgetAlert,
    setShowBudgetAlert,
  };
}
