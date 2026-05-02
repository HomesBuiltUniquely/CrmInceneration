import type { Lead } from "@/lib/data";

export const SALES_CLOSURE_ORIGIN = "https://design.hubinterior.com";

/** Avoid oversized URLs when property notes are long. */
const MAX_QUERY_VALUE_LEN = 1800;

function trimForQuery(value: string): string {
  const t = value.trim();
  if (t.length <= MAX_QUERY_VALUE_LEN) return t;
  return `${t.slice(0, MAX_QUERY_VALUE_LEN)}…`;
}

function pickUserStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function isLikelyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * CRM → Hub Sales Closure: lead tab fields as query params (Hub reads on load and prefills the form).
 * See `docs/sales-closure-prefill.md` for the contract.
 */
export function appendSalesClosurePrefillFromLead(u: URL, lead: Lead): void {
  const set = (key: string, val: string | undefined) => {
    const raw = val?.trim();
    if (!raw) return;
    u.searchParams.set(key, trimForQuery(raw));
  };
  set("customerName", lead.name);
  set("clientEmail", lead.email);
  set("contactNo", lead.phone);
  set("leadSource", lead.leadSource);
  /** Property notes (CRM) → "Property Name" on Hub form */
  set("propertyName", lead.propertyNotes);
  /** Configuration (CRM; Add Lead uses propertyType on API — same UI field) → "Property Configuration" */
  set("propertyConfiguration", lead.configuration);
}

/**
 * Logged-in user from GET /api/auth/me → Sales mail + Experience Center / branch.
 */
export function appendSalesClosurePrefillFromAuthUser(
  u: URL,
  user: Record<string, unknown>,
): void {
  const mail = pickUserStr(
    user,
    "email",
    "mail",
    "emailAddress",
    "workEmail",
    "salesEmail",
  );
  if (mail && isLikelyEmail(mail)) {
    u.searchParams.set("salesMail", mail);
  } else {
    const uName = pickUserStr(user, "username");
    if (uName && isLikelyEmail(uName)) {
      u.searchParams.set("salesMail", uName);
    }
  }

  const xc = pickUserStr(
    user,
    "experienceCenter",
    "experience_center",
    "branch",
    "branchName",
    "branch_name",
    "office",
    "officeName",
    "territory",
    "region",
  );
  if (xc) u.searchParams.set("experienceCenter", xc);
}

/** §12 Sales Closure — external flow (opens in new tab or full redirect). */
export function buildSalesClosureUrl(params: {
  leadId: string;
  leadTypeLabel: string;
  /** Current CRM URL so Hub can send the user back. */
  returnUrl?: string;
  /** Lead detail — prefill customer/property fields */
  lead?: Lead;
  /** `GET /api/auth/me` user — prefill sales mail & experience center when present */
  authUser?: Record<string, unknown> | null;
}): string {
  const u = new URL(`${SALES_CLOSURE_ORIGIN}/SalesClosure`);
  u.searchParams.set("leadId", params.leadId);
  u.searchParams.set("leadType", params.leadTypeLabel);
  if (params.returnUrl?.trim()) {
    u.searchParams.set("returnUrl", params.returnUrl.trim());
  }
  if (params.lead) {
    appendSalesClosurePrefillFromLead(u, params.lead);
  }
  if (params.authUser && Object.keys(params.authUser).length > 0) {
    appendSalesClosurePrefillFromAuthUser(u, params.authUser);
  }
  return u.toString();
}

/**
 * Show Sales Closure CTA when pipeline is **Closer** and substage indicates **Booking Done**
 * (matches legacy “booking done in closer” handoff).
 */
export function isCloserStageBookingDone(lead: Lead): boolean {
  const stage = (lead.stageBlock?.milestoneStage ?? "").toLowerCase();
  const sub = (lead.stageBlock?.milestoneSubStage ?? "").toLowerCase();
  const legacy = (lead.status ?? "").toLowerCase();
  const closer = stage.includes("closer");
  const bookingDone = /booking\s*done/.test(sub) || /booking\s*done/.test(legacy);
  return closer && bookingDone;
}
