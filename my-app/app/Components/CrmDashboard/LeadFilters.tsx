"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  getAuthApiBaseUrl,
  normalizeRole,
  unwrapAuthUserPayload,
} from "@/lib/auth/api";

type DashboardRole = "sales_admin" | "sales_manager" | "super_admin";

type HierarchyUser = {
  id: number;
  fullName?: string;
  username?: string;
  role?: string;
  managerId?: number | null;
  active?: boolean;
};

export type DashboardFilterState = {
  assignee: string;
  assignees?: string[];
  milestoneStage: string;
  milestoneStageCategory: string;
  milestoneSubStage: string;
  dateFrom: string;
  dateTo: string;
};

type Props = {
  role?: DashboardRole;
  onFiltersChange?: (filters: DashboardFilterState) => void;
};

function userLabel(u: HierarchyUser): string {
  return (u.fullName ?? u.username ?? `User ${u.id}`).trim();
}

async function fetchUsersByRole(
  role: string,
  token: string,
): Promise<HierarchyUser[]> {
  const header = {
    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
  };
  const rolesToTry = role === "PRESALES_EXECUTIVE" ? ["PRESALES_EXECUTIVE", "PRE_SALES"] : [role];
  const merged: HierarchyUser[] = [];
  for (const r of rolesToTry) {
    const res = await fetch(
      `${getAuthApiBaseUrl()}/api/auth/users-by-role?role=${encodeURIComponent(r)}`,
      {
        cache: "no-store",
        headers: header,
      },
    );
    if (!res.ok) continue;
    const data = (await res.json()) as HierarchyUser[];
    if (Array.isArray(data)) merged.push(...data);
  }
  return Array.from(new Map(merged.map((u) => [u.id, u])).values());
}

function FilterIcon() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--crm-tab-grad)] shadow-[var(--crm-shadow-sm)] ring-1 ring-[var(--crm-accent-ring)]">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4text-[var(--crm-text-muted)]"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 6h16M7 12h10M10 18h4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function SelectChevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="pointer-events-none h-4 w-4 text-[var(--crm-text-muted)]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.5 7.5a1 1 0 0 1 1.4 0L10 10.6l3.1-3.1a1 1 0 1 1 1.4 1.4l-3.8 3.8a1 1 0 0 1-1.4 0L5.5 8.9a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

const selectClass =
  "h-10 w-full cursor-pointer appearance-none rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 pr-9 text-sm font-semibold text-[var(--crm-text-secondary)] shadow-[var(--crm-shadow-sm)] outline-none transition-all duration-200 hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface-subtle)] focus:border-[var(--crm-accent)] focus:ring-4 focus:ring-[var(--crm-accent-ring)]";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-muted)]";

const QUICK_RANGES = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "q", label: "This Quarter" },
] as const;


function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeQuickRangeDates(
  rangeId: (typeof QUICK_RANGES)[number]["id"],
): { from: string; to: string } {
  const today = new Date();
  const end = formatDate(today);
  if (rangeId === "7d" || rangeId === "30d") {
    const days = rangeId === "7d" ? 7 : 30;
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    return { from: formatDate(from), to: end };
  }
  const month = today.getMonth();
  const quarterStartMonth = month - (month % 3);
  const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1);
  return { from: formatDate(quarterStart), to: end };
}

export default function LeadFilters({
  role = "sales_admin",
  onFiltersChange,
}: Props) {
  const isManager = role === "sales_manager";
  const [viewerRole, setViewerRole] = useState("");
  const isSalesAdmin =
    viewerRole === "SALES_ADMIN" ||
    (viewerRole === "" && role === "sales_admin");
  const [quickRange, setQuickRange] =
    useState<(typeof QUICK_RANGES)[number]["id"] | "">("");

  const [salesAdmins, setSalesAdmins] = useState<HierarchyUser[]>([]);
  const [salesManagers, setSalesManagers] = useState<HierarchyUser[]>([]);
  const [salesExecs, setSalesExecs] = useState<HierarchyUser[]>([]);
  const [presalesManagers, setPresalesManagers] = useState<HierarchyUser[]>([]);
  const [presalesExecs, setPresalesExecs] = useState<HierarchyUser[]>([]);

  const [salesAdminId, setSalesAdminId] = useState("");
  const [salesManagerId, setSalesManagerId] = useState("");
  const [salesExecId, setSalesExecId] = useState("");
  const [presalesManagerId, setPresalesManagerId] = useState("");
  const [presalesExecId, setPresalesExecId] = useState("");
  const [stage, setStage] = useState("");
  const [stageCategory, setStageCategory] = useState("");
  const [substage, setSubstage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewerMe, setViewerMe] = useState<HierarchyUser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedRole = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    setViewerRole(normalizeRole(storedRole));
  }, []);

  /** Sales Manager dashboard: scope pipeline metrics to self + direct reports (matches backend JWT). */
  useEffect(() => {
    if (role !== "sales_manager") return;
    if (!viewerMe?.id) return;
    setSalesManagerId(String(viewerMe.id));
  }, [role, viewerMe]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY) ?? "";
        const meRes = token
          ? await fetch(`${getAuthApiBaseUrl()}/api/auth/me`, {
              cache: "no-store",
              headers: {
                Authorization: token.startsWith("Bearer ")
                  ? token
                  : `Bearer ${token}`,
              },
            })
          : null;
        const meData = meRes && meRes.ok ? ((await meRes.json()) as Record<string, unknown>) : {};
        const meRecord = unwrapAuthUserPayload(
          typeof meData === "object" && meData !== null ? meData : {},
        );
        const me =
          Number(meRecord.id ?? 0) > 0 ? (meRecord as HierarchyUser) : undefined;
        setViewerMe(me ?? null);

        const [sa, sm, se, pm, pe] = await Promise.all([
          token ? fetchUsersByRole("SALES_ADMIN", token) : Promise.resolve([]),
          token
            ? fetchUsersByRole("SALES_MANAGER", token)
            : Promise.resolve([]),
          token
            ? fetchUsersByRole("SALES_EXECUTIVE", token)
            : Promise.resolve([]),
          token
            ? fetchUsersByRole("PRESALES_MANAGER", token)
            : Promise.resolve([]),
          token
            ? fetchUsersByRole("PRESALES_EXECUTIVE", token)
            : Promise.resolve([]),
        ]);
        if (cancelled) return;

        setSalesAdmins(
          [
            ...sa.filter((u) => u.active !== false),
            ...(me && me.role === "SALES_ADMIN" ? [me] : []),
          ].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i),
        );
        setSalesManagers(sm.filter((u) => u.active !== false));
        setSalesExecs(se.filter((u) => u.active !== false));
        setPresalesManagers(pm.filter((u) => u.active !== false));
        setPresalesExecs(pe.filter((u) => u.active !== false));
      } catch {
        if (!cancelled) {
          setSalesAdmins([]);
          setSalesManagers([]);
          setSalesExecs([]);
          setPresalesManagers([]);
          setPresalesExecs([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleSalesManagers = useMemo(
    () =>
      salesAdminId
        ? salesManagers.filter(
            (u) => String(u.managerId ?? "") === salesAdminId,
          )
        : salesManagers,
    [salesAdminId, salesManagers],
  );
  const visibleSalesExecs = useMemo(
    () =>
      salesManagerId
        ? salesExecs.filter((u) => String(u.managerId ?? "") === salesManagerId)
        : salesExecs,
    [salesExecs, salesManagerId],
  );
  const visiblePresalesExecs = useMemo(
    () =>
      presalesManagerId
        ? presalesExecs.filter(
            (u) => String(u.managerId ?? "") === presalesManagerId,
          )
        : presalesExecs,
    [presalesExecs, presalesManagerId],
  );

  const adminTeamExecAssignees = useMemo(() => {
    if (!salesAdminId) return [];
    const managerIds = new Set(visibleSalesManagers.map((u) => String(u.id)));
    return salesExecs
      .filter((u) => managerIds.has(String(u.managerId ?? "")))
      .map((u) => userLabel(u))
      .filter(Boolean);
  }, [salesAdminId, salesExecs, visibleSalesManagers]);

  const effectiveFilters = useMemo(() => {
    const selectedSalesExecName = (
      visibleSalesExecs.find((u) => String(u.id) === salesExecId)?.fullName ??
      visibleSalesExecs.find((u) => String(u.id) === salesExecId)?.username ??
      ""
    ).trim();
    if (selectedSalesExecName)
      return { assignee: selectedSalesExecName, assignees: [] as string[] };

    const selectedPresalesExecName = (
      visiblePresalesExecs.find((u) => String(u.id) === presalesExecId)
        ?.fullName ??
      visiblePresalesExecs.find((u) => String(u.id) === presalesExecId)
        ?.username ??
      ""
    ).trim();
    if (selectedPresalesExecName)
      return { assignee: selectedPresalesExecName, assignees: [] as string[] };

    if (salesManagerId) {
      const mgr = salesManagers.find((u) => String(u.id) === salesManagerId);
      const mgrLabel = mgr ? userLabel(mgr) : "";
      const teamExecNames = [
        ...new Set(visibleSalesExecs.map((u) => userLabel(u)).filter(Boolean)),
      ];
      const assignees = [...new Set([mgrLabel, ...teamExecNames].filter(Boolean))];
      return { assignee: "", assignees };
    }
    if (presalesManagerId) {
      const teamAssignees = [
        ...new Set(
          visiblePresalesExecs.map((u) => userLabel(u)).filter(Boolean),
        ),
      ];
      return { assignee: "", assignees: teamAssignees };
    }
    if (salesAdminId) {
      const teamAssignees = [...new Set(adminTeamExecAssignees)];
      return { assignee: "", assignees: teamAssignees };
    }
    return { assignee: "", assignees: [] as string[] };
  }, [
    adminTeamExecAssignees,
    presalesExecId,
    presalesManagerId,
    salesAdminId,
    salesExecId,
    salesManagerId,
    salesManagers,
    visiblePresalesExecs,
    visibleSalesExecs,
  ]);

  useEffect(() => {
    if (!quickRange) return;
    const { from, to } = computeQuickRangeDates(quickRange);
    setDateFrom(from);
    setDateTo(to);
  }, [quickRange]);

  useEffect(() => {
    onFiltersChange?.({
      assignee: effectiveFilters.assignee,
      assignees: effectiveFilters.assignees,
      milestoneStage: stage.trim(),
      milestoneStageCategory: stageCategory.trim(),
      milestoneSubStage: substage.trim(),
      dateFrom,
      dateTo,
    });
  }, [
    dateFrom,
    dateTo,
    effectiveFilters,
    onFiltersChange,
    stage,
    stageCategory,
    substage,
  ]);

  const resetAll = () => {
    setSalesAdminId("");
    setSalesManagerId("");
    setSalesExecId("");
    setPresalesManagerId("");
    setPresalesExecId("");
    setStage("");
    setStageCategory("");
    setSubstage("");
    setDateFrom("");
    setDateTo("");
    setQuickRange("");
  };

  return (
    <main>
      <div className="xl:mx-6 xl:mt-7 xl:w-[calc(100%-3rem)] xl:min-w-0 xl:overflow-hidden xl:rounded-2xl xl:border xl:border-[var(--crm-border)] xl:bg-[var(--crm-surface)] xl:shadow-[var(--crm-shadow-sm)]">
        <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FilterIcon />
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-[var(--crm-text-primary)]">
                  Pipeline filters
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--crm-text-muted)]">
                  Refine your view — updates apply as you change
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-4 py-2 text-xs font-semibold text-[var(--crm-text-secondary)] shadow-[var(--crm-shadow-sm)] transition hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface-subtle)] hover:text-[var(--crm-text-primary)] active:scale-[0.98]"
            >
              Reset all
            </button>
          </div>
        </div>

        <div className="px-6 pb-5 pt-5">
          <div
            className={`grid gap-x-4 gap-y-4 ${isManager ? "grid-cols-5" : "grid-cols-5"}`}
          >
            {isManager ? (
              <>
                <label className="col-span-1 min-w-0">
                  <span className={labelClass}>Sales Exec</span>
                  <div className="relative">
                    <select
                      value={salesExecId}
                      onChange={(e) => setSalesExecId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">All</option>
                      {visibleSalesExecs.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <SelectChevron />
                    </div>
                  </div>
                </label>
              </>
            ) : (
              <>
                {!isSalesAdmin ? (
                  <label className="col-span-1 min-w-0">
                    <span className={labelClass}>Sales Admin</span>
                    <div className="relative">
                      <select
                        value={salesAdminId}
                        onChange={(e) => {
                          setSalesAdminId(e.target.value);
                          setSalesManagerId("");
                          setSalesExecId("");
                        }}
                        className={selectClass}
                      >
                        <option value="">All</option>
                        {salesAdmins.map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {userLabel(u)}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <SelectChevron />
                      </div>
                    </div>
                  </label>
                ) : null}
                <label className="col-span-1 min-w-0">
                  <span className={labelClass}>Sales Mgr</span>
                  <div className="relative">
                    <select
                      value={salesManagerId}
                      onChange={(e) => {
                        setSalesManagerId(e.target.value);
                        setSalesExecId("");
                      }}
                      className={selectClass}
                    >
                      <option value="">All</option>
                      {visibleSalesManagers.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <SelectChevron />
                    </div>
                  </div>
                </label>
                <label className="col-span-1 min-w-0">
                  <span className={labelClass}>Sales Exec</span>
                  <div className="relative">
                    <select
                      value={salesExecId}
                      onChange={(e) => setSalesExecId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">All</option>
                      {visibleSalesExecs.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <SelectChevron />
                    </div>
                  </div>
                </label>
                <label className="col-span-1 min-w-0">
                  <span className={labelClass}>Presales Mgr</span>
                  <div className="relative">
                    <select
                      value={presalesManagerId}
                      onChange={(e) => {
                        setPresalesManagerId(e.target.value);
                        setPresalesExecId("");
                      }}
                      className={selectClass}
                    >
                      <option value="">All</option>
                      {presalesManagers.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <SelectChevron />
                    </div>
                  </div>
                </label>
                <label className="col-span-1 min-w-0">
                  <span className={labelClass}>Presales Exec</span>
                  <div className="relative">
                    <select
                      value={presalesExecId}
                      onChange={(e) => setPresalesExecId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">All</option>
                      {visiblePresalesExecs.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <SelectChevron />
                    </div>
                  </div>
                </label>
              </>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--crm-border)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--crm-text-muted)]">
                  Quick range
                </span>
                <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-1 shadow-inner">
                  {QUICK_RANGES.map((q) => {
                    const active = quickRange === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setQuickRange(q.id)}
                        className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200 ${active ? "bg-[var(--crm-surface)] text-[var(--crm-accent)] shadow-sm ring-1 ring-[var(--crm-accent-ring)]" : "text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface)] hover:text-[var(--crm-text-primary)]"}`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] font-medium italic text-[var(--crm-text-muted)]">
                Selections apply automatically
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
