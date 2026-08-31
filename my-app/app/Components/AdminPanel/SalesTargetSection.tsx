"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminPanelApi } from "@/lib/admin-panel-api";
import { mergeUserRowsById, pickNumber } from "@/lib/api-normalize";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { salesTargetsApi } from "@/lib/sales-targets-api";
import {
  currentSalesTargetMonth,
  DEFAULT_INCENTIVE_HALF_TARGET_INR,
  DEFAULT_MONTHLY_SALES_TARGET_INR,
  formatSalesTargetMonthLabel,
  formatTargetInr,
  formatTargetLakhs,
  monthSelectOptions,
  parseTargetInrInput,
  type SalesTargetUserRow,
} from "@/lib/sales-targets";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";

function mapExecRow(row: Record<string, unknown>, index: number): SalesTargetUserRow {
  const userId =
    pickNumber(row, ["userId", "user_id", "id"]) ??
    pickNumber(row, ["salesExecutiveId", "sales_executive_id"]) ??
    index + 1;
  return {
    userId,
    name: String(row.name ?? row.userName ?? row.fullName ?? `Executive #${userId}`),
    role: String(row.role ?? "SALES_EXECUTIVE"),
    branch: row.branch != null ? String(row.branch) : undefined,
    managerName:
      row.managerName != null
        ? String(row.managerName)
        : row.salesManagerName != null
          ? String(row.salesManagerName)
          : undefined,
    monthlyTargetInr: DEFAULT_MONTHLY_SALES_TARGET_INR,
    h1TargetInr: DEFAULT_INCENTIVE_HALF_TARGET_INR,
    h2TargetInr: DEFAULT_INCENTIVE_HALF_TARGET_INR,
    isCustom: false,
  };
}

function mergeExecWithTargets(
  execs: SalesTargetUserRow[],
  targets: SalesTargetUserRow[],
  defaultTarget: number,
): SalesTargetUserRow[] {
  const byId = new Map(targets.map((t) => [t.userId, t]));
  return execs.map((exec) => {
    const fromApi = byId.get(exec.userId);
    if (!fromApi) {
      return {
        ...exec,
        monthlyTargetInr: defaultTarget,
        h1TargetInr: DEFAULT_INCENTIVE_HALF_TARGET_INR,
        h2TargetInr: DEFAULT_INCENTIVE_HALF_TARGET_INR,
        isCustom: false,
      };
    }
    return {
      ...exec,
      monthlyTargetInr: fromApi.monthlyTargetInr,
      h1TargetInr: fromApi.h1TargetInr,
      h2TargetInr: fromApi.h2TargetInr,
      isCustom: fromApi.isCustom,
    };
  });
}

export default function SalesTargetSection() {
  const { notifySuccess, notifyError } = useGlobalNotifier();
  const [viewerRole, setViewerRole] = useState("");
  const [month, setMonth] = useState(currentSalesTargetMonth());
  const [defaultTarget, setDefaultTarget] = useState(String(DEFAULT_MONTHLY_SALES_TARGET_INR));
  const [executives, setExecutives] = useState<SalesTargetUserRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTarget, setBulkTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState<SalesTargetUserRow | null>(null);
  const [editH1, setEditH1] = useState("");
  const [editH2, setEditH2] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setViewerRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""));
  }, []);

  const canManage = viewerRole === "SUPER_ADMIN" || viewerRole === "SALES_ADMIN";
  const monthOptions = useMemo(() => monthSelectOptions(12), []);

  const loadTargets = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const [legacyExecs, roleExecs, targetRows, defaultRes] = await Promise.all([
        adminPanelApi.listSalesExecutivesLegacyAll().catch(() => [] as Record<string, unknown>[]),
        adminPanelApi.listUsersByRole("SALES_EXECUTIVE").catch(() => [] as Record<string, unknown>[]),
        salesTargetsApi.listUsers(month).catch(() => [] as SalesTargetUserRow[]),
        salesTargetsApi.getDefault(month).catch(() => ({})),
      ]);

      const mergedExecRows = mergeUserRowsById(
        legacyExecs as Record<string, unknown>[],
        roleExecs as Record<string, unknown>[],
      );
      const execList = mergedExecRows.map((row, i) => mapExecRow(row, i));

      const defaultInr =
        pickNumber(defaultRes as Record<string, unknown>, [
          "defaultTargetInr",
          "defaultTarget",
          "targetInr",
          "value",
        ]) ?? DEFAULT_MONTHLY_SALES_TARGET_INR;

      setDefaultTarget(String(defaultInr));
      setExecutives(mergeExecWithTargets(execList, targetRows, defaultInr));
      setSelectedIds([]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load sales targets.");
      setExecutives([]);
    } finally {
      setLoading(false);
    }
  }, [canManage, month, notifyError]);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  const toggleSelect = (userId: number) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === executives.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(executives.map((e) => e.userId));
    }
  };

  const saveDefault = async () => {
    const parsed = parseTargetInrInput(defaultTarget);
    if (parsed == null) {
      notifyError("Enter a valid default target amount.");
      return;
    }
    try {
      await salesTargetsApi.setDefault(parsed, month);
      notifySuccess(`Default target updated for ${formatSalesTargetMonthLabel(month)}.`);
      await loadTargets();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to update default target.");
    }
  };

  const openEdit = (user: SalesTargetUserRow) => {
    setEditUser(user);
    setEditH1(String(user.h1TargetInr));
    setEditH2(String(user.h2TargetInr));
  };

  const saveEdit = async () => {
    if (!editUser) return;
    const h1 = parseTargetInrInput(editH1);
    const h2 = parseTargetInrInput(editH2);
    if (h1 == null || h2 == null) {
      notifyError("Enter valid H1 and H2 target amounts.");
      return;
    }
    try {
      await salesTargetsApi.setUserHalves(editUser.userId, h1, h2, month);
      notifySuccess(`Target set for ${editUser.name}.`);
      setEditUser(null);
      await loadTargets();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save target.");
    }
  };

  const saveBulk = async () => {
    const parsed = parseTargetInrInput(bulkTarget);
    if (parsed == null) {
      notifyError("Enter a valid target for selected executives.");
      return;
    }
    if (selectedIds.length === 0) return;
    try {
      await salesTargetsApi.bulkUsers({ userIds: selectedIds, monthlyTargetInr: parsed, month });
      notifySuccess(`Target updated for ${selectedIds.length} executive(s).`);
      setBulkTarget("");
      setSelectedIds([]);
      await loadTargets();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to bulk update targets.");
    }
  };

  if (!canManage) {
    return (
      <section className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--crm-text-primary)]">Revenue Targets</h2>
        <p className="mt-2 text-sm text-[var(--crm-text-muted)]">
          Monthly sales executive targets can be managed by Sales Admin and Super Admin only.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--crm-text-primary)]">Revenue Targets</h2>
          <p className="mt-1 text-sm text-[var(--crm-text-muted)]">
            Set each sales executive&apos;s monthly target as H1 (1–15) + H2 (16–end).
            Syncs with Incentives and Insights revenue forecast.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--crm-text-muted)]">
            Month
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-2 text-sm text-[var(--crm-text-primary)]"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadTargets()}
            className="rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm font-semibold text-[var(--crm-text-primary)] hover:bg-[var(--crm-surface-subtle)]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--crm-tab-grad)] px-5 py-4 text-white">
        <div>
          <p className="text-sm text-white/80">Default monthly target (applied as equal H1 + H2)</p>
          <p className="mt-1 text-sm font-semibold">
            Current: <strong>{formatTargetLakhs(Number(defaultTarget) || DEFAULT_MONTHLY_SALES_TARGET_INR)}</strong>
            {" · "}
            {formatSalesTargetMonthLabel(month)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={defaultTarget}
            onChange={(e) => setDefaultTarget(e.target.value)}
            placeholder="6000000"
            className="w-36 rounded-lg border-0 px-3 py-2 text-center text-sm font-bold text-[var(--crm-text-primary)]"
          />
          <button
            type="button"
            onClick={() => void saveDefault()}
            className="rounded-lg bg-[var(--crm-success)] px-4 py-2 text-sm font-bold text-white"
          >
            Update Default
          </button>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="text-sm font-semibold text-amber-900">
            {selectedIds.length} executive{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
              placeholder="Monthly target (INR)"
              className="min-w-[160px] rounded-lg border border-amber-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void saveBulk()}
              className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold uppercase text-white"
            >
              Apply to selected
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setBulkTarget("");
              }}
              className="rounded-lg border border-amber-400 px-3 py-2 text-xs font-bold uppercase text-amber-900"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-[var(--crm-text-muted)]">
          {loading ? "Loading…" : `${executives.length} sales executives`}
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--crm-text-primary)]">
          <input
            type="checkbox"
            checked={executives.length > 0 && selectedIds.length === executives.length}
            onChange={toggleSelectAll}
          />
          Select all
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--crm-border)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]">
            <tr>
              <th className="w-10 px-3 py-3" />
              <th className="px-3 py-3 text-left text-xs font-bold uppercase text-[var(--crm-text-muted)]">
                Executive
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase text-[var(--crm-text-muted)]">
                Manager
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase text-[var(--crm-text-muted)]">
                H1 / H2 target
              </th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase text-[var(--crm-text-muted)]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {executives.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--crm-text-muted)]">
                  No sales executives found.
                </td>
              </tr>
            ) : (
              executives.map((exec) => (
                <tr key={exec.userId} className="border-b border-[var(--crm-border)] last:border-0">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(exec.userId)}
                      onChange={() => toggleSelect(exec.userId)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-[var(--crm-text-primary)]">{exec.name}</div>
                    {exec.branch ? (
                      <div className="text-xs text-[var(--crm-text-muted)]">{exec.branch}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-[var(--crm-text-muted)]">{exec.managerName ?? "—"}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold tabular-nums text-[var(--crm-text-primary)]">
                      {formatTargetInr(exec.monthlyTargetInr)}
                    </div>
                    <div className="text-xs text-[var(--crm-text-muted)]">
                      H1 {formatTargetLakhs(exec.h1TargetInr)} · H2{" "}
                      {formatTargetLakhs(exec.h2TargetInr)}
                      {exec.isCustom ? " · Custom" : " · Default"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(exec)}
                      className="rounded-lg border border-[var(--crm-border)] px-3 py-1.5 text-xs font-bold uppercase text-[var(--crm-accent)] hover:bg-[var(--crm-accent-soft)]"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--crm-text-primary)]">Edit incentive targets</h3>
            <p className="mt-1 text-sm text-[var(--crm-text-muted)]">
              {editUser.name} · {formatSalesTargetMonthLabel(month)}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase text-[var(--crm-text-muted)]">
                  H1 — 1st to 15th (INR)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editH1}
                  onChange={(e) => setEditH1(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
                  placeholder="3000000"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[var(--crm-text-muted)]">
                  H2 — 16th to end (INR)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editH2}
                  onChange={(e) => setEditH2(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
                  placeholder="3000000"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[var(--crm-text-muted)]">
              Monthly total = H1 + H2. Default is {formatTargetLakhs(DEFAULT_INCENTIVE_HALF_TARGET_INR)} per half.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="rounded-lg bg-[var(--crm-accent)] px-4 py-2 text-sm font-bold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
