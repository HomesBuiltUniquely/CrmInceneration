import type { LeadQuoteOption } from "@/lib/crm-quote-links";
import { buildDesignQuotePageUrl, formatQuoteAmount } from "@/lib/crm-quote-links";

export type ProlanceQuoteRevision = {
  quoteId: number;
  createdAt: string;
  createdBy?: string;
  changeSummary?: string;
  versionNumber?: number;
  /** Original revision row, used to replay the discount at this save. */
  source: Record<string, unknown>;
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

type CategoryPctKey = "woodwork" | "accessories" | "constructionHw" | "services";

export type QuoteDiscountMeta = {
  hubCategoryDiscountPct: Record<CategoryPctKey, number>;
  hubCategoryDiscountAmount: number;
  hubAdditionalDiscountAmount: number;
};

const CATEGORY_PCT_KEYS: CategoryPctKey[] = [
  "woodwork",
  "accessories",
  "constructionHw",
  "services",
];

/** Same categories the quotation page rounds and subtracts. Construction hardware is excluded. */
const EDITABLE_DISCOUNT_CATEGORIES: Array<{
  key: Exclude<CategoryPctKey, "constructionHw">;
  priceKeys: string[];
  roomPrice: (room: Record<string, unknown>) => number;
}> = [
  {
    key: "woodwork",
    priceKeys: ["woodWorkPrice"],
    roomPrice: (room) =>
      parseNum(room.woodWorkPrice) ??
      (parseNum(room.unitsPrice) ?? 0) + (parseNum(room.loftsPrice) ?? 0),
  },
  {
    key: "accessories",
    priceKeys: ["accessoriesPrice"],
    roomPrice: (room) => parseNum(room.accessoriesPrice) ?? 0,
  },
  {
    key: "services",
    priceKeys: ["servicesPrice"],
    roomPrice: (room) => parseNum(room.servicesPrice) ?? 0,
  },
];

function asDiscountRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") return null;
    try {
      return asDiscountRecord(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readPctMap(value: unknown): Partial<Record<CategoryPctKey, number>> | null {
  const record = asDiscountRecord(value);
  if (!record) return null;
  const out: Partial<Record<CategoryPctKey, number>> = {};
  for (const key of CATEGORY_PCT_KEYS) {
    const amount = parseNum(record[key]);
    if (amount != null) out[key] = amount;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function quoteRoomRows(row: Record<string, unknown>): Record<string, unknown>[] {
  const details = Array.isArray(row.optionDetails) ? row.optionDetails : [];
  const options = Array.isArray(row.quoteOptionsData) ? row.quoteOptionsData : [];
  const source = details.length >= options.length ? details : options;
  return source.map((item) => asRecord(item));
}

function categoryListPrice(
  row: Record<string, unknown>,
  priceKeys: string[],
  roomPrice: (room: Record<string, unknown>) => number,
): number {
  for (const key of priceKeys) {
    const amount = parseNum(row[key]);
    if (amount != null && amount > 0) return amount;
  }
  return quoteRoomRows(row).reduce((sum, room) => sum + roomPrice(room), 0);
}

/** Per-category Math.round, matching the quotation page discount breakdown. */
function editableCategoryDiscount(row: Record<string, unknown>): number {
  const pct = readPctMap(row.hubCategoryDiscountPct);
  if (!pct) return 0;
  return EDITABLE_DISCOUNT_CATEGORIES.reduce((sum, category) => {
    const rate = pct[category.key] ?? 0;
    const price = categoryListPrice(row, category.priceKeys, category.roomPrice);
    if (!(rate > 0) || !(price > 0)) return sum;
    return sum + Math.round((price * rate) / 100);
  }, 0);
}

function quoteHasHubDiscount(row: Record<string, unknown>): boolean {
  if ((parseNum(row.hubCategoryDiscountAmount) ?? 0) > 0) return true;
  if ((parseNum(row.hubAdditionalDiscountAmount) ?? 0) > 0) return true;
  if ((parseNum(row.hubFlatDiscountAmount) ?? 0) > 0) return true;
  const pct = readPctMap(row.hubCategoryDiscountPct);
  return Boolean(pct && Object.values(pct).some((rate) => (rate ?? 0) > 0));
}

/**
 * Discount subtracted from the list price.
 * Uses the larger of the saved rupee discount and the rounded category percentages.
 */
function customerDiscountAmount(row: Record<string, unknown>): number {
  const category = parseNum(row.hubCategoryDiscountAmount);
  const additional = Math.max(0, parseNum(row.hubAdditionalDiscountAmount) ?? 0);
  const flat = Math.max(0, parseNum(row.hubFlatDiscountAmount) ?? 0);
  const stored =
    category != null || additional > 0 ? Math.max(0, (category ?? 0) + additional) : 0;
  return Math.max(stored, editableCategoryDiscount(row)) + flat;
}

function preDiscountRoomTotal(row: Record<string, unknown>): number {
  return quoteRoomRows(row).reduce((sum, room) => {
    const amount = parseNum(room.totalPrice) ?? parseNum(room.totalPriceOld);
    return amount != null && amount > 0 ? sum + amount : sum;
  }, 0);
}

/** List price before Hub discount, including snapshot payloads that omit `finalTotalPrice`. */
function quoteListPrice(row: Record<string, unknown>): number | null {
  const direct =
    parseNum(row.finalTotalPrice) ??
    parseNum(row.finalPrice) ??
    parseNum(row.totalPrice);
  if (direct != null && direct > 0) return direct;

  const rooms = preDiscountRoomTotal(row);
  if (rooms > 0) return rooms;

  const composed = [
    categoryListPrice(row, ["woodWorkPrice"], (room) => parseNum(room.woodWorkPrice) ?? 0),
    categoryListPrice(row, ["accessoriesPrice"], (room) => parseNum(room.accessoriesPrice) ?? 0),
    categoryListPrice(
      row,
      ["consHardwarePrice", "hardwarePrice"],
      (room) => parseNum(room.consHardwarePrice) ?? parseNum(room.hardwarePrice) ?? 0,
    ),
    categoryListPrice(row, ["servicesPrice"], (room) => parseNum(room.servicesPrice) ?? 0),
    categoryListPrice(
      row,
      ["worktopsPrice", "worktopPrice"],
      (room) => parseNum(room.worktopsPrice) ?? parseNum(room.worktopPrice) ?? 0,
    ),
    categoryListPrice(row, ["appliancesPrice"], (room) => parseNum(room.appliancesPrice) ?? 0),
    categoryListPrice(row, ["decorPrice"], (room) => parseNum(room.decorPrice) ?? 0),
  ].reduce((sum, amount) => sum + amount, 0);
  return composed > 0 ? composed : null;
}

function parsePctChange(summary: string, label: string): number | undefined {
  const match = summary.match(new RegExp(`${label}:\\s*[\\d.]+%\\s*->\\s*([\\d.]+)%`, "i"));
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : undefined;
}

function parseAmountChange(summary: string, label: string): number | undefined {
  const match = summary.match(new RegExp(`${label}:[^;]*->\\s*₹\\s*([\\d,]+)`, "i"));
  if (!match) return undefined;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.round(amount) : undefined;
}

/**
 * Designer discounts are often saved only on quote revisions, not on the share payload.
 * Replay those revisions the same way the quotation page does.
 */
export function discountMetaFromQuoteRevisions(
  versions: unknown[],
  quoteId?: string | number,
): QuoteDiscountMeta | null {
  const wanted = parseNum(quoteId);
  const all = versions.map((version) => asRecord(version));
  const matching =
    wanted != null && wanted > 0
      ? all.filter((version) => {
          const id = parseNum(version.quoteId);
          return id == null || id === wanted;
        })
      : all;
  const rows = matching.length > 0 ? matching : all;

  const pct: Record<CategoryPctKey, number> = {
    woodwork: 0,
    accessories: 0,
    constructionHw: 0,
    services: 0,
  };
  let categoryAmount = 0;
  let additionalAmount = 0;
  let seen = false;

  for (const version of rows) {
    const snapshot =
      asDiscountRecord(version.discountSnapshot) ??
      asDiscountRecord(version.discount_snapshot) ??
      asDiscountRecord(version.updatedValues) ??
      asDiscountRecord(version.updated_values);
    if (snapshot) {
      const snapPct = asDiscountRecord(snapshot.hubCategoryDiscountPct) ?? snapshot;
      for (const key of CATEGORY_PCT_KEYS) {
        if (snapPct[key] == null || snapPct[key] === "") continue;
        const rate = parseNum(snapPct[key]);
        if (rate != null) pct[key] = rate;
      }
      if (snapshot.hubCategoryDiscountAmount != null || snapshot.amount != null) {
        categoryAmount = Math.round(
          parseNum(snapshot.hubCategoryDiscountAmount) ?? parseNum(snapshot.amount) ?? 0,
        );
      }
      if (snapshot.hubAdditionalDiscountAmount != null || snapshot.additionalDiscount != null) {
        additionalAmount = Math.round(
          parseNum(snapshot.hubAdditionalDiscountAmount) ??
            parseNum(snapshot.additionalDiscount) ??
            0,
        );
      }
      seen = true;
    }

    const summary =
      typeof version.changeSummary === "string" ? version.changeSummary.trim() : "";
    if (!summary || /^no changes$/i.test(summary)) continue;

    const woodwork = parsePctChange(summary, "Woodwork");
    const accessories = parsePctChange(summary, "Accessories");
    const constructionHw = parsePctChange(summary, "Construction Hardware");
    const services = parsePctChange(summary, "Services");
    const category = parseAmountChange(summary, "Category discount amount");
    const additional = parseAmountChange(summary, "Additional discount");
    if (woodwork != null) pct.woodwork = woodwork;
    if (accessories != null) pct.accessories = accessories;
    if (constructionHw != null) pct.constructionHw = constructionHw;
    if (services != null) pct.services = services;
    if (category != null) categoryAmount = category;
    if (additional != null) additionalAmount = additional;
    seen = true;
  }

  if (!seen) return null;
  const meta: QuoteDiscountMeta = {
    hubCategoryDiscountPct: pct,
    hubCategoryDiscountAmount: categoryAmount,
    hubAdditionalDiscountAmount: additionalAmount,
  };
  return quoteHasHubDiscount(meta) ? meta : null;
}

async function fetchHubDiscountMeta(quoteId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `/api/prolance/quotes/hub-discount/${encodeURIComponent(quoteId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return null;
  }
  const discount = asRecord(parsed.discount);
  return Object.keys(discount).length > 0 ? discount : null;
}

async function fetchRevisionDiscountMeta(quoteId: string): Promise<QuoteDiscountMeta | null> {
  const res = await fetch(
    `/api/prolance/quotes/revisions/${encodeURIComponent(quoteId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return null;
  }
  const versions = Array.isArray(parsed.versions) ? parsed.versions : [];
  return discountMetaFromQuoteRevisions(versions, quoteId);
}

/**
 * Put the quotation-page discount onto a share response.
 * The share API keeps the list price; designer discounts live on hub-discount or revisions.
 */
export function mergeCustomerDiscountIntoShareResponse(
  payload: unknown,
  hubDiscountBody: unknown,
  revisionsBody: unknown,
): unknown {
  const root = asRecord(payload);
  const nested = root.data;
  const quote =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : root;
  if (quoteHasHubDiscount(quote)) return payload;

  let next = quote;
  const hubDiscount = asRecord(asRecord(hubDiscountBody).discount);
  if (Object.keys(hubDiscount).length > 0 && quoteHasHubDiscount(hubDiscount)) {
    next = { ...quote, ...hubDiscount };
  } else {
    const versions = Array.isArray(asRecord(revisionsBody).versions)
      ? (asRecord(revisionsBody).versions as unknown[])
      : [];
    const meta = discountMetaFromQuoteRevisions(
      versions,
      parseNum(quote.quoteID) ?? parseNum(quote.quoteId) ?? undefined,
    );
    if (meta) next = { ...quote, ...meta };
  }

  if (next === quote) return payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...root, data: next };
  }
  return next;
}

/** Attach the quotation-page discount when the share payload still has the list price. */
async function withCustomerDiscount(
  quoteId: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (quoteHasHubDiscount(data)) return data;
  try {
    const hubDiscount = await fetchHubDiscountMeta(quoteId);
    if (hubDiscount && quoteHasHubDiscount(hubDiscount)) {
      return { ...data, ...hubDiscount };
    }
  } catch {
    /* revisions below */
  }
  try {
    const revisionDiscount = await fetchRevisionDiscountMeta(quoteId);
    if (revisionDiscount) return { ...data, ...revisionDiscount };
  } catch {
    /* keep list price */
  }
  return data;
}

/**
 * Customer estimated total, matching the quotation page ("inclusive of all taxes").
 * `finalTotalPrice` is the list price. Designer discounts saved later live on
 * hub-discount or quote revisions, and are subtracted here.
 * Example: 7,56,829 − 2,50,025 = 5,06,804.
 */
export function extractProlanceQuoteTotalAmount(data: unknown): number | null {
  const row = asRecord(data);
  const listPrice = quoteListPrice(row);
  if (listPrice !== null && listPrice > 0) {
    const discount = customerDiscountAmount(row);
    if (discount > 0 && discount < listPrice) {
      const rooms = preDiscountRoomTotal(row);
      if (rooms > 0) {
        const alreadyDiscounted =
          Math.abs(listPrice - (rooms - discount)) <= Math.max(500, discount * 0.08);
        const isListPrice = Math.abs(listPrice - rooms) <= Math.max(500, rooms * 0.02);
        if (alreadyDiscounted && !isListPrice) return listPrice;
      }
      return Math.max(0, listPrice - discount);
    }
    return listPrice;
  }

  const direct =
    parseNum(row.totalPayableAmount) ??
    parseNum(row.interiorProjectAmount) ??
    parseNum(row.projectAmount) ??
    parseNum(row.subTotal);
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
      const createdBy = pickStr(item, "createdBy", "createdByName", "created_by");
      const changeSummary =
        typeof item.changeSummary === "string" ? item.changeSummary.trim() : "";
      const versionNumber = parseNum(item.versionNumber ?? item.version);
      return {
        quoteId: Math.trunc(qid),
        createdAt: createdAt || new Date().toISOString(),
        createdBy: createdBy || undefined,
        changeSummary: changeSummary || undefined,
        versionNumber:
          versionNumber != null && versionNumber > 0 ? Math.trunc(versionNumber) : undefined,
        source: item,
      };
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
  return withCustomerDiscount(id, asRecord(parsed.data));
}

const HUB_DISCOUNT_KEYS = [
  "hubCategoryDiscountPct",
  "hubCategoryDiscountAmount",
  "hubAdditionalDiscountAmount",
  "hubFlatDiscountAmount",
  "hubFlatDiscountPct",
] as const;

/** List-price share, so each discount save can be priced on its own. */
function shareWithoutHubDiscount(share: Record<string, unknown>): Record<string, unknown> {
  const next = { ...share };
  for (const key of HUB_DISCOUNT_KEYS) delete next[key];
  return next;
}

export async function buildLeadQuoteOptionsFromProlance(
  anchorQuoteId: string | number,
  hubLeadId = "",
): Promise<LeadQuoteOption[]> {
  const revisions = await fetchProlanceQuoteRevisions(anchorQuoteId);
  if (revisions.length === 0) return [];

  // Keep every design-module save, including discount edits of the same quote id.
  // A brand-new quote id is still a separate quote. Payment keeps using quoteId.
  const chronological = [...revisions].sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      (a.versionNumber ?? 0) - (b.versionNumber ?? 0) ||
      a.quoteId - b.quoteId,
  );

  const shareByQuoteId = new Map<number, Record<string, unknown>>();
  await Promise.all(
    [...new Set(chronological.map((revision) => revision.quoteId))].map(async (quoteId) => {
      try {
        shareByQuoteId.set(quoteId, await fetchProlanceQuoteShare(quoteId));
      } catch {
        shareByQuoteId.set(quoteId, {});
      }
    }),
  );

  const byQuoteId = new Map<number, ProlanceQuoteRevision[]>();
  for (const revision of chronological) {
    const group = byQuoteId.get(revision.quoteId) ?? [];
    group.push(revision);
    byQuoteId.set(revision.quoteId, group);
  }

  return chronological.map((revision, index) => {
    const share = shareWithoutHubDiscount(shareByQuoteId.get(revision.quoteId) ?? {});
    const quoteHistory = byQuoteId.get(revision.quoteId) ?? [revision];
    const historyIndex = Math.max(0, quoteHistory.indexOf(revision));
    const discount = discountMetaFromQuoteRevisions(
      quoteHistory.slice(0, historyIndex + 1).map((item) => item.source),
      revision.quoteId,
    );
    const versionNumber = index + 1;
    const isLatest = index === chronological.length - 1;
    const amount = extractProlanceQuoteTotalAmount(discount ? { ...share, ...discount } : share);
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
      id: `${quoteId}-v${versionNumber}`,
      quoteId,
      version: versionNumber,
      label: isLatest
        ? `Version ${versionNumber} (Current)`
        : `Version ${versionNumber}`,
      customerQuoteUrl,
      internalQuoteUrl,
      createdAt,
      createdBy: revision.createdBy,
      summary: revision.changeSummary,
      amount,
      configuration: configuration || undefined,
      isLatest,
    };
  });
}

export function formatSelectedQuoteSummary(option: LeadQuoteOption): string {
  return `${option.label} · ${formatQuoteAmount(option.amount)}`;
}
