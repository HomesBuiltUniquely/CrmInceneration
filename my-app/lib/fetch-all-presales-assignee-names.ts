import { getAuthApiBaseUrl, normalizeRole } from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

function pickDisplayName(u: Record<string, unknown>): string {
  const n = String(u.fullName ?? u.name ?? u.username ?? "").trim();
  return n;
}

/** Display names for all active presales managers + executives (incl. PRE_SALES), for super-admin presales workspace scoping. */
export async function fetchAllPresalesAssigneeDisplayNames(): Promise<string[]> {
  const auth = getCrmAuthHeaders();
  const authBase = getAuthApiBaseUrl();
  const roles = ["PRESALES_MANAGER", "PRESALES_EXECUTIVE", "PRE_SALES"] as const;
  const names = new Set<string>();

  await Promise.all(
    roles.map(async (roleName) => {
      try {
        const res = await fetch(
          `${authBase}/api/auth/users-by-role?role=${encodeURIComponent(roleName)}`,
          { cache: "no-store", headers: auth, credentials: "include" },
        );
        if (!res.ok) return;
        const j = (await res.json().catch(() => [])) as unknown;
        const rows = Array.isArray(j) ? j : [];
        for (const raw of rows) {
          const u = raw as Record<string, unknown>;
          if (u.active === false) continue;
          if (roleName === "PRESALES_EXECUTIVE" || roleName === "PRE_SALES") {
            const r = normalizeRole(String(u.role ?? ""));
            if (r !== "PRESALES_EXECUTIVE" && r !== "PRE_SALES") continue;
          }
          const n = pickDisplayName(u);
          if (n) names.add(n);
        }
      } catch {
        // ignore per-role failures
      }
    }),
  );

  return [...names];
}
