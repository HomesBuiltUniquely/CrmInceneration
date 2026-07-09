import { DEFAULT_MONTHLY_SALES_TARGET_INR } from "@/lib/sales-targets";

/** First or second half of a calendar month (15-day incentive window). */
export type IncentivePeriodHalf = "H1" | "H2";

/** Default target per 15-day period — ₹30L (half of ₹60L monthly). */
export const DEFAULT_INCENTIVE_PERIOD_TARGET_INR = DEFAULT_MONTHLY_SALES_TARGET_INR / 2;

export function incentivePeriodHalfFromDate(date: Date): IncentivePeriodHalf {
  return date.getDate() <= 15 ? "H1" : "H2";
}

export function currentIncentivePeriodHalf(): IncentivePeriodHalf {
  return incentivePeriodHalfFromDate(new Date());
}

/** `YYYY-MM-H1` or `YYYY-MM-H2` from an ISO timestamp. */
export function incentivePeriodKeyFromIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const half = incentivePeriodHalfFromDate(d);
  return `${d.getFullYear()}-${month}-${half}`;
}

export function incentivePeriodKey(monthKey: string, half: IncentivePeriodHalf): string {
  return `${monthKey}-${half}`;
}

export function periodTargetFromMonthly(monthlyTargetInr: number): number {
  if (!Number.isFinite(monthlyTargetInr) || monthlyTargetInr <= 0) {
    return DEFAULT_INCENTIVE_PERIOD_TARGET_INR;
  }
  return Math.round(monthlyTargetInr / 2);
}

export function formatIncentivePeriodHalfLabel(half: IncentivePeriodHalf): string {
  return half === "H1" ? "1st – 15th" : "16th – end";
}

export function formatIncentivePeriodLabel(monthKey: string, half: IncentivePeriodHalf): string {
  const [year, month] = monthKey.split("-");
  const monthNum = Number(month);
  if (!year || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return `${monthKey} · ${formatIncentivePeriodHalfLabel(half)}`;
  }
  const date = new Date(Number(year), monthNum - 1, 1);
  const monthName = date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return `${monthName} · ${formatIncentivePeriodHalfLabel(half)}`;
}

export const INCENTIVE_PERIOD_HALF_OPTIONS: { value: IncentivePeriodHalf; label: string }[] = [
  { value: "H1", label: "1st – 15th (₹30L target)" },
  { value: "H2", label: "16th – end (₹30L target)" },
];

export function leadInIncentivePeriod(
  iso: string,
  monthKey: string,
  half: IncentivePeriodHalf,
): boolean {
  return incentivePeriodKeyFromIso(iso) === incentivePeriodKey(monthKey, half);
}
