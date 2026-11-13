export type CustomerQuoteSendRecord = {
  versionNumber?: number | null;
  quoteId?: string | null;
  quoteLink?: string | null;
  sentAt?: string | null;
  sentBy?: string | null;
  quotedAmount?: number | null;
};

export type GroupedCustomerQuoteSend = {
  key: string;
  versionNumber: number | null;
  quoteId: string | null;
  quoteLink: string | null;
  lastSentAt: string | null;
  lastSentBy: string | null;
  quotedAmount: number | null;
  sendCount: number;
  isCurrentLink: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.trim());
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function pickVersion(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v);
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.trim());
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
  }
  return null;
}

export function parseCustomerQuoteSendRecord(raw: unknown): CustomerQuoteSendRecord | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const sentAt = pickStr(obj.sentAt, obj.sent_at);
  const quoteId = pickStr(obj.quoteId, obj.quote_id);
  const quoteLink = pickStr(obj.quoteLink, obj.quote_link);
  const versionNumber = pickVersion(obj.versionNumber, obj.version_number);
  const sentBy = pickStr(obj.sentBy, obj.sent_by);
  const quotedAmount = pickNum(obj.quotedAmount, obj.quoted_amount);
  if (!sentAt && !quoteId && !quoteLink && versionNumber == null) return null;
  return {
    versionNumber,
    quoteId,
    quoteLink,
    sentAt,
    sentBy,
    quotedAmount,
  };
}

export function parseCustomerQuoteSends(raw: unknown): CustomerQuoteSendRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerQuoteSendRecord[] = [];
  for (const item of raw) {
    const row = parseCustomerQuoteSendRecord(item);
    if (row) out.push(row);
  }
  return out;
}

function groupKey(record: CustomerQuoteSendRecord): string {
  const v = record.versionNumber != null && record.versionNumber > 0 ? String(record.versionNumber) : "na";
  const q = record.quoteId?.trim() || "na";
  return `${q}|v${v}`;
}

function sentAtMs(value: string | null | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function normalizeLinkForCompare(url: string | null | undefined): string {
  return (url ?? "").trim().toLowerCase();
}

/** Collapse send log to one row per quote version (latest send wins for date/by/amount). */
export function groupCustomerQuoteSendsByVersion(
  sends: CustomerQuoteSendRecord[],
  currentQuoteLink?: string | null,
): GroupedCustomerQuoteSend[] {
  const map = new Map<string, GroupedCustomerQuoteSend>();
  const current = normalizeLinkForCompare(currentQuoteLink);

  for (const record of sends) {
    const key = groupKey(record);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        versionNumber: record.versionNumber ?? null,
        quoteId: record.quoteId ?? null,
        quoteLink: record.quoteLink ?? null,
        lastSentAt: record.sentAt ?? null,
        lastSentBy: record.sentBy ?? null,
        quotedAmount: record.quotedAmount ?? null,
        sendCount: 1,
        isCurrentLink: false,
      });
      continue;
    }
    existing.sendCount += 1;
    if (sentAtMs(record.sentAt) >= sentAtMs(existing.lastSentAt)) {
      existing.lastSentAt = record.sentAt ?? existing.lastSentAt;
      existing.lastSentBy = record.sentBy ?? existing.lastSentBy;
      existing.quoteLink = record.quoteLink ?? existing.quoteLink;
      if (record.quotedAmount != null) existing.quotedAmount = record.quotedAmount;
    }
    if (record.quotedAmount != null && existing.quotedAmount == null) {
      existing.quotedAmount = record.quotedAmount;
    }
  }

  const grouped = [...map.values()].map((row) => ({
    ...row,
    isCurrentLink: Boolean(current && normalizeLinkForCompare(row.quoteLink) === current),
  }));

  grouped.sort((a, b) => {
    const versionDelta = (b.versionNumber ?? 0) - (a.versionNumber ?? 0);
    if (versionDelta !== 0) return versionDelta;
    return sentAtMs(b.lastSentAt) - sentAtMs(a.lastSentAt);
  });

  return grouped;
}

type QuoteSendInfoFallback = {
  quoteSentToCustomer?: boolean;
  quoteSentCount?: number;
  quoteLink?: string | null;
  quoteId?: string | null;
  quoteSentAt?: string | null;
  quoteSentBy?: string | null;
  lastQuoteSentAt?: string | null;
  lastQuoteSentBy?: string | null;
  customerQuoteSends?: CustomerQuoteSendRecord[];
};

/** Legacy leads: sent before we stored history — single synthetic row. */
export function legacyCustomerQuoteSendsFallback(
  info: QuoteSendInfoFallback | null | undefined,
  quoteSentCount: number,
  quoteLink?: string | null,
  quoteId?: string | null,
): CustomerQuoteSendRecord[] {
  if (!info && quoteSentCount <= 0) return [];
  const sends = parseCustomerQuoteSends(info?.customerQuoteSends);
  if (sends.length > 0) return sends;
  if (quoteSentCount <= 0 && info?.quoteSentToCustomer !== true) return [];

  const link = pickStr(info?.quoteLink, quoteLink);
  const id = pickStr(info?.quoteId, quoteId);
  const at = pickStr(info?.lastQuoteSentAt, info?.quoteSentAt);
  const by = pickStr(info?.lastQuoteSentBy, info?.quoteSentBy);
  if (!at && !link && !id) return [];

  return [
    {
      versionNumber: null,
      quoteId: id,
      quoteLink: link,
      sentAt: at,
      sentBy: by,
      quotedAmount: null,
    },
  ];
}

export function resolveGroupedCustomerQuoteSends(input: {
  quoteSentInfo?: QuoteSendInfoFallback | null;
  quoteSentCount?: number;
  quoteLink?: string | null;
  quoteId?: string | null;
}): GroupedCustomerQuoteSend[] {
  const count = input.quoteSentCount ?? input.quoteSentInfo?.quoteSentCount ?? 0;
  const sends = legacyCustomerQuoteSendsFallback(
    input.quoteSentInfo,
    count,
    input.quoteLink,
    input.quoteId,
  );
  return groupCustomerQuoteSendsByVersion(sends, input.quoteLink ?? input.quoteSentInfo?.quoteLink);
}
