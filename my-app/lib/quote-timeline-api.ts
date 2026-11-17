import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { MEETING_TIME_ZONE } from "@/lib/meeting-management-data";

export type QuoteTimelineVersion = {
  versionNumber: number;
  versionLabel: string;
  quoteId: string;
  quoteLink: string;
  generatedAt: string;
  quotedAmount: number;
  sentCount: number;
  firstSentAt: string;
  lastSentAt: string;
  openCount: number;
  lastOpenedAt: string;
  sentToCustomer: boolean;
  openedByCustomer: boolean;
};

export type QuoteTimelineSend = {
  versionNumber: number;
  versionLabel: string;
  quoteId: string;
  sentAt: string;
  sentBy: string;
  recipient: string;
};

export type QuoteTimeline = {
  latestQuoteVersionNumber: number | null;
  latestQuoteGeneratedAt: string;
  quoteSentCount: number;
  customerQuoteOpenCount: number;
  versions: QuoteTimelineVersion[];
  sends: QuoteTimelineSend[];
  latestVersion: QuoteTimelineVersion | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function countOf(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.trim());
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
  }
  return 0;
}

function boolOf(...vals: unknown[]): boolean {
  for (const v of vals) {
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1 || v === "1") return true;
    if (v === "false" || v === 0 || v === "0") return false;
  }
  return false;
}

function amountOf(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.trim().replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function versionLabelOf(row: Record<string, unknown>, versionNumber: number): string {
  const label = textOf(row.versionLabel, row.version_label, row.label);
  if (label) return label;
  return versionNumber > 0 ? `Version ${versionNumber}` : "Version";
}

function parseVersion(raw: unknown): QuoteTimelineVersion | null {
  const row = asRecord(raw);
  if (!row) return null;
  const versionNumber = countOf(row.versionNumber, row.version_number, row.quoteVersionNumber);
  const quoteId = textOf(row.quoteId, row.quote_id);
  const generatedAt = textOf(row.generatedAt, row.generated_at, row.sharedAt);
  const sentCount = countOf(row.sentCount, row.sent_count);
  const openCount = countOf(row.openCount, row.open_count);
  const sentToCustomer =
    boolOf(row.sentToCustomer, row.sent_to_customer) || sentCount > 0;
  const openedByCustomer =
    boolOf(row.openedByCustomer, row.opened_by_customer) || openCount > 0;
  return {
    versionNumber,
    versionLabel: versionLabelOf(row, versionNumber),
    quoteId,
    quoteLink: textOf(row.quoteLink, row.quote_link),
    generatedAt,
    quotedAmount: amountOf(row.quotedAmount, row.quoted_amount, row.amount),
    sentCount,
    firstSentAt: textOf(row.firstSentAt, row.first_sent_at),
    lastSentAt: textOf(row.lastSentAt, row.last_sent_at),
    openCount,
    lastOpenedAt: textOf(row.lastOpenedAt, row.last_opened_at, row.lastOpenAt),
    sentToCustomer,
    openedByCustomer,
  };
}

function parseSend(raw: unknown): QuoteTimelineSend | null {
  const row = asRecord(raw);
  if (!row) return null;
  const versionNumber = countOf(row.versionNumber, row.version_number, row.quoteVersionNumber);
  const sentAt = textOf(row.sentAt, row.sent_at, row.performedAt, row.createdAt);
  if (!sentAt && versionNumber <= 0) return null;
  return {
    versionNumber,
    versionLabel: versionLabelOf(row, versionNumber),
    quoteId: textOf(row.quoteId, row.quote_id),
    sentAt,
    sentBy: textOf(row.sentBy, row.sent_by, row.performedBy, row.performedByName),
    recipient: textOf(row.recipient, row.toEmail, row.to, row.email),
  };
}

/** Normalize Hub / BFF quote timeline payload. */
export function parseQuoteTimeline(payload: unknown): QuoteTimeline {
  const root = asRecord(payload) ?? {};
  const data = asRecord(root.data) ?? root;
  const versionsRaw = Array.isArray(data.versions) ? data.versions : [];
  const sendsRaw = Array.isArray(data.sends) ? data.sends : [];
  const versions = versionsRaw
    .map(parseVersion)
    .filter((row): row is QuoteTimelineVersion => row != null)
    .sort((a, b) => b.versionNumber - a.versionNumber || b.generatedAt.localeCompare(a.generatedAt));
  const sends = sendsRaw
    .map(parseSend)
    .filter((row): row is QuoteTimelineSend => row != null)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const latestFromPointer = parseVersion(data.latestVersion ?? data.latest_version);
  const latestVersion =
    latestFromPointer ??
    versions[0] ??
    null;
  const latestQuoteVersionNumber =
    countOf(
      data.latestQuoteVersionNumber,
      data.latest_quote_version_number,
      latestVersion?.versionNumber,
    ) || null;
  const latestQuoteGeneratedAt = textOf(
    data.latestQuoteGeneratedAt,
    data.latest_quote_generated_at,
    latestVersion?.generatedAt,
  );
  const quoteSentCount = Math.max(
    countOf(data.quoteSentCount, data.quote_sent_count),
    sends.length,
    versions.reduce((sum, row) => sum + row.sentCount, 0),
  );
  const customerQuoteOpenCount = Math.max(
    countOf(data.customerQuoteOpenCount, data.customer_quote_open_count),
    versions.reduce((sum, row) => sum + row.openCount, 0),
  );

  return {
    latestQuoteVersionNumber: latestQuoteVersionNumber && latestQuoteVersionNumber > 0
      ? latestQuoteVersionNumber
      : latestVersion?.versionNumber || null,
    latestQuoteGeneratedAt,
    quoteSentCount,
    customerQuoteOpenCount,
    versions,
    sends,
    latestVersion,
  };
}

export function emptyQuoteTimeline(): QuoteTimeline {
  return {
    latestQuoteVersionNumber: null,
    latestQuoteGeneratedAt: "",
    quoteSentCount: 0,
    customerQuoteOpenCount: 0,
    versions: [],
    sends: [],
    latestVersion: null,
  };
}

export async function loadQuoteTimeline(
  leadId: number | string,
  leadType: string,
): Promise<QuoteTimeline> {
  const params = new URLSearchParams({
    leadId: String(leadId),
    leadType: leadType.trim(),
  });
  const res = await fetch(`/api/crm/quote/timeline?${params}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || "Could not load quote timeline.");
  }
  return parseQuoteTimeline(json);
}

export function formatQuoteTimelineWhen(raw?: string | null): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  const date = new Date(parsed).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: MEETING_TIME_ZONE,
  });
  const time = new Date(parsed)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: MEETING_TIME_ZONE,
    })
    .replace(/\s+/g, " ")
    .toLowerCase();
  return `${date}, ${time}`;
}

export function latestQuoteVersionLabel(timeline: QuoteTimeline | null | undefined): string {
  if (!timeline) return "";
  if (timeline.latestVersion?.versionLabel) return timeline.latestVersion.versionLabel;
  const n = timeline.latestQuoteVersionNumber;
  return n && n > 0 ? `Version ${n}` : "";
}
