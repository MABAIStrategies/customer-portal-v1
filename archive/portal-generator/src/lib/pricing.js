export function getDiscountTier(itemCount, tiers) {
  const sorted = [...tiers].sort((a, b) => b.minItems - a.minItems);
  for (const tier of sorted) {
    if (itemCount >= tier.minItems) return tier.discountPct;
  }
  return 0;
}

export function calculatePayback(totalInvestment, monthlyRoi) {
  if (!monthlyRoi || monthlyRoi <= 0) return null;
  return Math.ceil(totalInvestment / monthlyRoi);
}

export function applyDiscount(amount, discountPct) {
  return Math.round(amount * (1 - discountPct));
}
