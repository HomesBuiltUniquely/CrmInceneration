/**
 * Backend sends `additionalLeadSources` as a string, often a JSON array string
 * e.g. `["Add Lead","Meta Ads"]`. Plain text is also allowed.
 */
export function parseAdditionalLeadSources(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const p = JSON.parse(s) as unknown;
      if (Array.isArray(p)) {
        return p.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [s];
}

/** Persist as backend expects: string; array → JSON.stringify */
export function serializeAdditionalLeadSources(list: string[], rawFallback?: string): string {
  if (list.length === 0) return rawFallback ?? "";
  return JSON.stringify(list);
}

export function normalizeLeadTypeLabel(raw: unknown): string {
  const original = String(raw ?? "").trim();
  const s = original.toLowerCase();
  const compact = s.replace(/[^a-z0-9]/g, "");
  if (!s) return "";
  if (compact === "formlead" || compact === "externallead") return "External Lead";
  if (compact === "glead" || compact === "googleads") return "Google Ads";
  // Hub Instant Form webhook markers: `meta_leadgen:{leadgenId}`
  if (compact.startsWith("metaleadgen") || s.startsWith("meta_leadgen:")) {
    return "Meta Ads (Instant Form)";
  }
  if (compact === "mlead" || compact === "metaads") return "Meta Ads";
  if (compact === "alead" || compact === "addlead") return "Add Lead";
  if (compact === "ivrlead") return "IVR Lead";
  if (compact === "wlead" || compact === "websitelead") return "Website Lead";
  if (compact === "walkinlead" || compact === "walkin") return "Walk-in Lead";
  if (compact === "whatsapplead" || compact === "whatsapp") return "WhatsApp";
  if (compact === "ivrcall" || compact === "ivr") return "IVR Call";
  return original;
}

/** True when Hub marked a Meta Instant Form / Graph webhook ingest. */
export function hasMetaInstantFormSource(
  additionalLeadSources?: string | string[] | null,
): boolean {
  return parseAdditionalLeadSources(additionalLeadSources).some((source) => {
    const s = source.toLowerCase();
    const compact = s.replace(/[^a-z0-9]/g, "");
    return compact.startsWith("metaleadgen") || s.startsWith("meta_leadgen:");
  });
}

export function dedupeLeadSources(rawSources: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of rawSources) {
    const normalized = normalizeLeadTypeLabel(source);
    if (!normalized) continue;
    const key = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  // Prefer Instant Form marker over plain "Meta Ads" when Hub sent both.
  const hasInstantForm = out.some((s) => s === "Meta Ads (Instant Form)");
  if (hasInstantForm) {
    return out.filter((s) => s !== "Meta Ads");
  }
  return out;
}

export function formatLeadSourceLabel(raw: string): string {
  return normalizeLeadTypeLabel(raw);
}

function sourceCompactKey(raw: unknown): string {
  return normalizeLeadTypeLabel(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Hub Meta Instant Form / Graph ingest markers — not a repeat inquiry. */
export function isMetaIngestSourceMarker(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  const compact = s.replace(/[^a-z0-9]/g, "");
  return (
    compact.startsWith("metaleadgen") ||
    s.startsWith("meta_leadgen:") ||
    compact === "metaadsinstantform"
  );
}

function isMetaSourceFamily(compactKey: string): boolean {
  return (
    compactKey === "mlead" ||
    compactKey === "metaads" ||
    compactKey === "metaadsinstantform" ||
    compactKey.startsWith("metaleadgen")
  );
}

function isGoogleSourceFamily(compactKey: string): boolean {
  return compactKey === "glead" || compactKey === "googleads";
}

/**
 * Sources that only describe the lead's own primary channel / ingest
 * (e.g. Meta Instant Form `meta_leadgen:…` on a first-time mlead).
 * These must NOT trigger the Re-inquiry tag.
 */
function isPrimaryOrIngestOnlySource(
  source: string,
  lead: {
    leadType?: unknown;
    leadSource?: unknown;
    LeadSource?: unknown;
    source?: unknown;
  },
): boolean {
  if (isMetaIngestSourceMarker(source)) return true;
  if (source.toLowerCase().includes("consultation")) return true;

  const srcKey = sourceCompactKey(source);
  if (!srcKey) return true;

  const identityKeys = [lead.leadSource, lead.LeadSource, lead.source, lead.leadType]
    .map((v) => sourceCompactKey(v))
    .filter(Boolean);

  if (identityKeys.length === 0) {
    // No identity — still ignore bare Meta ingest labels alone.
    return isMetaSourceFamily(srcKey);
  }

  return identityKeys.some((id) => {
    if (id === srcKey) return true;
    if (isMetaSourceFamily(id) && isMetaSourceFamily(srcKey)) return true;
    if (isGoogleSourceFamily(id) && isGoogleSourceFamily(srcKey)) return true;
    return false;
  });
}

/**
 * True additional / cross-source entries that mean a real re-inquiry
 * (e.g. Form Lead later also came via WhatsApp). Excludes Meta Instant Form
 * ingest markers and duplicates of the lead's own primary type.
 */
export function listReinquiryAdditionalSources(lead: {
  additionalLeadSources?: string | string[] | null;
  leadType?: unknown;
  leadSource?: unknown;
  LeadSource?: unknown;
  source?: unknown;
}): string[] {
  return parseAdditionalLeadSources(lead.additionalLeadSources).filter(
    (source) => !isPrimaryOrIngestOnlySource(source, lead),
  );
}

/**
 * True when Hub appended real repeat / cross-source entries in `additionalLeadSources`.
 * Meta Instant Form first-time leads often have `meta_leadgen:{id}` in that field —
 * that is ingest metadata, not re-inquiry.
 */
export function isCrmLeadReinquiry(lead: {
  additionalLeadSources?: string | string[] | null;
  leadType?: unknown;
  leadSource?: unknown;
  LeadSource?: unknown;
  source?: unknown;
}): boolean {
  return listReinquiryAdditionalSources(lead).length > 0;
}

export function formatAdditionalLeadSourcesLabel(raw: unknown): string {
  return dedupeLeadSources(parseAdditionalLeadSources(raw)).join(", ");
}

/** Tooltip label for Re-inquiry chip — only true cross-source extras. */
export function formatReinquirySourcesLabel(lead: {
  additionalLeadSources?: string | string[] | null;
  leadType?: unknown;
  leadSource?: unknown;
  LeadSource?: unknown;
  source?: unknown;
}): string {
  return dedupeLeadSources(listReinquiryAdditionalSources(lead)).join(", ");
}

const CROSS_MERGE_WA_REGEX =
  /Cross-type merge: .+ merged into existing WhatsApp Lead ID: (\d+)/i;

export type CrossMergeIntoWhatsapp = {
  merged: true;
  whatsappLeadId: number;
  rawMessage: string;
};

/** Normalize BFF/Hub body to plain text before cross-merge detection. */
function crossMergeResponseText(body: unknown): string | null {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  for (const key of ["message", "msg", "body", "text", "error"]) {
    const v = rec[key];
    if (typeof v === "string" && v.includes("Cross-type merge")) return v;
  }
  return null;
}

/** Shared detector for Add Lead / Glead / Form / Website cross-merge into WhatsApp. */
export function parseCrossMergeIntoWhatsapp(
  body: unknown,
): CrossMergeIntoWhatsapp | null {
  const text = typeof body === "string" ? body : crossMergeResponseText(body);
  if (!text) return null;
  const match = text.trim().match(CROSS_MERGE_WA_REGEX);
  if (!match) return null;
  return {
    merged: true,
    whatsappLeadId: Number(match[1]),
    rawMessage: text.trim(),
  };
}

/** Hub plain-text body when Glead/Form/etc. merges into existing WhatsApp row. */
export function isCrossTypeWhatsappMergeMessage(text: string): boolean {
  return parseCrossMergeIntoWhatsapp(text) !== null;
}

export function parseCrossTypeWhatsappMergeId(text: string): string | null {
  const parsed = parseCrossMergeIntoWhatsapp(text);
  return parsed ? String(parsed.whatsappLeadId) : null;
}

/** `POST /v1/WhatsappLead` — 200 + isUpdate means duplicate phone merged server-side. */
export function isWhatsappCreateDuplicateUpdate(body: unknown, status: number): boolean {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (typeof rec.isUpdate === "boolean") return rec.isUpdate;
  }
  return status === 200;
}
