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

/** Display labels: API slugs like `addlead` → `AddLead`, `glead` → `GLead`; otherwise title-case words. */
const LEAD_SOURCE_SLUG_LABEL: Record<string, string> = {
  addlead: "AddLead",
  glead: "GLead",
  mlead: "MLead",
  formlead: "FormLead",
  websitelead: "WebsiteLead",
};

export function formatLeadSourceLabel(raw: string): string {
  const v = raw.trim();
  if (!v || v === "—") return "—";
  const compact = v.toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
  if (LEAD_SOURCE_SLUG_LABEL[compact]) {
    return LEAD_SOURCE_SLUG_LABEL[compact];
  }
  return v
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
