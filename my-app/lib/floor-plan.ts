import type { CrmLeadType } from "@/lib/leads-filter";

/** Max upload size per backend contract (10 MB). */
export const FLOOR_PLAN_MAX_BYTES = 10 * 1024 * 1024;

export const FLOOR_PLAN_ACCEPT = ".pdf,.jpg,.jpeg,.png";

const CRM_TO_FLOOR_PLAN: Record<CrmLeadType, string> = {
  glead: "glead",
  mlead: "mlead",
  websitelead: "website",
  formlead: "form",
  addlead: "add",
};

/** CRM detail `leadType` → `/v1/leads/{segment}/…/floor-plan` segment. */
export function crmLeadTypeToFloorPlanLeadType(leadType: CrmLeadType): string {
  return CRM_TO_FLOOR_PLAN[leadType];
}

/** Map display / legacy source labels to floor-plan API segment. */
export function toFloorPlanLeadType(source: string): string {
  const s = (source || "").toLowerCase().replace(/\s+/g, "-");
  if (["google", "google-ads", "glead"].includes(s)) return "glead";
  if (["meta", "meta-ads", "mlead"].includes(s)) return "mlead";
  if (["website", "website-lead", "wl", "websitelead"].includes(s)) return "website";
  if (["form", "form-lead", "external", "fl", "formlead"].includes(s)) return "form";
  if (["add", "add-lead", "al", "addlead"].includes(s)) return "add";
  throw new Error(`Unknown lead source for floor plan: ${source}`);
}

const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png"]);

export function validateFloorPlanFile(file: File): string | null {
  if (file.size > FLOOR_PLAN_MAX_BYTES) {
    return "File is too large. Maximum size is 10 MB.";
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    return "Invalid file type. Allowed: pdf, jpg, jpeg, png.";
  }
  return null;
}

export function isFloorPlanImageKey(key: string): boolean {
  const u = key.trim().toLowerCase();
  return /\.(jpe?g|png)(\?|#|$)/.test(u);
}

export function isFloorPlanPdfKey(key: string): boolean {
  const u = key.trim().toLowerCase();
  return /\.pdf(\?|#|$)/.test(u);
}

/** @deprecated Use key-based helpers — never open raw S3 HTTPS in browser. */
export function isFloorPlanImageUrl(url: string): boolean {
  return isFloorPlanImageKey(url);
}

/** @deprecated Use key-based helpers — never open raw S3 HTTPS in browser. */
export function isFloorPlanPdfUrl(url: string): boolean {
  return isFloorPlanPdfKey(url);
}

export function isRawS3FloorPlanValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.includes("amazonaws.com") || v.startsWith("https://") || v.startsWith("http://");
}

/** Strip legacy HTTPS URL → S3 key; fix duplicate `CRM_Floor_Plan/` prefix from old uploads. */
export function normalizeFloorPlanS3Key(raw: string): string {
  let k = raw.trim();
  if (!k) return "";
  if (isRawS3FloorPlanValue(k)) {
    const fromUrl = k.split(".amazonaws.com/")[1]?.split("?")[0]?.split("#")[0] ?? "";
    k = fromUrl || k;
  }
  while (k.startsWith("CRM_Floor_Plan/CRM_Floor_Plan/")) {
    k = `CRM_Floor_Plan/${k.slice("CRM_Floor_Plan/CRM_Floor_Plan/".length)}`;
  }
  return k;
}

export function leadHasFloorPlan(
  stored: string,
  metaHas?: boolean,
  publicLink?: string,
): boolean {
  if (metaHas === false) return false;
  if (metaHas === true) return true;
  if (publicLink?.trim()) return true;
  return Boolean(normalizeFloorPlanS3Key(stored));
}

/** User-facing message when stream/open fails. */
export function formatFloorPlanStreamError(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower.includes("key does not exist") || lower.includes("nosuchkey")) {
    return "Floor plan file is missing in storage. Please upload again.";
  }
  if (lower.includes("login required") || lower.includes("not logged in")) {
    return "Session expired. Please log in again to view the floor plan.";
  }
  if (t.length <= 220) return t;
  return "Unable to open floor plan. Please try again or re-upload.";
}

export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Ensure S3 / CDN URLs open correctly in the browser. */
export function normalizeFloorPlanHref(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (isAbsoluteHttpUrl(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("s3://")) {
    const withoutScheme = t.slice("s3://".length);
    const slash = withoutScheme.indexOf("/");
    if (slash > 0) {
      const bucket = withoutScheme.slice(0, slash);
      const key = withoutScheme.slice(slash + 1);
      return `https://${bucket}.s3.amazonaws.com/${key}`;
    }
  }
  return t;
}

export type FloorPlanMetaResponse = {
  success?: boolean;
  hasFloorPlan?: boolean;
  floorPlanS3Key?: string | null;
  floorPlanUrl?: string | null;
  publicUrl?: string | null;
  floorPlanPublicLink?: string | null;
  viewUrl?: string | null;
  openUrl?: string | null;
  error?: string;
};

export type LeadFloorPlanState = {
  s3Key: string;
  /** Permanent public link — use in UI + external intake (no Bearer). */
  publicLink: string;
  viewPath: string;
  openPath: string;
};

/** Resolve relative `/v1/public/floor-plan/...` to absolute CRM host. */
export function normalizeFloorPlanPublicLink(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (isAbsoluteHttpUrl(t)) return t;
  const base = (
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_CRM_PUBLIC_API_BASE_URL?.trim()) ||
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API?.trim()) ||
    "https://hows.hubinterior.com"
  ).replace(/\/+$/, "");
  return `${base}${t.startsWith("/") ? t : `/${t}`}`;
}

export function pickFloorPlanPublicLink(data: {
  publicUrl?: string | null;
  floorPlanPublicLink?: string | null;
  floorPlanUrl?: string | null;
}): string {
  const candidates = [data.publicUrl, data.floorPlanPublicLink, data.floorPlanUrl];
  for (const c of candidates) {
    if (typeof c !== "string" || !c.trim()) continue;
    const n = normalizeFloorPlanPublicLink(c);
    if (n.includes("/v1/public/floor-plan/") || n.startsWith("http")) return n;
  }
  return "";
}

/** Turn backend/proxy floor-plan upload errors into short UI copy. */
export function formatFloorPlanUploadError(raw: string): string {
  const t = raw.trim();
  if (!t) return "Unable to upload floor plan. Please try again.";
  const lower = t.toLowerCase();
  if (lower.includes("aws s3 bucket not configured") || lower.includes("s3 bucket not configured")) {
    return "Floor plan storage is not configured on the server (AWS S3). Contact your administrator.";
  }
  if (
    lower.includes("signature we calculated") ||
    lower.includes("invalidaccesskeyid") ||
    lower.includes("access denied") ||
    lower.includes("service: s3")
  ) {
    return "Floor plan upload failed: server S3 credentials are invalid. Contact your administrator.";
  }
  if (lower.includes("file too large") || lower.includes("invalid file type")) {
    return t;
  }
  if (t.length <= 200) return t;
  return "Floor plan upload failed on the server. Contact your administrator.";
}
