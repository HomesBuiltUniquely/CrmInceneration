/** Split a payment into 10% milestone portion vs extra sent to Finance. */
export function splitPaymentTowardTenAndExtra(
  amount: number,
  remainingTowardTen: number,
): { towardTen: number; extraToFinance: number } {
  const safeRemaining = Math.max(0, remainingTowardTen);
  const towardTen = Math.min(amount, safeRemaining);
  const extraToFinance = Math.max(0, amount - towardTen);
  return { towardTen, extraToFinance };
}

export type CustomerPaymentBreakdown = {
  tenPercentTarget: number;
  towardTen: number;
  extraToFinance: number;
  totalCustomerPaid: number;
  remainingTowardTen: number;
};

/** Normalize Hub payment totals for display (Convert modal, Pay panel). */
export function resolveCustomerPaymentBreakdown(input: {
  tenPercentAmount: number;
  amountReceived: number;
  remainingAmount: number;
  extraAmountReceived?: number | null;
  totalAmountReceived?: number | null;
}): CustomerPaymentBreakdown {
  const tenPercentTarget = Math.max(0, input.tenPercentAmount);
  const towardTen = Math.min(Math.max(0, input.amountReceived), tenPercentTarget);
  const extraFromHub =
    input.extraAmountReceived != null && Number.isFinite(input.extraAmountReceived)
      ? Math.max(0, input.extraAmountReceived)
      : Math.max(0, input.amountReceived - tenPercentTarget);
  const totalFromHub =
    input.totalAmountReceived != null && Number.isFinite(input.totalAmountReceived)
      ? Math.max(0, input.totalAmountReceived)
      : towardTen + extraFromHub;

  return {
    tenPercentTarget,
    towardTen,
    extraToFinance: extraFromHub,
    totalCustomerPaid: totalFromHub,
    remainingTowardTen: Math.max(0, input.remainingAmount),
  };
}
