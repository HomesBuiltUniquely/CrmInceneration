export type LeadQuoteOption = {
  id: string;
  version?: number;
  label: string;
  customerQuoteUrl: string;
  internalQuoteUrl: string;
  createdAt?: string;
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

  const quoteId = pickStr(record, "quoteId", "id", "quote_id");
  const version = parseVersion(record.version ?? record.quoteVersion ?? record.versionNumber);
  const createdAt = pickStr(record, "createdAt", "createdOn", "updatedAt");
  const isLatest =
    record.isLatest === true ||
    record.latest === true ||
    record.isCurrent === true;

  const id = quoteId || customerQuoteUrl || internalQuoteUrl || `quote-${index}`;
  const versionLabel =
    version !== undefined ? `Version ${version}` : quoteId ? `Quote ${quoteId}` : `Quote ${index + 1}`;

  return {
    id,
    version,
    label: versionLabel,
    customerQuoteUrl,
    internalQuoteUrl,
    createdAt: createdAt || undefined,
    isLatest,
  };
}

function extractQuoteRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [payload];
  const row = payload as Record<string, unknown>;
  for (const key of ["quotes", "data", "items", "versions", "results"]) {
    const nested = row[key];
    if (Array.isArray(nested)) return nested;
  }
  return [payload];
}

export function normalizeLeadQuoteOptions(payload: unknown): LeadQuoteOption[] {
  const rows = extractQuoteRows(payload);
  const byKey = new Map<string, LeadQuoteOption>();

  rows.forEach((row, index) => {
    const option = quoteOptionFromRow(row, index);
    if (!option) return;
    const key = option.customerQuoteUrl || option.internalQuoteUrl || option.id;
    if (!byKey.has(key)) byKey.set(key, option);
  });

  const options = [...byKey.values()];
  options.sort((a, b) => {
    if (a.isLatest && !b.isLatest) return -1;
    if (!a.isLatest && b.isLatest) return 1;
    const versionDelta = (b.version ?? -1) - (a.version ?? -1);
    if (versionDelta !== 0) return versionDelta;
    const timeDelta =
      Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "");
    if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
    return 0;
  });

  if (options.length > 0 && !options.some((option) => option.isLatest)) {
    options[0] = { ...options[0], isLatest: true };
  }

  return options.map((option, index) => ({
    ...option,
    label:
      option.isLatest && options.length > 1
        ? `${option.label} (Latest)`
        : option.isLatest && options.length === 1
          ? `${option.label} (Latest)`
          : option.label,
    id: option.id || `quote-${index}`,
  }));
}

export function leadQuoteOptionFromSavedLink(link: string, label = "Saved quote"): LeadQuoteOption | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  return {
    id: trimmed,
    label: `${label} (Latest)`,
    customerQuoteUrl: trimmed,
    internalQuoteUrl: "",
    isLatest: true,
  };
}
