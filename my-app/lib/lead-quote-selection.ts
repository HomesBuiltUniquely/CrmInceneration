import type { LeadQuoteOption } from "@/lib/crm-quote-links";

export const LEAD_QUOTE_SELECTION_EVENT = "crm:lead-quote-selection-changed";

const STORAGE_KEY = "crm:lead-quote-selection";

export type LeadQuoteSelectionSnapshot = {
  quoteId: string;
  label: string;
  amount: number | null;
  configuration?: string;
  isLatest?: boolean;
  selectedInBookingDone: boolean;
};

type StoredSelections = Record<string, LeadQuoteSelectionSnapshot>;

function storageKey(leadType: string, leadId: string): string {
  return `${leadType}:${leadId}`;
}

function readAllSelections(): StoredSelections {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as StoredSelections)
      : {};
  } catch {
    return {};
  }
}

function writeAllSelections(selections: StoredSelections): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
  } catch {
    /* ignore quota errors */
  }
}

export function readLeadQuoteSelection(
  leadType: string,
  leadId: string,
): LeadQuoteSelectionSnapshot | null {
  return readAllSelections()[storageKey(leadType, leadId)] ?? null;
}

export function writeLeadQuoteSelection(
  leadType: string,
  leadId: string,
  snapshot: LeadQuoteSelectionSnapshot | null,
): void {
  const selections = readAllSelections();
  const key = storageKey(leadType, leadId);
  if (!snapshot) {
    delete selections[key];
  } else {
    selections[key] = snapshot;
  }
  writeAllSelections(selections);
}

export function snapshotFromQuoteOption(
  quote: LeadQuoteOption,
  selectedInBookingDone: boolean,
): LeadQuoteSelectionSnapshot {
  return {
    quoteId: quote.quoteId?.trim() || quote.id,
    label: quote.label,
    amount: quote.amount ?? null,
    configuration: quote.configuration?.trim() || undefined,
    isLatest: quote.isLatest,
    selectedInBookingDone,
  };
}

export function publishLeadQuoteSelection(
  leadType: string,
  leadId: string,
  quote: LeadQuoteOption,
  selectedInBookingDone: boolean,
): void {
  writeLeadQuoteSelection(leadType, leadId, snapshotFromQuoteOption(quote, selectedInBookingDone));
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LEAD_QUOTE_SELECTION_EVENT, {
      detail: { leadType, leadId },
    }),
  );
}
