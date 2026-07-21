/**
 * Hub `quote_sent_info` JSON + flat aliases on lead list/detail.
 * Source of truth for Quote Sent tile — not quoteLink / Meeting Successful / "Quote link set".
 */

export type QuoteSentInfo = {
  quoteSentToCustomer?: boolean;
  quoteSentAt?: string | null;
  quoteSentBy?: string | null;
  lastQuoteSentAt?: string | null;
  lastQuoteSentBy?: string | null;
  quoteLink?: string | null;
  leadIdentifier?: string | null;
  quoteId?: string | null;
  quoteSentCount?: number;
};

export type QuoteSentLeadFields = {
  quoteSentInfo?: QuoteSentInfo | null;
  quoteSentToCustomer?: boolean | null;
  quoteSentAt?: string | null;
  quoteSentBy?: string | null;
  quoteSentCount?: number | null;
  quoteEmailSent?: boolean | null;
  quoteLink?: string | null;
  dynamicFields?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickBool(...vals: unknown[]): boolean | undefined {
  for (const v of vals) {
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1 || v === "1") return true;
    if (v === "false" || v === 0 || v === "0") return false;
  }
  return undefined;
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function pickCount(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.trim());
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
  }
  return 0;
}

/** Parse Hub `quoteSentInfo` object (or nested under dynamicFields). */
export function parseQuoteSentInfo(raw: unknown): QuoteSentInfo | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const quoteSentToCustomer = pickBool(obj.quoteSentToCustomer, obj.quoteEmailSent);
  const quoteSentCount = pickCount(obj.quoteSentCount);
  const quoteSentAt = pickStr(obj.quoteSentAt);
  const quoteSentBy = pickStr(obj.quoteSentBy);
  const lastQuoteSentAt = pickStr(obj.lastQuoteSentAt);
  const lastQuoteSentBy = pickStr(obj.lastQuoteSentBy);
  const quoteLink = pickStr(obj.quoteLink);
  const leadIdentifier = pickStr(obj.leadIdentifier);
  const quoteId = pickStr(obj.quoteId);

  const empty =
    quoteSentToCustomer === undefined &&
    quoteSentCount === 0 &&
    !quoteSentAt &&
    !quoteSentBy &&
    !lastQuoteSentAt &&
    !lastQuoteSentBy &&
    !quoteLink &&
    !leadIdentifier &&
    !quoteId;
  if (empty) return null;

  return {
    quoteSentToCustomer,
    quoteSentAt,
    quoteSentBy,
    lastQuoteSentAt,
    lastQuoteSentBy,
    quoteLink,
    leadIdentifier,
    quoteId,
    quoteSentCount: quoteSentCount > 0 ? quoteSentCount : undefined,
  };
}

/** Normalize flat + nested quote-sent fields from any lead/detail payload. */
export function extractQuoteSentFields(source: Record<string, unknown>): {
  quoteSentInfo: QuoteSentInfo | null;
  quoteSentToCustomer: boolean;
  quoteSentAt: string | null;
  quoteSentBy: string | null;
  lastQuoteSentAt: string | null;
  lastQuoteSentBy: string | null;
  quoteSentCount: number;
  quoteId: string | null;
} {
  const df = asRecord(source.dynamicFields) ?? {};
  const info =
    parseQuoteSentInfo(source.quoteSentInfo) ??
    parseQuoteSentInfo(source.quote_sent_info) ??
    parseQuoteSentInfo(df.quoteSentInfo) ??
    parseQuoteSentInfo(df.quote_sent_info);

  const quoteSentCount = pickCount(
    source.quoteSentCount,
    df.quoteSentCount,
    info?.quoteSentCount,
  );

  const quoteSentToCustomer =
    pickBool(
      source.quoteSentToCustomer,
      source.quoteEmailSent,
      df.quoteSentToCustomer,
      df.quoteEmailSent,
      info?.quoteSentToCustomer,
    ) === true || quoteSentCount > 0;

  const quoteSentAt =
    pickStr(source.quoteSentAt, df.quoteSentAt, info?.quoteSentAt) ?? null;
  const quoteSentBy =
    pickStr(source.quoteSentBy, df.quoteSentBy, info?.quoteSentBy) ?? null;
  const lastQuoteSentAt =
    pickStr(info?.lastQuoteSentAt, source.lastQuoteSentAt, df.lastQuoteSentAt) ??
    quoteSentAt;
  const lastQuoteSentBy =
    pickStr(info?.lastQuoteSentBy, source.lastQuoteSentBy, df.lastQuoteSentBy) ??
    quoteSentBy;
  const quoteId =
    pickStr(info?.quoteId, source.quoteId, df.quoteId, source.hub_quote_id, df.hub_quote_id) ??
    null;

  return {
    quoteSentInfo: info,
    quoteSentToCustomer,
    quoteSentAt,
    quoteSentBy,
    lastQuoteSentAt,
    lastQuoteSentBy,
    quoteSentCount,
    quoteId,
  };
}

/** Tile / funnel: true when Hub recorded at least one successful customer send. */
export function isQuoteSentLead(lead: QuoteSentLeadFields): boolean {
  if (lead.quoteSentToCustomer === true || lead.quoteEmailSent === true) return true;
  const count = quoteSentCountOf(lead);
  if (count > 0) return true;
  if (lead.quoteSentInfo?.quoteSentToCustomer === true) return true;

  const df = asRecord(lead.dynamicFields);
  if (df) {
    if (pickBool(df.quoteSentToCustomer, df.quoteEmailSent) === true) return true;
    if (pickCount(df.quoteSentCount) > 0) return true;
    const nested = parseQuoteSentInfo(df.quoteSentInfo ?? df.quote_sent_info);
    if (nested?.quoteSentToCustomer === true) return true;
    if ((nested?.quoteSentCount ?? 0) > 0) return true;
  }
  return false;
}

export function quoteSentCountOf(lead: QuoteSentLeadFields): number {
  return pickCount(lead.quoteSentCount, lead.quoteSentInfo?.quoteSentCount);
}

export function quoteSentIdOf(lead: QuoteSentLeadFields): string {
  return (
    pickStr(lead.quoteSentInfo?.quoteId) ||
    ""
  );
}

export function lastQuoteSentAtOf(lead: QuoteSentLeadFields): string | null {
  return (
    pickStr(lead.quoteSentInfo?.lastQuoteSentAt, lead.quoteSentAt) ?? null
  );
}

export function lastQuoteSentByOf(lead: QuoteSentLeadFields): string | null {
  return (
    pickStr(lead.quoteSentInfo?.lastQuoteSentBy, lead.quoteSentBy) ?? null
  );
}
