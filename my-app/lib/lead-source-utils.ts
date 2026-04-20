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
  if (compact === "mlead" || compact === "metaads") return "Meta Ads";
  if (compact === "alead" || compact === "addlead") return "Add Lead";
  if (compact === "wlead" || compact === "websitelead") return "Website Lead";
  return original;
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
  return out;
}

export function formatLeadSourceLabel(raw: string): string {
  return normalizeLeadTypeLabel(raw);
}
