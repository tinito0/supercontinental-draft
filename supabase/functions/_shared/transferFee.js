// League fee on a manager-to-manager transfer (reglamento T3, 2.D): the fee applies only to the premium, the part
// paid above the player's base value. The seller always keeps the full base value, so selling by transfer never
// leaves less money than releasing the player to the system. Shared by the market function and the app.

/**
 * @param {number} amount accepted amount, in units (dollars, not millions)
 * @param {number} baseCost the player's catalog price, in units
 * @param {number} feeRate TRANSFER_FEE_RATE
 * @returns {{ premium: number, fee: number, sellerNet: number }}
 */
export function transferSplit(amount, baseCost, feeRate) {
  const total = Math.max(0, Math.round(Number(amount) || 0));
  const base = Math.max(0, Math.round(Number(baseCost) || 0));
  const premium = Math.max(0, total - base);
  const fee = Math.round(premium * feeRate);
  return { premium, fee, sellerNet: total - fee };
}
