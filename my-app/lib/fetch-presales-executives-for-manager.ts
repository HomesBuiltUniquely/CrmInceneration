import { getAuthApiBaseUrl, normalizeRole } from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

type HierarchyUser = {
  id: number;
  fullName?: string;
  username?: string;
  managerId?: number | null;
  role?: string;
  active?: boolean;
};

function userDisplayName(u: HierarchyUser): string {
  return (u.fullName ?? u.username ?? "").trim();
}

/**
 * Presales executives reporting to the given manager (same rules as LeadsDataSection).
 */
export async function fetchPresalesExecutiveNamesForManager(currentUserId: number): Promise<string[]> {
  const auth = getCrmAuthHeaders();
  const authBase = getAuthApiBaseUrl();
  const parse = async (r: Response): Promise<HierarchyUser[]> => {
    if (!r.ok) return [];
    const j = (await r.json().catch(() => [])) as unknown;
    return Array.isArray(j) ? (j as HierarchyUser[]) : [];
  };
  const peRes = await fetch(`${authBase}/api/auth/users-by-role?role=PRESALES_EXECUTIVE`, {
    cache: "no-store",
    headers: auth,
    credentials: "include",
  });
  let rows = await parse(peRes);
  if (rows.length === 0) {
    const [adminPe, adminPre, preSalesRes] = await Promise.all([
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
    ]);
    const adminRows = [
      ...(adminPe ? await parse(adminPe) : []),
      ...(adminPre ? await parse(adminPre) : []),
      ...(preSalesRes ? await parse(preSalesRes) : []),
    ];
    rows = adminRows;
  }
  const merged = rows.filter((u) => {
    if (u.active === false) return false;
    if (normalizeRole(String(u.role ?? "")) !== "PRESALES_EXECUTIVE") return false;
    if (currentUserId > 0) return Number(u.managerId ?? 0) === Number(currentUserId);
    return true;
  });
  const deduped = Array.from(new Map(merged.map((u) => [u.id, u])).values());
  return deduped.map(userDisplayName).filter(Boolean);
}
