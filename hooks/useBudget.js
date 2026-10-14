import { useState, useMemo, useRef, useEffect } from 'react';

/**
 * Hook personalizado para encapsular el cálculo del presupuesto,
 * fondos comprometidos en transferencias activas y alertas de bajo saldo.
 */
export function useBudget({ userProfile, ownedCart = [], userId, sentOffers = [] }) {
  const totalCartCost = useMemo(() => {
    return ownedCart.reduce((total, player) => {
      const isFranchise = player.isFranchise || (userProfile?.franchisePlayerId === player.Id);
      return total + (isFranchise ? 0 : (Number(player.Precio) || 0) * 1000000);
    }, 0);
  }, [ownedCart, userProfile]);

  const committedInOffers = useMemo(() => {
    if (!userId || !sentOffers) return 0;
    return sentOffers
      .filter(o => o.senderId === userId && o.status === 'pending')
      .reduce((sum, o) => sum + (Number(o.offerAmount) || 0), 0);
  }, [userId, sentOffers]);

  const remainingBudget = useMemo(() => {
    if (!userProfile) return 0;
    const baseBudget = Number(userProfile.budget) || 0;
    return baseBudget - totalCartCost - committedInOffers;
  }, [userProfile, totalCartCost, committedInOffers]);

  const [showBudgetAlert, setShowBudgetAlert] = useState(false);

  const budgetPercent = useMemo(() => {
    if (!userProfile?.budget) return 100;
    return Math.max(0, (remainingBudget / userProfile.budget) * 100);
  }, [remainingBudget, userProfile?.budget]);

  // Mostrar alerta modal automáticamente cuando un fichaje hace caer el saldo por debajo del 20%
  const prevBudgetPercentRef = useRef(null);
  useEffect(() => {
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
  }, [budgetPercent]);

  return {
    totalCartCost,
    committedInOffers,
    remainingBudget,
    budgetPercent,
    showBudgetAlert,
    setShowBudgetAlert,
  };
}
