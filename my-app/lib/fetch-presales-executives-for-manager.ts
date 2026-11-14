import { getAuthApiBaseUrl, normalizeRole } from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { isPresalesExecutiveRole } from "@/lib/user-active";

export type PresalesExecutiveRow = {
  id: number;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  branch?: string;
  managerId?: number | null;
  managerName?: string;
  role?: string;
  active?: boolean;
  raw: Record<string, unknown>;
};

function userDisplayName(u: PresalesExecutiveRow): string {
  return (u.fullName ?? u.name ?? u.username ?? "").trim();
}

function readManagerId(row: Record<string, unknown>): number {
  const nested =
    row.manager && typeof row.manager === "object" && !Array.isArray(row.manager)
      ? (row.manager as Record<string, unknown>)
      : null;
  const parent =
    row.parent && typeof row.parent === "object" && !Array.isArray(row.parent)
      ? (row.parent as Record<string, unknown>)
      : null;
  const candidates = [
    row.managerId,
    row.manager_id,
    row.parentId,
    row.parent_id,
    nested?.id,
    parent?.id,
  ];
  for (const v of candidates) {
    const n = Number(v ?? 0);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function readManagerName(row: Record<string, unknown>): string {
  const nested =
    row.manager && typeof row.manager === "object" && !Array.isArray(row.manager)
      ? (row.manager as Record<string, unknown>)
      : null;
  return String(
    row.managerName ??
      row.managerUsername ??
      nested?.fullName ??
      nested?.name ??
      nested?.username ??
      "",
  ).trim();
}

function coerceExecutiveRow(row: Record<string, unknown>): PresalesExecutiveRow | null {
  const id = Number(row.id ?? row.userId ?? 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  const role = normalizeRole(String(row.role ?? row.userRole ?? "PRESALES_EXECUTIVE"));
  const active =
    row.active === undefined && row.isActive === undefined && row.enabled === undefined
      ? true
      : Boolean(row.active ?? row.isActive ?? row.enabled);
  return {
    id,
    fullName: String(row.fullName ?? "").trim() || undefined,
    name: String(row.name ?? "").trim() || undefined,
    username: String(row.username ?? "").trim() || undefined,
    email: String(row.email ?? "").trim() || undefined,
    phone: String(row.phone ?? row.mobile ?? row.phoneNumber ?? "").trim() || undefined,
    branch: String(row.branch ?? row.branchName ?? "").trim() || undefined,
    managerId: readManagerId(row) || null,
    managerName: readManagerName(row) || undefined,
    role,
    active,
    raw: row,
  };
}

async function parseUsers(r: Response): Promise<PresalesExecutiveRow[]> {
  if (!r.ok) return [];
  const j = (await r.json().catch(() => [])) as unknown;
  const arr = Array.isArray(j)
    ? j
    : j && typeof j === "object" && Array.isArray((j as { data?: unknown }).data)
      ? ((j as { data: unknown[] }).data ?? [])
      : j && typeof j === "object" && Array.isArray((j as { content?: unknown }).content)
        ? ((j as { content: unknown[] }).content ?? [])
        : [];
  const out: PresalesExecutiveRow[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const row = coerceExecutiveRow(item as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Presales executives for a manager — same Hub sources as Leads team filter.
 * Prefer auth `users-by-role`; fall back to admin / PreSales list proxies.
 */
export async function fetchPresalesExecutivesForManager(
  currentUserId: number,
): Promise<PresalesExecutiveRow[]> {
  const auth = getCrmAuthHeaders();
  const authBase = getAuthApiBaseUrl();

  const peRes = await fetch(`${authBase}/api/auth/users-by-role?role=PRESALES_EXECUTIVE`, {
    cache: "no-store",
    headers: auth,
    credentials: "include",
  });
  let rows = await parseUsers(peRes);

  if (rows.length === 0) {
    const [adminPe, adminPre, preSalesRes, legacyAll] = await Promise.all([
      fetch("/api/admin/users-by-role?role=PRESALES_EXECUTIVE", {
        cache: "no-store",
        headers: auth,
        credentials: "include",
      }).catch(() => null),
      fetch("/api/admin/users-by-role?role=PRE_SALES", {
        cache: "no-store",
        headers: auth,
        credentials: "include",
      }).catch(() => null),
      fetch("/api/admin/pre-sales", {
        cache: "no-store",
        headers: auth,
        credentials: "include",
      }).catch(() => null),
      fetch("/api/pre-sales/all", {
        cache: "no-store",
        headers: auth,
        credentials: "include",
      }).catch(() => null),
    ]);
    const adminRows = [
      ...(adminPe ? await parseUsers(adminPe) : []),
      ...(adminPre ? await parseUsers(adminPre) : []),
      ...(preSalesRes ? await parseUsers(preSalesRes) : []),
      ...(legacyAll ? await parseUsers(legacyAll) : []),
    ];
    rows = adminRows;
  }

  const byId = new Map<number, PresalesExecutiveRow>();
  for (const u of rows) {
    if (u.active === false) continue;
    const roleOk =
      isPresalesExecutiveRole(u.role ?? "") ||
      normalizeRole(u.role ?? "") === "PRESALES_EXECUTIVE" ||
      normalizeRole(u.role ?? "") === "PRE_SALES";
    if (!roleOk) continue;
    if (currentUserId > 0) {
      const mid = Number(u.managerId ?? 0);
      // Prefer under-manager rows; keep JWT-scoped rows with missing managerId.
      if (mid > 0 && mid !== Number(currentUserId)) continue;
    }
    if (!byId.has(u.id)) byId.set(u.id, u);
  }

  let merged = Array.from(byId.values());
  // If managerId was present on some rows, prefer only those under this manager.
  if (currentUserId > 0) {
    const underManager = merged.filter((u) => Number(u.managerId ?? 0) === Number(currentUserId));
    if (underManager.length > 0) merged = underManager;
  }

  return merged.sort((a, b) => userDisplayName(a).localeCompare(userDisplayName(b)));
}

/**
 * Presales executives reporting to the given manager (display names only).
 * Same rules as {@link fetchPresalesExecutivesForManager}.
 */
export async function fetchPresalesExecutiveNamesForManager(
  currentUserId: number,
): Promise<string[]> {
  const rows = await fetchPresalesExecutivesForManager(currentUserId);
  return rows.map(userDisplayName).filter(Boolean);
}
