export type FinanceReviewStatus =
  | "NOT_READY"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export function normalizeFinanceReviewStatus(raw: unknown): FinanceReviewStatus {
  const value = String(raw ?? "NOT_READY").trim().toUpperCase();
  if (value === "PENDING") return "PENDING";
  if (value === "APPROVED") return "APPROVED";
  if (value === "REJECTED") return "REJECTED";
  return "NOT_READY";
}

export function financeReviewLabel(status: FinanceReviewStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return "—";
  }
}

export function shouldShowFinanceReview(
  status: FinanceReviewStatus,
  remainingAmount: number,
): boolean {
  if (remainingAmount > 0 && status === "NOT_READY") return false;
  return status !== "NOT_READY" || remainingAmount <= 0;
}

export function financeReviewBadgeClass(status: FinanceReviewStatus): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "REJECTED":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}
