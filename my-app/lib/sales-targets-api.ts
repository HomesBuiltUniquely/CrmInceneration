import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { normalizeToArray } from "@/lib/api-normalize";
import {
  DEFAULT_INCENTIVE_HALF_TARGET_INR,
  DEFAULT_MONTHLY_SALES_TARGET_INR,
  type SalesTargetUserRow,
} from "@/lib/sales-targets";

type AnyJson = Record<string, unknown>;

export type IncentiveSalesTargetsQuery = {
  yearMonth: string;
  branchId?: string;
  salesManagerId?: string | number;
  salesExecutiveId?: string | number;
};

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

function buildQuery(params: IncentiveSalesTargetsQuery): string {
  const q = new URLSearchParams();
  q.set("yearMonth", params.yearMonth);
  if (params.branchId?.trim()) q.set("branchId", params.branchId.trim());
  if (params.salesManagerId != null && String(params.salesManagerId).trim()) {
    q.set("salesManagerId", String(params.salesManagerId));
  }
  if (params.salesExecutiveId != null && String(params.salesExecutiveId).trim()) {
    q.set("salesExecutiveId", String(params.salesExecutiveId));
  }
  return q.toString();
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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

function mapTargetUser(row: AnyJson): SalesTargetUserRow {
  const userId = pickNumber(row, ["userId", "user_id", "id"]) ?? 0;
  const h1 =
    pickNumber(row, ["h1TargetInr", "h1_target_inr", "h1Target", "h1"]) ??
    DEFAULT_INCENTIVE_HALF_TARGET_INR;
  const h2 =
    pickNumber(row, ["h2TargetInr", "h2_target_inr", "h2Target", "h2"]) ??
    DEFAULT_INCENTIVE_HALF_TARGET_INR;
  const monthlyOverride = pickNumber(row, [
    "monthlyTargetInr",
    "monthly_target_inr",
    "targetInr",
    "target",
    "monthlyTarget",
  ]);
  const hasExplicitHalf =
    row.h1TargetInr != null ||
    row.h2TargetInr != null ||
    row.h1_target_inr != null ||
    row.h2_target_inr != null;
  const isCustom = Boolean(row.isCustom ?? row.custom ?? hasExplicitHalf ?? monthlyOverride != null);
  const monthlyTargetInr = monthlyOverride ?? h1 + h2;
  return {
    userId,
    name: String(row.name ?? row.userName ?? row.fullName ?? `User #${userId}`),
    role: String(row.role ?? "SALES_EXECUTIVE"),
    branch: row.branch != null ? String(row.branch) : undefined,
    managerName: row.managerName != null ? String(row.managerName) : undefined,
    h1TargetInr: h1,
    h2TargetInr: h2,
    monthlyTargetInr,
    isCustom,
  };
}

function extractTargetRows(raw: unknown): AnyJson[] {
  if (Array.isArray(raw)) return raw as AnyJson[];
  if (!raw || typeof raw !== "object") return [];
  const r = raw as AnyJson;
  return normalizeToArray<AnyJson>(r.targets ?? r.users ?? r.items ?? r.data ?? r);
}

export const incentivesSalesTargetsApi = {
  list: async (query: IncentiveSalesTargetsQuery): Promise<SalesTargetUserRow[]> => {
    const raw = await call<unknown>(
      `/api/crm/incentives/sales-targets?${buildQuery(query)}`,
    );
    return extractTargetRows(raw).map(mapTargetUser);
  },
  save: (payload: {
    yearMonth: string;
    targets: Array<{ userId: number; h1TargetInr: number; h2TargetInr: number }>;
  }) =>
    call<unknown>("/api/crm/incentives/sales-targets", {
      method: "PUT",
      body: JSON.stringify({
        yearMonth: payload.yearMonth,
        targets: payload.targets,
      }),
    }),
};

/** @deprecated Hub incentives API — org default is config-only; returns FE constant. */
function monthQuery(month?: string): string {
  return month ? `?month=${encodeURIComponent(month)}` : "";
}

export const salesTargetsApi = {
  getDefault: async (_month?: string) => ({
    defaultTargetInr: DEFAULT_MONTHLY_SALES_TARGET_INR,
  }),
  setDefault: async (defaultTargetInr: number, yearMonth?: string) => {
    if (!yearMonth) {
      throw new Error("Month is required to apply default targets.");
    }
    const half = Math.round(defaultTargetInr / 2);
    const rows = await incentivesSalesTargetsApi.list({ yearMonth });
    const toUpdate = rows.filter((row) => !row.isCustom);
    if (toUpdate.length === 0) {
      throw new Error("No executives without custom targets to update.");
    }
    await incentivesSalesTargetsApi.save({
      yearMonth,
      targets: toUpdate.map((row) => ({
        userId: row.userId,
        h1TargetInr: half,
        h2TargetInr: half,
      })),
    });
    return { defaultTargetInr };
  },
  listUsers: (month?: string, scope?: Omit<IncentiveSalesTargetsQuery, "yearMonth">) => {
    const yearMonth = month ?? new Date().toISOString().slice(0, 7);
    return incentivesSalesTargetsApi.list({ yearMonth, ...scope });
  },
  setUserTarget: (
    userId: number | string,
    monthlyTargetInr: number,
    month?: string,
    halves?: { h1TargetInr: number; h2TargetInr: number },
  ) => {
    const yearMonth = month ?? new Date().toISOString().slice(0, 7);
    const h1 = halves?.h1TargetInr ?? Math.round(monthlyTargetInr / 2);
    const h2 = halves?.h2TargetInr ?? monthlyTargetInr - h1;
    return incentivesSalesTargetsApi.save({
      yearMonth,
      targets: [{ userId: Number(userId), h1TargetInr: h1, h2TargetInr: h2 }],
    });
  },
  setUserHalves: (
    userId: number | string,
    h1TargetInr: number,
    h2TargetInr: number,
    month?: string,
  ) =>
    salesTargetsApi.setUserTarget(Number(userId), h1TargetInr + h2TargetInr, month, {
      h1TargetInr,
      h2TargetInr,
    }),
  bulkUsers: (payload: {
    userIds: number[];
    monthlyTargetInr: number;
    month?: string;
    /** When set, applied to both H1 and H2 instead of splitting monthly. */
    halfTargetInr?: number;
  }) => {
    const yearMonth = payload.month ?? new Date().toISOString().slice(0, 7);
    const perHalf =
      payload.halfTargetInr ?? Math.round(payload.monthlyTargetInr / 2);
    return incentivesSalesTargetsApi.save({
      yearMonth,
      targets: payload.userIds.map((userId) => ({
        userId,
        h1TargetInr: perHalf,
        h2TargetInr: perHalf,
      })),
    });
  },
  /** Legacy path helper — unused; kept so old imports do not break. */
  _legacyPath: (path: string, month?: string) => `${path}${monthQuery(month)}`,
};

/** Map API target rows onto incentive members by user id. */
export function applyMonthlyTargets<T extends { id: number }>(
  members: T[],
  targets: SalesTargetUserRow[],
  fallback = DEFAULT_MONTHLY_SALES_TARGET_INR,
): (T & {
  monthlyTargetInr: number;
  h1TargetInr: number;
  h2TargetInr: number;
})[] {
  const byId = new Map(targets.map((t) => [t.userId, t]));
  return members.map((member) => {
    const row = byId.get(member.id);
    const h1 = row?.h1TargetInr ?? DEFAULT_INCENTIVE_HALF_TARGET_INR;
    const h2 = row?.h2TargetInr ?? DEFAULT_INCENTIVE_HALF_TARGET_INR;
    return {
      ...member,
      h1TargetInr: h1,
      h2TargetInr: h2,
      monthlyTargetInr: row?.monthlyTargetInr ?? h1 + h2,
    };
  });
}
