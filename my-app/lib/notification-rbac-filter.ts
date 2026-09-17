"use client";


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

// ─── Lead ownership maps ──────────────────────────────────────────────────────

type LeadOwnershipMaps = {
  assigneeMap: Map<string, string>; // leadKey → assignee username (lowercase)
  designerMap: Map<string, string>; // leadKey → designerName (lowercase)
  /** true if the fetch succeeded but returned 0 leads; false if fetch itself failed */
  fetchSucceeded: boolean;
};

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

function pickAssigneeName(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  for (const key of [
    "assignee", "salesExecutive", "assignedTo", "salesOwnerName",
    "ownerName", "executiveName", "assignedToName", "rmName", "relationshipManager",
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

function pickDesignerName(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  for (const key of [
    "designerName", "designer", "interiorDesignerName",
    "interiorDesigner", "designConsultant", "designConsultantName",
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

async function buildOwnershipMaps(authHeader: string): Promise<LeadOwnershipMaps> {
  const assigneeMap = new Map<string, string>();
  const designerMap = new Map<string, string>();

  try {
    const qs = new URLSearchParams({
      mergeAll: "1",
      leadType: "all",
      page: "0",
      size: "2000",
      sort: "updatedAt,desc",
    });
    const res = await fetch(`/api/crm/leads?${qs}`, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`${LOG} lead fetch failed: HTTP ${res.status} — failing open for managers`);
      return { assigneeMap, designerMap, fetchSucceeded: false };
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

    console.log(`${LOG} maps built — assignee: ${assigneeMap.size}, designer: ${designerMap.size}`);
    return { assigneeMap, designerMap, fetchSucceeded: true };
  } catch (err) {
    console.warn(`${LOG} buildOwnershipMaps error:`, err);
    return { assigneeMap, designerMap, fetchSucceeded: false };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readLoginCredential(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY)?.trim();
  return stored || fallback;
}

function ownAliasSet(username: string): Set<string> {
  const aliases = collectHierarchyUserAssigneeAliases({
    username,
    name: username,
    fullName: username,
  });
  return new Set(aliases.map((a) => a.toLowerCase()));
}

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

async function presalesManagerAllowedSet(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    let currentUserId = 0;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(CRM_USER_ID_STORAGE_KEY)?.trim();
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) currentUserId = parsed;
    }
    const names = await fetchPresalesExecutiveNamesForManager(currentUserId);
    for (const name of names) set.add(name.toLowerCase());
    console.log(`${LOG} presales manager team: ${set.size} names`);
  } catch (err) {
    console.warn(`${LOG} presalesManagerAllowedSet error:`, err);
  }
  return set;
}

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

function designerOwnNameSet(loginCred: string): Set<string> {
  const set = new Set<string>();
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(CRM_DESIGNER_NAME_STORAGE_KEY)?.trim();
    if (stored) set.add(stored.toLowerCase());
  }
  if (loginCred) set.add(loginCred.toLowerCase());
  return set;
}

// ─── Core filter (fail-CLOSED for all roles) ──────────────────────────────────

/**
 * Matches each item's leadIdentifier against nameMap, then checks allowedSet.
 * Every data gap (no identifier, not in map, blank owner) → HIDE.
 * Only SALES_EXECUTIVE gets an extra numeric-ID fallback when the Spring
 * name-based map match fails.
 */
function filterByName<T extends FilterableNotificationItem>(
  items: T[],
  nameMap: Map<string, string>,
  allowedSet: Set<string>,
  role: string,
): T[] {
  const r = normalizeRole(role);

  let ownNumericId: number | null = null;
  if (r === "SALES_EXECUTIVE" && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(CRM_USER_ID_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) ownNumericId = parsed;
  }

  return items.filter((item) => {
    const key = (item.leadIdentifier ?? "").trim().toLowerCase();

    // No lead identifier → can't verify ownership → HIDE
    if (!key) {
      if (r === "SALES_EXECUTIVE" && ownNumericId !== null) {
        const assignedId = item.__assignedId as number | null | undefined;
        return typeof assignedId === "number" && assignedId === ownNumericId;
      }
      return false;
    }

    // Lead not in Spring ownership map → HIDE
    if (!nameMap.has(key)) {
      if (r === "SALES_EXECUTIVE" && ownNumericId !== null) {
        const assignedId = item.__assignedId as number | null | undefined;
        return typeof assignedId === "number" && assignedId === ownNumericId;
      }
      return false;
    }

    const owner = nameMap.get(key) ?? "";

    // Lead in map but assignee blank → HIDE
    if (!owner) {
      if (r === "SALES_EXECUTIVE" && ownNumericId !== null) {
        const assignedId = item.__assignedId as number | null | undefined;
        return typeof assignedId === "number" && assignedId === ownNumericId;
      }
      return false;
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
  console.log(`${LOG} role=${r} username=${username} items=${items.length}`);

  // ── 1. Admin roles see everything ────────────────────────────────────────
  if (ALL_ROLES.has(r)) {
    console.log(`${LOG} role=${r} → pass-through (admin)`);
    return items;
  }

  const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const loginCred = readLoginCredential(username);

  // ── 2. Build lead ownership maps from Spring API ─────────────────────────
  const { assigneeMap, designerMap, fetchSucceeded } =
    await buildOwnershipMaps(authHeader);

  if (!fetchSucceeded) {
    if (r === "SALES_MANAGER" || r === "PRESALES_MANAGER" ||
      r === "DESIGN_MANAGER" || r === "TERRITORY_DESIGN_MANAGER") {
      console.warn(`${LOG} lead fetch failed — failing open for manager role ${r}`);
      return items;
    }
    // For individual-scope roles: fetch failure → show nothing (safest default)
    console.warn(`${LOG} lead fetch failed — hiding all for individual-scope role ${r}`);
    return [];
  }

  // ── 3. Route by role and apply filter ───────────────────────────────────

  if (r === "SALES_EXECUTIVE") {
    const allowedSet = ownAliasSet(loginCred);
    console.log(`${LOG} [SALES_EXECUTIVE] own aliases: ${allowedSet.size}`);
    return filterByName(items, assigneeMap, allowedSet, r);
  }

  if (r === "SALES_MANAGER") {
    // All executives under this manager (JWT-scoped by backend)
    const allowedSet = await salesManagerAllowedSet(token);
    // Include manager's own credential for self-assigned leads
    for (const alias of ownAliasSet(loginCred)) allowedSet.add(alias);
    console.log(`${LOG} [SALES_MANAGER] allowedSet: ${allowedSet.size} aliases`);
    return filterByName(items, assigneeMap, allowedSet, r);
  }

  if (r === "PRESALES_EXECUTIVE") {
    const allowedSet = ownAliasSet(loginCred);
    console.log(`${LOG} [PRESALES_EXECUTIVE] own aliases: ${allowedSet.size}`);
    return filterByName(items, assigneeMap, allowedSet, r);
  }

  if (r === "PRESALES_MANAGER") {
    const allowedSet = await presalesManagerAllowedSet();
    for (const alias of ownAliasSet(loginCred)) allowedSet.add(alias);
    console.log(`${LOG} [PRESALES_MANAGER] allowedSet: ${allowedSet.size} names`);
    return filterByName(items, assigneeMap, allowedSet, r);
  }

  if (r === "DESIGN_MANAGER" || r === "TERRITORY_DESIGN_MANAGER") {
    const allowedSet = await designManagerAllowedSet();
    for (const alias of ownAliasSet(loginCred)) allowedSet.add(alias);
    console.log(`${LOG} [${r}] allowedSet: ${allowedSet.size} designer names`);
    return filterByName(items, designerMap, allowedSet, r);
  }

  if (r === "DESIGNER") {
    const allowedSet = designerOwnNameSet(loginCred);
    console.log(`${LOG} [DESIGNER] allowedSet: ${allowedSet.size}`);
    return filterByName(items, designerMap, allowedSet, r);
  }

  // Everything else — own credential only
  const allowedSet = ownAliasSet(loginCred);
  console.log(`${LOG} [${r}] default own-only filter: ${allowedSet.size} aliases`);
  return filterByName(items, assigneeMap, allowedSet, r);
}
