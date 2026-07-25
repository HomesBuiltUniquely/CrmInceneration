"use client";

/**
 * notification-rbac-filter.ts
 *
 * Pure client-side RBAC filtering for raw meeting notification items.
 *
 * Strategy
 * ─────────
 * 1. Roles that see everything (SUPER_ADMIN, ADMIN, SALES_ADMIN) → pass through.
 *
 * 2. For all other roles we need two things:
 *
 *    a. Lead ownership map — built in ONE fetch from /api/crm/leads (mergeAll=1).
 *
 *         assigneeMap:  leadKey → assignee username (lowercase string)
 *
 *       The Spring API returns `assignee: "prerana"` — a plain username string,
 *       NOT a numeric ID.  Name-based matching is the only reliable approach
 *       for this backend.
 *
 *         designerMap:  leadKey → designerName (lowercase string)
 *
 *    b. Allowed-name set — who this viewer may see:
 *         SALES_MANAGER:            all SALES_EXECUTIVEs reporting to this
 *                                   manager (fetchSalesExecutivesForManager,
 *                                   JWT-scoped by backend).
 *         SALES_EXECUTIVE:          own login credential (crm_login_username).
 *         PRESALES_MANAGER:         presales executive names under this manager.
 *         DESIGN_MANAGER /
 *         TERRITORY_DESIGN_MANAGER: all active designer display names.
 *         DESIGNER:                 own designer display name from localStorage.
 *         PRESALES_EXECUTIVE /
 *         every other role:         own login credential + aliases.
 *
 * 3. Visibility rules depend on role scope:
 *
 *    INDIVIDUAL_SCOPE_ROLES (SALES_EXECUTIVE, DESIGNER, PRESALES_EXECUTIVE):
 *      Fail-CLOSED — a data gap (missing leadIdentifier, lead not in map,
 *      blank assignee) means HIDE, not show. These roles should only ever see
 *      their own notifications; leaking others' data is worse than hiding some.
 *
 *    Team/all scope roles (SALES_MANAGER, PRESALES_MANAGER, DESIGN_MANAGER, etc.):
 *      Fail-OPEN — data gaps mean SHOW. Over-hiding for managers is a bigger
 *      UX problem than a small data leak at the team level.
 *
 * The Go backend already pre-filters via scope=own/team/all using the login
 * credential against leadDetails.assigned_to.  This frontend filter is a
 * second pass using the Spring leads API as the source of truth for ownership.
 * Both layers must agree for a notification to be shown to an individual-scope role.
 */

import {
  CRM_DESIGNER_NAME_STORAGE_KEY,
  CRM_LOGIN_USERNAME_KEY,
  CRM_USER_ID_STORAGE_KEY,
  fetchSalesExecutivesForManager,
  normalizeRole,
} from "@/lib/auth/api";
import {
  collectHierarchyUserAssigneeAliases,
  normalizeLegacyHierarchyUser,
} from "@/lib/hierarchy-user-display";
import { fetchPresalesExecutiveNamesForManager } from "@/lib/fetch-presales-executives-for-manager";
import { fetchActiveDesignerRecords } from "@/lib/designer-dashboard-client";
import type { ApiLead } from "@/lib/leads-filter";

const LOG = "[notification-rbac-filter]";

// ─── Roles that always see every notification ─────────────────────────────────

const ALL_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "SALES_ADMIN"]);

/**
 * Roles with individual scope — each user should only see their OWN notifications.
 * The filter is fail-CLOSED for these: a data gap (no leadIdentifier, lead not in
 * map, blank assignee) means HIDE rather than show.  Leaking another exec's data
 * is worse than briefly hiding a notification while the lead map is loading.
 */
const INDIVIDUAL_SCOPE_ROLES = new Set([
  "SALES_EXECUTIVE",
  "DESIGNER",
  "PRESALES_EXECUTIVE",
]);

// ─── Lead ownership maps ──────────────────────────────────────────────────────

type LeadOwnershipMaps = {
  /** leadKey (lowercase) → assignee username (lowercase) from Spring leads API. */
  assigneeMap: Map<string, string>;
  /** leadKey (lowercase) → designerName (lowercase). */
  designerMap: Map<string, string>;
};

/**
 * Stable lead key — prefers the business ID (leadId / uniqueId) which is what
 * the Go notification server stores in lead_identifier.
 */
function leadKey(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const k = String(
    row.leadId ??
    row.uniqueId ??
    row.lead_identifier ??
    row.leadIdentifier ??
    row.externalReferenceId ??
    "",
  ).trim();
  if (k) return k.toLowerCase();
  return lead.id != null ? String(lead.id).toLowerCase() : "";
}

/**
 * Extract the assignee username from a lead row.
 * The Spring API returns `assignee: "prerana"` — a plain username string.
 */
function pickAssigneeName(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;

  for (const key of [
    "assignee",
    "salesExecutive",
    "assignedTo",
    "salesOwnerName",
    "ownerName",
    "executiveName",
    "assignedToName",
    "rmName",
    "relationshipManager",
  ]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }

  for (const key of ["assignee", "salesOwner", "owner", "assignedTo", "assignedUser"]) {
    const v = row[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const n = String(o.fullName ?? o.name ?? o.username ?? "").trim();
      if (n) return n.toLowerCase();
    }
  }

  return "";
}

/**
 * Extract the designer name from a lead row.
 */
function pickDesignerName(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;

  for (const key of [
    "designerName",
    "designer",
    "interiorDesignerName",
    "interiorDesigner",
    "designConsultant",
    "designConsultantName",
  ]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const n = String(o.fullName ?? o.name ?? "").trim();
      if (n) return n.toLowerCase();
    }
  }

  return "";
}

/**
 * ONE fetch to /api/crm/leads builds both ownership maps in a single pass.
 * On any failure returns empty maps so the filter fails open (shows all).
 */
async function buildOwnershipMaps(authHeader: string): Promise<LeadOwnershipMaps> {
  const assigneeMap = new Map<string, string>();
  const designerMap = new Map<string, string>();

  try {
    const qs = new URLSearchParams({
      mergeAll: "1",
      leadType: "all",
      page:     "0",
      size:     "2000",
      sort:     "updatedAt,desc",
    });
    const res = await fetch(`/api/crm/leads?${qs}`, {
      headers: { Authorization: authHeader },
      cache:   "no-store",
    });
    if (!res.ok) {
      console.warn(`${LOG} lead fetch failed: HTTP ${res.status}`);
      return { assigneeMap, designerMap };
    }

    const json = (await res.json().catch(() => null)) as unknown;
    const leads: ApiLead[] = Array.isArray(json)
      ? (json as ApiLead[])
      : Array.isArray((json as Record<string, unknown>)?.content)
        ? ((json as Record<string, unknown>).content as ApiLead[])
        : [];

    for (const lead of leads) {
      const k = leadKey(lead);
      if (!k) continue;
      const assignee = pickAssigneeName(lead);
      const designer = pickDesignerName(lead);
      if (assignee) assigneeMap.set(k, assignee);
      if (designer) designerMap.set(k, designer);
    }

    console.log(
      `${LOG} maps built — assignee: ${assigneeMap.size}, designer: ${designerMap.size}`,
    );
  } catch (err) {
    console.warn(`${LOG} buildOwnershipMaps error:`, err);
  }

  return { assigneeMap, designerMap };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read the login credential from localStorage.
 * crm_login_username is the value typed at the login form — it matches
 * both leadDetails.assigned_to (Go) and the `assignee` field (Spring).
 */
function readLoginCredential(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY)?.trim();
  return stored || fallback;
}

/** All lowercase name variants for a username. */
function ownAliasSet(username: string): Set<string> {
  const aliases = collectHierarchyUserAssigneeAliases({
    username,
    name:     username,
    fullName: username,
  });
  return new Set(aliases.map((a) => a.toLowerCase()));
}

/**
 * SALES_MANAGER — all usernames of executives reporting to this manager.
 * JWT-scoped by the backend so no extra client-side filtering needed.
 */
async function salesManagerAllowedSet(token: string): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const executives = await fetchSalesExecutivesForManager(token);
    for (const raw of executives) {
      const user = normalizeLegacyHierarchyUser(raw);
      for (const alias of collectHierarchyUserAssigneeAliases(user)) {
        set.add(alias.toLowerCase());
      }
    }
    console.log(`${LOG} sales manager team: ${set.size} aliases`);
  } catch (err) {
    console.warn(`${LOG} salesManagerAllowedSet error:`, err);
  }
  return set;
}

/** PRESALES_MANAGER — presales executive names under this manager. */
async function presalesManagerAllowedSet(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const names = await fetchPresalesExecutiveNamesForManager(0);
    for (const name of names) set.add(name.toLowerCase());
    console.log(`${LOG} presales manager team: ${set.size} names`);
  } catch (err) {
    console.warn(`${LOG} presalesManagerAllowedSet error:`, err);
  }
  return set;
}

/** DESIGN_MANAGER / TERRITORY_DESIGN_MANAGER — all active designer names. */
async function designManagerAllowedSet(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const rows = await fetchActiveDesignerRecords();
    for (const r of rows) {
      if (r.name) set.add(r.name.toLowerCase());
    }
    console.log(`${LOG} design manager team: ${set.size} designer names`);
  } catch (err) {
    console.warn(`${LOG} designManagerAllowedSet error:`, err);
  }
  return set;
}

/** DESIGNER — own designer display name from localStorage. */
function designerOwnNameSet(loginCred: string): Set<string> {
  const set = new Set<string>();
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(CRM_DESIGNER_NAME_STORAGE_KEY)?.trim();
    if (stored) set.add(stored.toLowerCase());
  }
  if (loginCred) set.add(loginCred.toLowerCase());
  return set;
}

/**
 * Core name-based filter — matches each notification's leadIdentifier
 * against the nameMap, then checks if the owner is in allowedSet.
 *
 * Fail behaviour depends on role scope:
 *   Individual-scope roles (INDIVIDUAL_SCOPE_ROLES): fail-CLOSED.
 *     Data gaps (missing identifier, lead not in map, blank owner) → HIDE.
 *   Team/all-scope roles: fail-OPEN.
 *     Data gaps → SHOW (over-hiding managers is a worse UX problem).
 *
 * For SALES_EXECUTIVE, if name-based matching fails we fall back to a numeric
 * user-ID check against __assignedId (populated by notification-service.ts from
 * the Go payload's assignedToId / sales_executive_id fields).  This provides a
 * stronger identity signal when the Spring field name doesn't match.
 */
function filterByName<T extends FilterableNotificationItem>(
  items: T[],
  nameMap: Map<string, string>,
  allowedSet: Set<string>,
  role: string,
  loginCred: string,
): T[] {
  const r = normalizeRole(role);
  const strict = INDIVIDUAL_SCOPE_ROLES.has(r);

  // Numeric user ID for the SALES_EXECUTIVE fallback path.
  let ownNumericId: number | null = null;
  if (r === "SALES_EXECUTIVE" && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(CRM_USER_ID_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) ownNumericId = parsed;
  }

  console.log(
    `${LOG} role=${role} cred=${loginCred} strict=${strict} ownNumericId=${ownNumericId} — ` +
    `allowedSet: ${allowedSet.size}, nameMap: ${nameMap.size} entries`,
  );

  return items.filter((item) => {
    const key = (item.leadIdentifier ?? "").trim().toLowerCase();

    if (!key) {
      // No identifier to match on. For individual-scope roles this must NOT
      // default to visible — that's exactly how execs were seeing everyone's
      // notifications. Try numeric ID fallback for SALES_EXECUTIVE.
      if (strict) {
        if (r === "SALES_EXECUTIVE" && ownNumericId !== null) {
          const assignedId = item.__assignedId as number | null | undefined;
          return typeof assignedId === "number" && assignedId === ownNumericId;
        }
        return false;
      }
      return true;
    }

    if (!nameMap.has(key)) {
      // Lead not in Spring map — data gap.
      if (strict) {
        if (r === "SALES_EXECUTIVE" && ownNumericId !== null) {
          const assignedId = item.__assignedId as number | null | undefined;
          return typeof assignedId === "number" && assignedId === ownNumericId;
        }
        return false;
      }
      return true;
    }

    const owner = nameMap.get(key) ?? "";
    if (!owner) {
      // Assignee field blank on the lead row — data gap.
      if (strict) {
        if (r === "SALES_EXECUTIVE" && ownNumericId !== null) {
          const assignedId = item.__assignedId as number | null | undefined;
          return typeof assignedId === "number" && assignedId === ownNumericId;
        }
        return false;
      }
      return true;
    }

    return allowedSet.has(owner);
  });
}

// ─── Public type ──────────────────────────────────────────────────────────────

export interface FilterableNotificationItem {
  leadIdentifier?: string;
  [key: string]: unknown;
}

// ─── Main exported filter ─────────────────────────────────────────────────────

export async function applyNotificationRbacFilter<T extends FilterableNotificationItem>(
  items: T[],
  token: string,
  role: string,
  username: string,
): Promise<T[]> {
  if (items.length === 0) return items;

  const r = normalizeRole(role);
  console.log(`${LOG} applyNotificationRbacFilter called: role=${r}, username=${username}, items=${items.length}`);

  // ── 1. All-access roles ──────────────────────────────────────────────────
  if (ALL_ROLES.has(r)) {
    console.log(`${LOG} role=${r} → pass-through (${items.length} items)`);
    return items;
  }

  const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const loginCred  = readLoginCredential(username);
  console.log(`${LOG} loginCred=${loginCred}`);

  // ── 2. ONE lead fetch — builds assigneeMap and designerMap ───────────────
  const { assigneeMap, designerMap } = await buildOwnershipMaps(authHeader);
  console.log(`${LOG} assigneeMap.size=${assigneeMap.size}, designerMap.size=${designerMap.size}`);

  // If Spring returned no leads for this user the assigneeMap will be empty.
  // For SALES_MANAGER only: Go's scope=team already pre-filtered correctly —
  // trust it rather than hiding the entire team's notifications.
  // SALES_EXECUTIVE does NOT get this bypass: Go's scope=own is exactly what's
  // suspect when execs see others' data. An empty map → filterByName(strict)
  // → show nothing, which is the safer default until the map is populated.
  if (assigneeMap.size === 0 && r === "SALES_MANAGER") {
    console.warn(`${LOG} role=${r} — assigneeMap empty, trusting Go scope result`);
    return items;
  }

  // ── 3. Route by role ─────────────────────────────────────────────────────

  if (r === "SALES_EXECUTIVE") {
    const allowedSet = ownAliasSet(loginCred);
    return filterByName(items, assigneeMap, allowedSet, r, loginCred);
  }

  if (r === "SALES_MANAGER") {
    const allowedSet = await salesManagerAllowedSet(token);
    // Include manager's own credential so their self-assigned leads appear.
    for (const alias of ownAliasSet(loginCred)) allowedSet.add(alias);
    return filterByName(items, assigneeMap, allowedSet, r, loginCred);
  }

  if (r === "PRESALES_MANAGER") {
    const allowedSet = await presalesManagerAllowedSet();
    for (const alias of ownAliasSet(loginCred)) allowedSet.add(alias);
    return filterByName(items, assigneeMap, allowedSet, r, loginCred);
  }

 
  // PRESALES_EXECUTIVE and everything else
  return filterByName(items, assigneeMap, ownAliasSet(loginCred), r, loginCred);
}
