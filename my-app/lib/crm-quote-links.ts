export type LeadQuoteOption = {
  id: string;
  quoteId?: string;
  version?: number;
  label: string;
  customerQuoteUrl: string;
  internalQuoteUrl: string;
  createdAt?: string;
  amount?: number | null;
  configuration?: string;
  isLatest?: boolean;
};

function pickStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickNestedAmount(row: Record<string, unknown>): number | null {
  for (const key of ["pricing", "quote", "summary", "totals"]) {
    const nested = row[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const amount = parseAmount((nested as Record<string, unknown>).total)
      ?? parseAmount((nested as Record<string, unknown>).grandTotal)
      ?? parseAmount((nested as Record<string, unknown>).amount);
    if (amount !== null) return amount;
  }
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function extractQuoteAmount(resp: unknown): number | null {
  if (!resp || typeof resp !== "object" || Array.isArray(resp)) return null;
  const row = resp as Record<string, unknown>;
  const direct =
    parseAmount(row.amount) ??
    parseAmount(row.quotedAmount) ??
    parseAmount(row.quoteAmount) ??
    parseAmount(row.totalAmount) ??
    parseAmount(row.grandTotal) ??
    parseAmount(row.total) ??
    parseAmount(row.finalAmount) ??
    parseAmount(row.price) ??
    parseAmount(row.netAmount) ??
    parseAmount(row.grossAmount);
  if (direct !== null) return direct;
  return pickNestedAmount(row);
}

export function extractQuoteIdFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const pathname = new URL(trimmed).pathname;
    const match = pathname.match(/\/quote\/(\d+)/i);
    return match?.[1] ?? "";
  } catch {
    const match = trimmed.match(/\/quote\/(\d+)/i);
    return match?.[1] ?? "";
  }
}

export function extractCustomerQuoteLink(resp: unknown): string {
  if (!resp || typeof resp !== "object" || Array.isArray(resp)) return "";
  const row = resp as Record<string, unknown>;
  const candidates = [
    row.customerLink,
    row.customerQuoteUrl,
    row.quoteLink,
    row.link,
    row.publicUrl,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function extractInternalQuoteLink(resp: unknown): string {
  if (!resp || typeof resp !== "object" || Array.isArray(resp)) return "";
  const row = resp as Record<string, unknown>;
  const candidates = [row.internalQuoteUrl, row.internalLink];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseVersion(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function quoteOptionFromRow(row: unknown, index: number): LeadQuoteOption | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const customerQuoteUrl = extractCustomerQuoteLink(record);
  const internalQuoteUrl = extractInternalQuoteLink(record);
  if (!customerQuoteUrl && !internalQuoteUrl) return null;

  const quoteId =
    pickStr(record, "quoteId", "id", "quote_id") ||
    extractQuoteIdFromUrl(customerQuoteUrl) ||
    extractQuoteIdFromUrl(internalQuoteUrl);
  const version = parseVersion(record.version ?? record.quoteVersion ?? record.versionNumber);
  const createdAt = pickStr(record, "createdAt", "createdOn", "updatedAt");
  const amount = extractQuoteAmount(record);
  const isLatest =
    record.isLatest === true ||
    record.latest === true ||
    record.isCurrent === true;

  const id = quoteId || customerQuoteUrl || internalQuoteUrl || `quote-${index}`;

  return {
    id,
    quoteId: quoteId || undefined,
    version,
    label: "",
    customerQuoteUrl,
    internalQuoteUrl,
    createdAt: createdAt || undefined,
    amount,
    isLatest,
  };
}

function extractQuoteRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [payload];
  const row = payload as Record<string, unknown>;
  for (const key of ["quotes", "data", "items", "versions", "results", "revisions"]) {
    const nested = row[key];
    if (Array.isArray(nested)) return nested;
  }
  return [payload];
}

function compareQuoteOptions(a: LeadQuoteOption, b: LeadQuoteOption): number {
  if (a.isLatest && !b.isLatest) return 1;
  if (!a.isLatest && b.isLatest) return -1;
  const versionDelta = (a.version ?? Number.MAX_SAFE_INTEGER) - (b.version ?? Number.MAX_SAFE_INTEGER);
  if (versionDelta !== 0) return versionDelta;
  const quoteIdDelta =
    Number(a.quoteId ?? 0) - Number(b.quoteId ?? 0);
  if (Number.isFinite(quoteIdDelta) && quoteIdDelta !== 0) return quoteIdDelta;
  const timeDelta = Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? "");
  if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
  return 0;
}

function assignDisplayVersions(options: LeadQuoteOption[]): LeadQuoteOption[] {
  const chronological = [...options].sort(compareQuoteOptions);
  return chronological.map((option, index) => {
    const versionNumber = option.version ?? index + 1;
    const isLatest = option.isLatest ?? index === chronological.length - 1;
    return {
      ...option,
      version: versionNumber,
      isLatest,
      label: isLatest ? `Version ${versionNumber} (Current)` : `Version ${versionNumber}`,
    };
  });
}

export function normalizeLeadQuoteOptions(payload: unknown): LeadQuoteOption[] {
  const rows = extractQuoteRows(payload);
  const byKey = new Map<string, LeadQuoteOption>();

  rows.forEach((row, index) => {
    const option = quoteOptionFromRow(row, index);
    if (!option) return;
    const key = option.quoteId || option.customerQuoteUrl || option.internalQuoteUrl || option.id;
    if (!byKey.has(key)) byKey.set(key, option);
  });

  const options = assignDisplayVersions([...byKey.values()]);
  return options.sort((a, b) => {
    if (a.isLatest && !b.isLatest) return -1;
    if (!a.isLatest && b.isLatest) return 1;
    return (b.version ?? 0) - (a.version ?? 0);
  });
}

export function formatQuoteAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "Amount unavailable";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function leadQuoteOptionFromSavedLink(link: string, label = "Saved quote"): LeadQuoteOption | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  const quoteId = extractQuoteIdFromUrl(trimmed);
  return {
    id: quoteId || trimmed,
    quoteId: quoteId || undefined,
    version: 1,
    label: "Version 1 (Current)",
    customerQuoteUrl: trimmed,
    internalQuoteUrl: "",
    amount: null,
    isLatest: true,
  };
}

export function sortQuotesForRevisionDisplay(options: LeadQuoteOption[]): LeadQuoteOption[] {
  return [...options].sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
}

export function buildDesignQuotePageUrl(
  quoteId: string,
  options?: { internal?: boolean; hubLeadId?: string },
): string {
  const id = quoteId.trim();
  if (!id) return "";
  const base = `https://design.hubinterior.com/quote/${encodeURIComponent(id)}`;
  const hubLeadId = options?.hubLeadId?.trim();
  if (options?.internal && hubLeadId) {
    return `${base}?internal=1&leadId=${encodeURIComponent(hubLeadId)}`;
  }
  return base;
}

export function resolveQuoteVerifyUrl(
  option: LeadQuoteOption,
  hubLeadId?: string,
): string {
  const internal = option.internalQuoteUrl.trim();
  if (internal) return internal;
  const quoteKey = option.quoteId?.trim() || option.id.trim();
  if (quoteKey) {
    return buildDesignQuotePageUrl(quoteKey, {
      internal: Boolean(hubLeadId?.trim()),
      hubLeadId,
    });
  }
  return option.customerQuoteUrl.trim();
}
