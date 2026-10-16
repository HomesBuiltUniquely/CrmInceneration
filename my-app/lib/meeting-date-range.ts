import { endOfMonth, format, isValid, parseISO, startOfMonth, subDays, subMonths } from "date-fns";

export const DATE_PRESET_IDS = [
  "this-month",
  "last-3-months",
  "last-6-months",
  "last-1-year",
  "previous-month",
  "custom",
] as const;

export type DatePresetId = (typeof DATE_PRESET_IDS)[number];

export type DateRange = { from: Date; to: Date };

export const DATE_PRESET_CARDS: Array<{ id: DatePresetId; title: string; detail: string }> = [
  { id: "this-month", title: "This month", detail: "Current calendar month (auto-resets)" },
  { id: "last-3-months", title: "Last 3 months", detail: "Rolling 90 days" },
  { id: "last-6-months", title: "Last 6 months", detail: "Rolling 6 months" },
  { id: "last-1-year", title: "Last 1 year", detail: "Rolling 12 months" },
  { id: "previous-month", title: "Previous month", detail: "Full prior calendar month" },
  { id: "custom", title: "Custom range", detail: "Pick start & end dates" },
];

export function isDatePresetId(value: string): value is DatePresetId {
  return (DATE_PRESET_IDS as readonly string[]).includes(value);
}

function dayOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Rolling presets are resolved from `today` on every call so "This month" resets when the month changes. */
export function resolveDatePreset(
  preset: DatePresetId,
  today: Date = new Date(),
  custom?: { from?: string; to?: string },
): DateRange | null {
  const day = dayOnly(today);
  switch (preset) {
    case "this-month":
      return { from: dayOnly(startOfMonth(day)), to: dayOnly(endOfMonth(day)) };
    case "last-3-months":
      return { from: dayOnly(subDays(day, 90)), to: day };
    case "last-6-months":
      return { from: dayOnly(subMonths(day, 6)), to: day };
    case "last-1-year":
      return { from: dayOnly(subMonths(day, 12)), to: day };
    case "previous-month": {
      const prior = subMonths(day, 1);
      return { from: dayOnly(startOfMonth(prior)), to: dayOnly(endOfMonth(prior)) };
    }
    case "custom": {
      if (!custom?.from || !custom?.to) return null;
      const from = parseISO(custom.from);
      const to = parseISO(custom.to);
      if (!isValid(from) || !isValid(to)) return null;
      const start = dayOnly(from);
      const end = dayOnly(to);
      return start.getTime() <= end.getTime() ? { from: start, to: end } : { from: end, to: start };
    }
    default:
      return null;
  }
}

export function formatRangeLabel(range: DateRange | null): string {
  if (!range) return "All dates";
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const from = format(range.from, sameYear ? "d MMM" : "d MMM yyyy");
  return `${from} – ${format(range.to, "d MMM yyyy")}`;
}

export function meetingFallsInRange(dateIso: string, range: DateRange): boolean {
  const parsed = parseISO(dateIso);
  if (!isValid(parsed)) return false;
  const day = dayOnly(parsed).getTime();
  return day >= range.from.getTime() && day <= range.to.getTime();
}
