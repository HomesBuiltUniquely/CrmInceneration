/** Unwrap common Spring / custom envelope shapes to a plain array. */
export function normalizeToArray<T extends Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["data", "users", "content", "items", "result", "records", "rows"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

export function pickNumber(obj: unknown, keys: string[]): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

const LIMIT_STAT_KEYS = ["limit", "monthlyLimit", "monthlyLeadLimit", "leadLimit", "maxLeads"];
const CURRENT_STAT_KEYS = [
  "current",
  "currentCount",
  "used",
  "leadsCount",
  "activeLeads",
  "usedLeads",
  "leadsUsed",
];
const REMAINING_STAT_KEYS = ["remaining", "remainingLeads"];

function rowHasLimitStats(u: Record<string, unknown>): boolean {
  return (
    pickNumber(u, LIMIT_STAT_KEYS) !== undefined ||
    pickNumber(u, CURRENT_STAT_KEYS) !== undefined ||
    pickNumber(u, REMAINING_STAT_KEYS) !== undefined
  );
}

function copyLimitStatFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const k of [...LIMIT_STAT_KEYS, ...CURRENT_STAT_KEYS, ...REMAINING_STAT_KEYS]) {
    const v = source[k];
    if (v !== undefined && v !== null) target[k] = v;
  }
}

function mergeTwoUserRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const aHas = rowHasLimitStats(a);
  const bHas = rowHasLimitStats(b);
  const merged: Record<string, unknown> = { ...a, ...b };
  const statsSource = bHas ? b : aHas ? a : null;
  if (statsSource) copyLimitStatFields(merged, statsSource);
  return merged;
}

/** Merge user rows by id; rows with lead-limit stats are never overwritten by profile-only rows. */
export function mergeUserRowsById(
  ...groups: Array<Array<Record<string, unknown>>>
): Array<Record<string, unknown>> {
  const byId = new Map<number, Record<string, unknown>>();
  for (const group of groups) {
    for (const u of group) {
      const id = Number(u.userId ?? u.id);
      if (Number.isNaN(id)) continue;
      const prev = byId.get(id);
      byId.set(id, prev ? mergeTwoUserRows(prev, u) : { ...u });
    }
  }
  return Array.from(byId.values());
}
