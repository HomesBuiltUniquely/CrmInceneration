import type { LeadQuoteOption } from "@/lib/crm-quote-links";
import { buildDesignQuotePageUrl, formatQuoteAmount } from "@/lib/crm-quote-links";

export type ProlanceQuoteRevision = {
  quoteId: number;
  createdAt: string;
};

export type ProlanceQuoteShareResponse = {
  message?: string;
  status?: boolean;
  data?: Record<string, unknown>;
};

type QuoteOptionRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return String(value);
  }
  return "";
}

function normalizeBhkLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/\bbhk\b/i.test(trimmed)) return trimmed.replace(/\s+/g, " ");
  if (/^\d+$/.test(trimmed)) return `${trimmed} BHK`;
  const match = trimmed.match(/(\d+)\s*(?:bhk)?/i);
  if (match) return `${match[1]} BHK`;
  return trimmed;
}

function extractBhkFromText(raw: string): string {
  const match = raw.match(/\b(\d)\s*BHK\b/i);
  return match ? `${match[1]} BHK` : "";
}

export function extractProlanceQuoteConfiguration(data: unknown): string {
  const row = asRecord(data);
  const direct = pickStr(
    row,
    "configuration",
    "propertyConfiguration",
    "property_configuration",
    "bhk",
    "noOfBhk",
    "no_of_bhk",
    "propertyType",
    "property_type",
    "unitType",
    "unitConfiguration",
    "interiorSetup",
    "interior_setup",
    "projectConfiguration",
  );
  if (direct) return normalizeBhkLabel(direct);

  const nestedSources = [row.propertyDetails, row.leadDetails, row.projectDetails];
  for (const source of nestedSources) {
    const nested = asRecord(source);
    const nestedValue = pickStr(
      nested,
      "configuration",
      "propertyConfiguration",
      "bhk",
      "noOfBhk",
      "propertyType",
      "unitType",
    );
    if (nestedValue) return normalizeBhkLabel(nestedValue);
  }

  for (const key of ["projectName", "propertyName", "leadName", "customerName", "quoteTitle"]) {
    const fromName = extractBhkFromText(String(row[key] ?? ""));
    if (fromName) return fromName;
  }

  const quoteOptionsData = Array.isArray(row.quoteOptionsData)
    ? (row.quoteOptionsData as QuoteOptionRow[])
    : [];
  for (const option of quoteOptionsData) {
    const optionValue = pickStr(
      option,
      "configuration",
      "bhk",
      "propertyType",
      "unitType",
      "optionName",
      "name",
    );
    if (optionValue) return normalizeBhkLabel(optionValue);
    const fromOptionName = extractBhkFromText(
      pickStr(option, "optionName", "name", "label", "title"),
    );
    if (fromOptionName) return fromOptionName;
  }

  return "";
}

function parseNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sumOptionRowTotals(rows: QuoteOptionRow[]): number | null {
  if (rows.length === 0) return null;

  let total = 0;
  let hasTotal = false;
  for (const option of rows) {
    const optionTotal =
      parseNum(option.totalPrice) ??
      parseNum(option.totalPriceOld) ??
      parseNum(option.discountedAmount) ??
      parseNum(option.amount);
    if (optionTotal !== null && optionTotal > 0) {
      total += optionTotal;
      hasTotal = true;
    }
  }
  if (hasTotal) return total;

  let componentTotal = 0;
  let hasComponents = false;
  for (const option of rows) {
    const rowTotal =
      (parseNum(option.unitsPrice) ?? 0) +
      (parseNum(option.woodWorkPrice) ?? 0) +
      (parseNum(option.accessoriesPrice) ?? 0) +
      (parseNum(option.consHardwarePrice) ?? 0) +
      (parseNum(option.worktopsPrice) ?? 0) +
      (parseNum(option.appliancesPrice) ?? 0) +
      (parseNum(option.servicesPrice) ?? 0) +
      (parseNum(option.hardwarePrice) ?? 0) +
      (parseNum(option.decorPrice) ?? 0) +
      (parseNum(option.loftsPrice) ?? 0) +
      (parseNum(option.skirtingsPrice) ?? 0) +
      (parseNum(option.additionalHWPrice) ?? 0);
    if (rowTotal > 0) {
      componentTotal += rowTotal;
      hasComponents = true;
    }
  }
  return hasComponents ? componentTotal : null;
}

export function extractProlanceQuoteTotalAmount(data: unknown): number | null {
  const row = asRecord(data);
  const direct =
    parseNum(row.totalPayableAmount) ??
    parseNum(row.finalTotalPrice) ??
    parseNum(row.finalPrice) ??
    parseNum(row.interiorProjectAmount) ??
    parseNum(row.projectAmount) ??
    parseNum(row.subTotal) ??
    parseNum(row.totalPrice);
  if (direct !== null) return direct;

  const quoteOptionsData = Array.isArray(row.quoteOptionsData)
    ? (row.quoteOptionsData as QuoteOptionRow[])
    : [];
  const fromQuoteOptions = sumOptionRowTotals(quoteOptionsData);
  if (fromQuoteOptions !== null) return fromQuoteOptions;

  const optionDetails = Array.isArray(row.optionDetails)
    ? (row.optionDetails as QuoteOptionRow[])
    : [];
  return sumOptionRowTotals(optionDetails);
}

export async function fetchProlanceQuoteRevisions(
  quoteId: string | number,
): Promise<ProlanceQuoteRevision[]> {
  const id = String(quoteId).trim();
  if (!id) return [];
  const res = await fetch(
    `/api/prolance/quotes/revisions/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  if (!res.ok) {
    const message =
      (typeof parsed.message === "string" && parsed.message.trim()) ||
      `Failed to load quote revisions (${res.status})`;
    throw new Error(message);
  }
  const versions = Array.isArray(parsed.versions) ? parsed.versions : [];
  return versions
    .map((row) => {
      const item = asRecord(row);
      const qid = parseNum(item.quoteId);
      const createdAt =
        typeof item.createdAt === "string" ? item.createdAt.trim() : "";
      if (qid === null || qid < 1) return null;
      return { quoteId: Math.trunc(qid), createdAt: createdAt || new Date().toISOString() };
    })
    .filter((row): row is ProlanceQuoteRevision => row !== null);
}

export async function fetchProlanceQuoteShare(
  quoteId: string | number,
): Promise<Record<string, unknown>> {
  const id = String(quoteId).trim();
  if (!id) return {};
  const res = await fetch(
    `/api/prolance/quotes/share/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  const text = await res.text();
  let parsed: ProlanceQuoteShareResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as ProlanceQuoteShareResponse) : {};
  } catch {
    parsed = {};
  }
  if (!res.ok) {
    const message =
      (typeof parsed.message === "string" && parsed.message.trim()) ||
      `Failed to load quote details (${res.status})`;
    throw new Error(message);
  }
  return asRecord(parsed.data);
}

export async function buildLeadQuoteOptionsFromProlance(
  anchorQuoteId: string | number,
  hubLeadId = "",
): Promise<LeadQuoteOption[]> {
  const revisions = await fetchProlanceQuoteRevisions(anchorQuoteId);
  if (revisions.length === 0) return [];

  const chronological = [...revisions].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

  const shareRows = await Promise.all(
    chronological.map(async (revision) => {
      try {
        return await fetchProlanceQuoteShare(revision.quoteId);
      } catch {
        return {};
      }
    }),
  );

  return chronological.map((revision, index) => {
    const share = shareRows[index] ?? {};
    const versionNumber = index + 1;
    const isLatest = index === chronological.length - 1;
    const amount = extractProlanceQuoteTotalAmount(share);
    const configuration = extractProlanceQuoteConfiguration(share);
    const createdAt =
      revision.createdAt ||
      (typeof share.createdOn === "string" ? share.createdOn : undefined);
    const quoteId = String(revision.quoteId);
    const customerQuoteUrl = buildDesignQuotePageUrl(quoteId);
    const internalQuoteUrl = buildDesignQuotePageUrl(quoteId, {
      internal: true,
      hubLeadId,
    });
    return {
      id: quoteId,
      quoteId,
      version: versionNumber,
      label: isLatest
        ? `Version ${versionNumber} (Current)`
        : `Version ${versionNumber}`,
      customerQuoteUrl,
      internalQuoteUrl,
      createdAt,
      amount,
      configuration: configuration || undefined,
      isLatest,
    };
  });
}

export function formatSelectedQuoteSummary(option: LeadQuoteOption): string {
  return `${option.label} · ${formatQuoteAmount(option.amount)}`;
}
