export type BookingDatePresetId =
  | "all"
  | "3months"
  | "6months"
  | "1year"
  | "previousMonth"
  | "custom";

export type BookingDateFilterState = {
  preset: BookingDatePresetId;
  customFrom: string;
  customTo: string;
};

export const DEFAULT_BOOKING_DATE_FILTER: BookingDateFilterState = {
  preset: "all",
  customFrom: "",
  customTo: "",
};

export type ResolvedBookingDateRange = {
  submittedFrom?: string;
  submittedTo?: string;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toIsoInstant(date: Date): string {
  return date.toISOString();
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Resolve UI preset → API query range (inclusive, based on deal `submittedAt` / Hub `createdAt`). */
export function resolveBookingDateRange(
  filter: BookingDateFilterState,
): ResolvedBookingDateRange {
  if (filter.preset === "all") {
    return {};
  }

  const today = new Date();

  if (filter.preset === "3months") {
    const from = startOfDay(today);
    from.setMonth(from.getMonth() - 3);
    return {
      submittedFrom: toIsoInstant(from),
      submittedTo: toIsoInstant(endOfDay(today)),
    };
  }

  if (filter.preset === "6months") {
    const from = startOfDay(today);
    from.setMonth(from.getMonth() - 6);
    return {
      submittedFrom: toIsoInstant(from),
      submittedTo: toIsoInstant(endOfDay(today)),
    };
  }

  if (filter.preset === "1year") {
    const from = startOfDay(today);
    from.setFullYear(from.getFullYear() - 1);
    return {
      submittedFrom: toIsoInstant(from),
      submittedTo: toIsoInstant(endOfDay(today)),
    };
  }

  if (filter.preset === "previousMonth") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      submittedFrom: toIsoInstant(startOfDay(first)),
      submittedTo: toIsoInstant(endOfDay(last)),
    };
  }

  if (filter.preset === "custom") {
    const fromRaw = filter.customFrom.trim();
    const toRaw = filter.customTo.trim();
    if (!fromRaw && !toRaw) return {};
    const range: ResolvedBookingDateRange = {};
    if (fromRaw) {
      range.submittedFrom = toIsoInstant(startOfDay(new Date(`${fromRaw}T00:00:00`)));
    }
    if (toRaw) {
      range.submittedTo = toIsoInstant(endOfDay(new Date(`${toRaw}T00:00:00`)));
    }
    if (range.submittedFrom && range.submittedTo) {
      const fromMs = new Date(range.submittedFrom).getTime();
      const toMs = new Date(range.submittedTo).getTime();
      if (fromMs > toMs) {
        return {
          submittedFrom: range.submittedTo,
          submittedTo: range.submittedFrom,
        };
      }
    }
    return range;
  }

  return {};
}

export type BookingDateApiParams = {
  dateRange?: string;
  submittedFrom?: string;
  submittedTo?: string;
};

/** Map UI preset → Hub `dateRange` query param (custom dates use submittedFrom/To). */
export function bookingDateFilterApiParams(filter: BookingDateFilterState): BookingDateApiParams {
  if (filter.preset === "all") return {};

  if (filter.preset === "custom") {
    const range = resolveBookingDateRange(filter);
    const params: BookingDateApiParams = {};
    if (range.submittedFrom) params.submittedFrom = range.submittedFrom;
    if (range.submittedTo) params.submittedTo = range.submittedTo;
    return params;
  }

  const dateRangeByPreset: Partial<Record<BookingDatePresetId, string>> = {
    previousMonth: "previous_month",
    "3months": "3m",
    "6months": "6m",
    "1year": "1y",
  };
  const dateRange = dateRangeByPreset[filter.preset];
  return dateRange ? { dateRange } : {};
}

/** @deprecated Prefer bookingDateFilterApiParams for Hub queries */
export function bookingDateFilterQueryParams(
  filter: BookingDateFilterState,
): ResolvedBookingDateRange {
  return resolveBookingDateRange(filter);
}

export function isBookingDateFilterActive(filter: BookingDateFilterState): boolean {
  if (filter.preset === "all") return false;
  if (filter.preset !== "custom") return true;
  return Boolean(filter.customFrom.trim() || filter.customTo.trim());
}

export function bookingDateFilterSummary(filter: BookingDateFilterState): string {
  const range = resolveBookingDateRange(filter);
  if (filter.preset === "all") return "All dates";
  if (filter.preset === "3months") return "Last 3 months";
  if (filter.preset === "6months") return "Last 6 months";
  if (filter.preset === "1year") return "Last 1 year";
  if (filter.preset === "previousMonth") {
    const now = new Date();
    const label = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    return `Previous month · ${label}`;
  }
  if (filter.preset === "custom") {
    if (range.submittedFrom && range.submittedTo) {
      return `${formatDisplayDate(range.submittedFrom)} – ${formatDisplayDate(range.submittedTo)}`;
    }
    if (range.submittedFrom) return `From ${formatDisplayDate(range.submittedFrom)}`;
    if (range.submittedTo) return `Until ${formatDisplayDate(range.submittedTo)}`;
    return "Custom range";
  }
  return "All dates";
}

export const BOOKING_DATE_PRESETS: {
  id: BookingDatePresetId;
  label: string;
  hint: string;
}[] = [
  { id: "3months", label: "Last 3 months", hint: "Rolling 90 days" },
  { id: "6months", label: "Last 6 months", hint: "Rolling 6 months" },
  { id: "1year", label: "Last 1 year", hint: "Rolling 12 months" },
  { id: "previousMonth", label: "Previous month", hint: "Full prior calendar month" },
  { id: "custom", label: "Custom range", hint: "Pick start & end dates" },
];
