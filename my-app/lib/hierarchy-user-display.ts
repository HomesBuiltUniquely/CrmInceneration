/** Display names and assignee aliases for hierarchy users (filters, lead matching). */

export type HierarchyUserLike = {
  id?: number | string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
};

export function hierarchyUserDisplayName(u: HierarchyUserLike): string {
  return String(u.fullName ?? u.name ?? u.username ?? "").trim();
}

/** All strings that may appear on leads for this user (API assignee filter + client match). */
export function collectHierarchyUserAssigneeAliases(u: HierarchyUserLike): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) out.add(t);
  };
  add(hierarchyUserDisplayName(u));
  add(String(u.username ?? ""));
  add(String(u.name ?? ""));
  add(String(u.fullName ?? ""));
  const email = String(u.email ?? "").trim();
  if (email && email.includes("@")) {
    add(email.split("@")[0] ?? "");
  }
  return [...out];
}

export function resolveHierarchyUserByDisplayName<T extends HierarchyUserLike>(
  displayName: string,
  users: T[],
): T[] {
  const norm = displayName.trim().toLowerCase();
  if (!norm) return [];
  return users.filter((u) =>
    collectHierarchyUserAssigneeAliases(u).some((a) => a.trim().toLowerCase() === norm),
  );
}

export function resolveAssigneeScopeForDisplayName<T extends HierarchyUserLike>(
  displayName: string,
  users: T[],
): string[] {
  const trimmed = displayName.trim();
  if (!trimmed) return [];
  const matched = resolveHierarchyUserByDisplayName(trimmed, users);
  if (matched.length === 0) return [trimmed];
  const scope = new Set<string>();
  for (const u of matched) {
    for (const alias of collectHierarchyUserAssigneeAliases(u)) scope.add(alias);
  }
  return [...scope];
}

export function normalizeLegacyHierarchyUser(row: Record<string, unknown>): HierarchyUserLike & {
  id: number;
  managerId?: number | null;
  role?: string;
  active?: boolean;
} {
  return {
    id: Number(row.id ?? 0),
    fullName: String(row.fullName ?? row.name ?? "").trim() || undefined,
    name: String(row.name ?? "").trim() || undefined,
    username: String(row.username ?? "").trim() || undefined,
    email: String(row.email ?? "").trim() || undefined,
    managerId: row.managerId != null ? Number(row.managerId) : null,
    role: String(row.role ?? "SALES_EXECUTIVE"),
    active:
      row.active === undefined && row.isActive === undefined && row.enabled === undefined
        ? true
        : Boolean(row.active ?? row.isActive ?? row.enabled),
  };
}
