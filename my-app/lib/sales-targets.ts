/** Default monthly revenue target per sales executive — ₹60 lakhs. */
export const DEFAULT_MONTHLY_SALES_TARGET_INR = 60_00_000;

export type SalesTargetUserRow = {
  userId: number;
  name: string;
  role: string;
  branch?: string;
  managerName?: string;
  /** INR; falls back to default when unset. */
  monthlyTargetInr: number;
  /** True when admin set an explicit override for this month. */
  isCustom: boolean;
};

/** `YYYY-MM` for the selected incentives / target month. */
export function currentSalesTargetMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatSalesTargetMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthNum = Number(month);
  if (!year || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return monthKey;
  }
  const date = new Date(Number(year), monthNum - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function formatTargetInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatTargetLakhs(amount: number): string {
  const lakhs = amount / 100_000;
  const text = lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(2).replace(/\.?0+$/, "");
  return `₹${text} L`;
}

export function parseTargetInrInput(raw: string): number | null {
  const cleaned = raw.replace(/[,₹\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function monthSelectOptions(count = 12): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const base = new Date();
  base.setDate(1);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: formatSalesTargetMonthLabel(value) });
  }
  return options;
}
