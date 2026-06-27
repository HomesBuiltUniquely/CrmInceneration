import {
  getAuthApiBaseUrl,
  getNameFromUser,
  getRoleFromUser,
  normalizeRole,
  unwrapAuthUserPayload,
} from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  hierarchyUserDisplayName,
  normalizeLegacyHierarchyUser,
} from "@/lib/hierarchy-user-display";
import type { IncentiveMemberRef } from "@/lib/incentives-profile";
import { isUserActive } from "@/lib/user-active";

export type IncentivesHierarchyUser = {
  id: number;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  managerId?: number | null;
  active?: boolean;
  isActive?: boolean;
};

export type IncentivesRoster = {
  viewer: IncentiveMemberRef;
  managers: IncentiveMemberRef[];
  executives: IncentiveMemberRef[];
  canPickTeam: boolean;
  canPickManager: boolean;
};

function userLabel(u: IncentivesHierarchyUser): string {
  return hierarchyUserDisplayName(u) || `User ${u.id}`;
}

async function fetchUsersByRole(
  role: string,
  token: string,
): Promise<IncentivesHierarchyUser[]> {
  const header = {
    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
  };
  const res = await fetch(
    `${getAuthApiBaseUrl()}/api/auth/users-by-role?role=${encodeURIComponent(role)}`,
    { cache: "no-store", headers: header },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as IncentivesHierarchyUser[];
  return Array.isArray(data) ? data : [];
}

async function fetchLegacySalesExecutives(): Promise<IncentivesHierarchyUser[]> {
  const res = await fetch("/api/sales-executive/all", {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => [])) as unknown;
  const raw = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)
      ? ((json as { data: unknown[] }).data ?? [])
      : [];
  const rows: IncentivesHierarchyUser[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    rows.push(normalizeLegacyHierarchyUser(row as Record<string, unknown>));
  }
  return rows;
}

function toMemberRef(
  u: IncentivesHierarchyUser,
  managerNameById: Map<number, string>,
): IncentiveMemberRef | null {
  const id = Number(u.id ?? 0);
  if (!id) return null;
  const managerId = u.managerId != null ? Number(u.managerId) : null;
  return {
    id,
    name: userLabel(u),
    role: normalizeRole(String(u.role ?? "SALES_EXECUTIVE")),
    managerId,
    managerName: managerId ? managerNameById.get(managerId) : undefined,
  };
}

function dedupeMembers(members: IncentiveMemberRef[]): IncentiveMemberRef[] {
  const byId = new Map<number, IncentiveMemberRef>();
  for (const m of members) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadIncentivesRoster(token: string): Promise<IncentivesRoster> {
  const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const meRes = await fetch(`${getAuthApiBaseUrl()}/api/auth/me`, {
    cache: "no-store",
    headers: { Authorization: auth },
  });
  const meJson = meRes.ok
    ? unwrapAuthUserPayload((await meRes.json().catch(() => ({}))) as Record<string, unknown>)
    : {};
  const viewerId = Number(meJson.id ?? 0);
  const viewerRole = normalizeRole(getRoleFromUser(meJson));
  const viewer: IncentiveMemberRef = {
    id: viewerId || 0,
    name: getNameFromUser(meJson) || "User",
    role: viewerRole,
    managerId: meJson.managerId != null ? Number(meJson.managerId) : null,
  };

  const canPickManager =
    viewerRole === "SUPER_ADMIN" || viewerRole === "SALES_ADMIN" || viewerRole === "ADMIN";
  const canPickTeam =
    canPickManager || viewerRole === "SALES_MANAGER" || viewerRole === "MANAGER";

  if (!canPickTeam) {
    return {
      viewer,
      managers: [],
      executives: viewerId ? [viewer] : [],
      canPickTeam: false,
      canPickManager: false,
    };
  }

  const [managersRaw, execsByRole, execsLegacy] = await Promise.all([
    canPickManager ? fetchUsersByRole("SALES_MANAGER", token) : Promise.resolve([]),
    fetchUsersByRole("SALES_EXECUTIVE", token),
    fetchLegacySalesExecutives(),
  ]);

  const activeManagers = managersRaw.filter(isUserActive);
  const managerNameById = new Map<number, string>(
    activeManagers.map((m) => [Number(m.id), userLabel(m)] as const),
  );

  const mergedExecUsers = Array.from(
    new Map(
      [...execsByRole, ...execsLegacy]
        .filter(isUserActive)
        .map((u) => [Number(u.id ?? 0), u] as const),
    ).values(),
  ).filter((u) => Number(u.id ?? 0) > 0);

  let executives = dedupeMembers(
    mergedExecUsers
      .map((u) => toMemberRef(u, managerNameById))
      .filter((m): m is IncentiveMemberRef => m !== null),
  );

  if (viewerRole === "SALES_MANAGER" || viewerRole === "MANAGER") {
    executives = executives.filter((e) => e.managerId === viewerId);
  }

  const managers = dedupeMembers(
    activeManagers
      .map((m) => toMemberRef(m, managerNameById))
      .filter((m): m is IncentiveMemberRef => m !== null),
  );

  return {
    viewer,
    managers,
    executives,
    canPickTeam,
    canPickManager,
  };
}
