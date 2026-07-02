import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { normalizeToArray } from "@/lib/api-normalize";
import {
  DEFAULT_MONTHLY_SALES_TARGET_INR,
  type SalesTargetUserRow,
} from "@/lib/sales-targets";

type AnyJson = Record<string, unknown>;

function monthQuery(month?: string): string {
  return month ? `?month=${encodeURIComponent(month)}` : "";
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/sales-targets/${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as T & AnyJson;
  if (!res.ok) {
    const message = (data as AnyJson).message ?? (data as AnyJson).error;
    const msg = typeof message === "string" ? message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function pickNumber(row: AnyJson, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function mapTargetUser(row: AnyJson, defaultTarget: number): SalesTargetUserRow {
  const userId = pickNumber(row, ["userId", "user_id", "id"]) ?? 0;
  const override = pickNumber(row, [
    "monthlyTargetInr",
    "monthly_target_inr",
    "targetInr",
    "target",
    "monthlyTarget",
  ]);
  const isCustom = Boolean(row.isCustom ?? row.custom ?? override != null);
  return {
    userId,
    name: String(row.name ?? row.userName ?? row.fullName ?? `User #${userId}`),
    role: String(row.role ?? "SALES_EXECUTIVE"),
    branch: row.branch != null ? String(row.branch) : undefined,
    managerName: row.managerName != null ? String(row.managerName) : undefined,
    monthlyTargetInr: override ?? defaultTarget,
    isCustom,
  };
}

export const salesTargetsApi = {
  getDefault: (month?: string) => call<AnyJson>(`default${monthQuery(month)}`),
  setDefault: (defaultTargetInr: number, month?: string) =>
    call<AnyJson>("default", {
      method: "POST",
      body: JSON.stringify({ defaultTargetInr, month }),
    }),
  listUsers: async (month?: string): Promise<SalesTargetUserRow[]> => {
    const raw = await call<unknown>(`users${monthQuery(month)}`);
    const rows = normalizeToArray<AnyJson>(raw);
    let defaultTarget = DEFAULT_MONTHLY_SALES_TARGET_INR;
    try {
      const def = await salesTargetsApi.getDefault(month);
      defaultTarget =
        pickNumber(def, ["defaultTargetInr", "defaultTarget", "targetInr", "value"]) ??
        DEFAULT_MONTHLY_SALES_TARGET_INR;
    } catch {
      // use constant default
    }
    return rows.map((row) => mapTargetUser(row, defaultTarget));
  },
  setUserTarget: (userId: number | string, monthlyTargetInr: number, month?: string) =>
    call<AnyJson>(`user/${userId}`, {
      method: "POST",
      body: JSON.stringify({ monthlyTargetInr, month }),
    }),
  bulkUsers: (payload: { userIds: number[]; monthlyTargetInr: number; month?: string }) =>
    call<AnyJson>("bulk/users", { method: "POST", body: JSON.stringify(payload) }),
};

/** Map API target rows onto incentive members by user id. */
export function applyMonthlyTargets<T extends { id: number }>(
  members: T[],
  targets: SalesTargetUserRow[],
  fallback = DEFAULT_MONTHLY_SALES_TARGET_INR,
): (T & { monthlyTargetInr: number })[] {
  const byId = new Map(targets.map((t) => [t.userId, t.monthlyTargetInr]));
  return members.map((member) => ({
    ...member,
    monthlyTargetInr: byId.get(member.id) ?? fallback,
  }));
}
