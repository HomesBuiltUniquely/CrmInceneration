import type { Lead } from "@/lib/data";
import { getRoleFromUser, normalizeRole } from "@/lib/auth/api";

export const SALES_CLOSURE_ORIGIN = (
  process.env.NEXT_PUBLIC_SALES_CLOSURE_ORIGIN?.trim() ||
  "https://design.hubinterior.com"
).replace(/\/+$/, "");

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

function formatNowForSalesClosure(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${sec}`;
}

function setSalesClosurePrefillPayload(
  u: URL,
  lead: Lead,
  authUser?: Record<string, unknown> | null,
): void {
  const mail = authUser
    ? pickUserStr(
        authUser,
        "email",
        "mail",
        "emailAddress",
        "workEmail",
        "salesEmail",
        "username",
        "userName",
        "login",
      )
    : "";
  const payload = {
    sales_email: isLikelyEmail(mail) ? mail : "",
    customer_name: lead.name?.trim() ?? "",
    co_no: lead.phone?.trim() ?? "",
    email: lead.email?.trim() ?? "",
    property_name: lead.propertyLocation?.trim() || lead.propertyNotes?.trim() || "",
    possession: lead.possessionDate?.trim() || lead.configuration?.trim() || "",
    lead_source: lead.leadSource?.trim() ?? "",
    property_configuration: lead.configuration?.trim() ?? "",
    sales_lead_name: lead.assignee?.trim() ?? "",
    designer_name: lead.designerName?.trim() ?? "",
  };
  u.searchParams.set("prefill", JSON.stringify(payload));
  u.searchParams.set("salesClosurePrefill", JSON.stringify(payload));
}

/**
 * CRM → Hub Sales Closure: lead tab fields as query params (Hub reads on load and prefills the form).
 * See `docs/sales-closure-prefill.md` for the contract.
 */
export function appendSalesClosurePrefillFromLead(u: URL, lead: Lead): void {
  const setAliases = (keys: string[], val: string | undefined) => {
    const raw = val?.trim();
    if (!raw) return;
    for (const key of keys) {
      u.searchParams.set(key, trimForQuery(raw));
    }
  };
  setAliases(["customer_name"], lead.name);
  setAliases(["email"], lead.email);
  setAliases(["co_no"], lead.phone);
  setAliases(["lead_source"], lead.leadSource);
  setAliases(["property_name"], lead.propertyLocation || lead.propertyNotes);
  setAliases(["property_configuration"], lead.configuration);
  setAliases(["possession"], lead.possessionDate || lead.configuration);
  setAliases(["sales_lead_name"], lead.assignee);
  setAliases(["designer_name"], lead.designerName);
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
    u.searchParams.set("sales_email", mail);
  } else {
    const uName = pickUserStr(user, "username", "userName", "login");
    if (uName && isLikelyEmail(uName)) {
      u.searchParams.set("sales_email", uName);
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
  if (xc) {
    u.searchParams.set("experience_center", xc);
  }
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

  if (params.lead) {
    appendSalesClosurePrefillFromLead(u, params.lead);
    setSalesClosurePrefillPayload(u, params.lead, params.authUser);
  }
  if (params.authUser && Object.keys(params.authUser).length > 0) {
    appendSalesClosurePrefillFromAuthUser(u, params.authUser);
  }
  if (params.returnUrl?.trim()) {
    u.searchParams.set("returnUrl", params.returnUrl.trim());
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

/** Hub “Closed” / Sales Closure entry from the lead header — not for Admin or Sales Admin. */
export function canAccessClosedLeadHeaderActions(role: string): boolean {
  const r = normalizeRole(role);
  return r !== "ADMIN" && r !== "SALES_ADMIN";
}

function normalizeWonCandidate(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
}

export function maybeOpenSalesClosureOnWon(args: {
  statusCandidates?: unknown[];
  currentUser?: Record<string, unknown> | null;
  openUrl: string;
  onReturnRefresh?: () => void;
}): void {
  try {
    const role = normalizeRole(getRoleFromUser(args.currentUser ?? {}));
    if (role !== "SALES_EXECUTIVE") return;
    const isWon = (args.statusCandidates ?? []).some((value) => {
      const normalized = normalizeWonCandidate(value);
      return normalized === "WON" || normalized === "CLOSED_WON";
    });
    if (!isWon) return;
    if (typeof window === "undefined") return;

    window.addEventListener(
      "focus",
      () => {
        try {
          args.onReturnRefresh?.();
        } catch (e) {
          console.warn("Refresh after Sales Closure failed:", e);
        }
      },
      { once: true },
    );
    window.open(args.openUrl, "_blank");
  } catch (e) {
    console.error("WON -> Sales Closure handling failed:", e);
  }
}
