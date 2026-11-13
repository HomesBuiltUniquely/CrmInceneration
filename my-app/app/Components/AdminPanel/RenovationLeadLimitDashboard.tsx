"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { extractLeadLimitUsers, leadLimitsApi } from "@/lib/lead-limits-api";
import { pickNumber } from "@/lib/api-normalize";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { isUserActive } from "@/lib/user-active";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";

const C = {
  card: "var(--crm-surface)",
  surface: "var(--crm-surface-subtle)",
  accent: "var(--crm-accent)",
  danger: "var(--crm-danger)",
  border: "var(--crm-border)",
  text: "var(--crm-text-primary)",
  muted: "var(--crm-text-muted)",
  warningText: "var(--crm-warning-text)",
  overlay: "var(--crm-overlay)",
  white: "#fff",
};

type RoleFilter =
  | "all"
  | "SALES_EXECUTIVE"
  | "SALES_MANAGER"
  | "PRESALES_EXECUTIVE"
  | "PRESALES_MANAGER";

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "SALES_EXECUTIVE", label: "Sales Exec" },
  { id: "SALES_MANAGER", label: "Sales Mgr" },
  { id: "PRESALES_EXECUTIVE", label: "Presales Exec" },
  { id: "PRESALES_MANAGER", label: "Presales Mgr" },
];

const VIEWPORT_ROWS = 7;
const VIEWPORT_PX = 36 + VIEWPORT_ROWS * 44;

const COLOR_LEGEND = [
  { color: "rgba(234, 179, 8, 0.55)", label: "Inactive" },
  { color: "rgba(148, 163, 184, 0.55)", label: "Not in pool" },
  { color: "rgba(185, 28, 28, 0.55)", label: "At capacity" },
  { color: "rgba(22, 163, 74, 0.55)", label: "Usage > 80%" },
] as const;

interface UserLimit {
  userId: number;
  name: string;
  role: string;
  branch: string;
  active: boolean;
  inRenovationPool: boolean;
  poolStatus: string;
  salesRenovationThisMonth: number;
  presalesRenovationThisMonth: number;
  /** Total used for limit / % (sales + presales). */
  current: number;
  limit: number;
  remaining: number;
  pct: number;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "in_pool") return true;
    if (v === "false" || v === "0" || v === "no" || v === "not_in_pool") return false;
  }
  return fallback;
}

function normalizedUserRole(u: Record<string, unknown>): string {
  const candidate = u.role ?? u.userRole ?? u.authority ?? u.type ?? "";
  return normalizeRole(String(candidate));
}

function mapLimitUser(u: Record<string, unknown>, idx: number, fallbackLimit: number): UserLimit {
  const userId = Number(u.userId ?? u.id ?? idx);
  const limit =
    pickNumber(u, ["renovationLimit", "limit", "monthlyLimit"]) ?? fallbackLimit;
  const salesRenovationThisMonth =
    pickNumber(u, ["salesRenovationThisMonth", "salesRenovationCount"]) ?? 0;
  const presalesRenovationThisMonth =
    pickNumber(u, ["presalesRenovationThisMonth", "presalesRenovationCount"]) ?? 0;
  const current =
    pickNumber(u, [
      "renovationAssignedThisMonth",
      "current",
      "used",
      "currentCount",
    ]) ??
    salesRenovationThisMonth + presalesRenovationThisMonth;
  const inRenovationPool = asBool(
    u.inRenovationPool ?? u.poolStatus,
    limit > 0,
  );
  const remaining = inRenovationPool
    ? pickNumber(u, ["renovationRemaining", "remaining", "remainingLeads"]) ??
      Math.max(0, limit - current)
    : 0;
  const pctRaw = pickNumber(u, [
    "renovationUsagePercent",
    "usagePercent",
    "percentageUsed",
    "pct",
  ]);
  const pct =
    pctRaw != null
      ? Math.round(pctRaw * 10) / 10
      : inRenovationPool && limit > 0
        ? Math.round((current / limit) * 1000) / 10
        : 0;
  return {
    userId,
    name: String(u.fullName ?? u.name ?? u.username ?? `User ${userId}`),
    role: normalizedUserRole(u),
    branch: String(u.branch ?? ""),
    active: isUserActive(u as { active?: boolean; isActive?: boolean }),
    inRenovationPool,
    poolStatus: String(u.poolStatus ?? (inRenovationPool ? "IN_POOL" : "NOT_IN_POOL")),
    salesRenovationThisMonth,
    presalesRenovationThisMonth,
    current,
    limit,
    remaining,
    pct,
  };
}

function rowBackground(u: UserLimit): string {
  if (!u.active) return "rgba(234, 179, 8, 0.32)";
  if (!u.inRenovationPool || u.limit === 0) return "rgba(148, 163, 184, 0.22)";
  if (u.remaining === 0) return "rgba(185, 28, 28, 0.22)";
  if (u.pct > 80) return "rgba(22, 163, 74, 0.38)";
  return C.card;
}

const th: CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: C.muted,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  background: C.surface,
  borderBottom: `1px solid ${C.border}`,
  position: "sticky",
  top: 0,
  zIndex: 1,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "11px 10px",
  fontSize: 13,
  color: C.text,
  borderBottom: `1px solid ${C.border}`,
  verticalAlign: "middle",
};

function RoleFilterMenu({
  value,
  onChange,
}: {
  value: RoleFilter;
  onChange: (next: RoleFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = ROLE_FILTERS.find((o) => o.id === value) ?? ROLE_FILTERS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: Event) => {
      if ((e as KeyboardEvent).key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        title={`Role: ${current.label}`}
        aria-label="Filter by role"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 10px",
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: open ? C.surface : C.card,
          color: C.text,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          transition: "background 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M7 12h10M10 17h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span
          style={{
            maxWidth: 92,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {current.label}
        </span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke={C.muted}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 40,
            minWidth: 168,
            padding: 4,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.card,
            boxShadow: "0 10px 28px rgba(15,23,42,0.14)",
            animation: "leadLimitFadeSlide 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          {ROLE_FILTERS.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  color: active ? C.accent : C.text,
                  background: active ? C.surface : "transparent",
                  transition: "background 0.15s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function RenovationLeadLimitDashboard() {
  const { notifySuccess, notifyError } = useGlobalNotifier();
  const [viewerRole, setViewerRole] = useState("");
  const loadGen = useRef(0);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setViewerRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""));
  }, []);

  const canManageLeadLimits = viewerRole === "SUPER_ADMIN" || viewerRole === "SALES_ADMIN";

  const [defaultLimit, setDefaultLimit] = useState("20");
  const [users, setUsers] = useState<UserLimit[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [showModal, setShowModal] = useState(false);
  const [currentEditingUser, setCurrentEditingUser] = useState<UserLimit | null>(null);
  const [currentEditingLimit, setCurrentEditingLimit] = useState("");

  const sortedUsers = useMemo(() => {
    const filtered =
      roleFilter === "all" ? users : users.filter((u) => u.role === roleFilter);
    return [...filtered].sort((a, b) => {
      const byCurrent = b.current - a.current;
      if (byCurrent !== 0) return byCurrent;
      const byPct = b.pct - a.pct;
      if (byPct !== 0) return byPct;
      return a.name.localeCompare(b.name);
    });
  }, [users, roleFilter]);

  const loadLimits = (opts?: { force?: boolean }) => {
    if (!canManageLeadLimits) return;
    const gen = ++loadGen.current;
    setLimitsLoading(true);
    setLimitsError(null);

    void leadLimitsApi
      .getRenovationLimits({ force: opts?.force })
      .then((apiResult) => {
        if (gen !== loadGen.current) return;
        const apiData = (apiResult ?? {}) as Record<string, unknown>;
        const rawUsers = extractLeadLimitUsers(apiData);
        const d = pickNumber(apiData, [
          "defaultRenovationLimit",
          "defaultLimit",
          "limit",
          "value",
          "default",
        ]);
        const finalDefault = d !== undefined ? d : 20;
        if (d !== undefined) setDefaultLimit(String(d));
        setUsers(rawUsers.map((r, i) => mapLimitUser(r, i, finalDefault)));
        setLimitsError(null);
      })
      .catch((e: unknown) => {
        if (gen !== loadGen.current) return;
        setUsers([]);
        setLimitsError(e instanceof Error ? e.message : "Failed to load renovation limits");
      })
      .finally(() => {
        if (gen !== loadGen.current) return;
        setLimitsLoading(false);
      });
  };

  useEffect(() => {
    if (!canManageLeadLimits) return;
    loadLimits();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on role gate only
  }, [canManageLeadLimits]);

  if (!canManageLeadLimits) {
    return (
      <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
        Lead limit management is available only for Sales Admin and Super Admin.
      </p>
    );
  }

  const openEdit = (u: UserLimit) => {
    setCurrentEditingUser(u);
    setCurrentEditingLimit(String(u.limit) || "");
    setShowModal(true);
  };

  return (
    <div>
      {/* Slim default renovation limit */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: C.muted,
            }}
          >
            Default renovation limit
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: C.text }}>
            {defaultLimit} leads / month for new users
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted, lineHeight: 1.45, maxWidth: 520 }}>
            Limit <strong>0</strong> = not in renovation pool (no auto assigns). To send all
            renovations to one person: set default/others to 0, then set that user&apos;s limit
            &gt; 0.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            value={defaultLimit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDefaultLimit(e.target.value)}
            aria-label="Default renovation monthly limit"
            style={{
              width: 72,
              height: 32,
              padding: "0 10px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
              outline: "none",
              background: C.card,
              color: C.text,
              fontVariantNumeric: "tabular-nums",
            }}
          />
          <button
            type="button"
            onClick={() => {
              const n = Number(defaultLimit);
              if (Number.isNaN(n)) return;
              void leadLimitsApi
                .setRenovationDefault(n)
                .then(() => {
                  loadLimits({ force: true });
                  notifySuccess(
                    n > 0
                      ? `Default renovation limit set to ${n} (new users enter the pool).`
                      : "Default renovation limit set to 0 (new users stay out of the pool).",
                  );
                })
                .catch((e) =>
                  notifyError(e instanceof Error ? e.message : "Failed to update default limit."),
                );
            }}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              background: C.accent,
              color: C.white,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            {limitsLoading ? "Loading…" : `${sortedUsers.length} users · top movers first`}
            {roleFilter !== "all" ? (
              <span style={{ marginLeft: 6 }}>
                · {ROLE_FILTERS.find((o) => o.id === roleFilter)?.label}
              </span>
            ) : null}
            {limitsError ? (
              <span style={{ marginLeft: 8, color: C.danger }}>{limitsError}</span>
            ) : null}
          </span>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              fontSize: 11,
              color: C.muted,
            }}
            aria-label="Row color meaning"
          >
            {COLOR_LEGEND.map((item) => (
              <span
                key={item.label}
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: item.color,
                    border: `1px solid ${C.border}`,
                    flexShrink: 0,
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RoleFilterMenu
            value={roleFilter}
            onChange={(next) => {
              setRoleFilter(next);
              setListKey((k) => k + 1);
            }}
          />
          <button
            type="button"
            onClick={() => loadLimits({ force: true })}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              background: C.accent,
              color: C.white,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div
        key={listKey}
        style={{
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.card,
          overflow: "hidden",
          animation: "leadLimitFadeSlide 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div style={{ maxHeight: VIEWPORT_PX, overflowY: "auto", overflowX: "auto" }}>
          {limitsLoading && sortedUsers.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>
              Loading renovation limits…
            </div>
          ) : sortedUsers.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>
              {limitsError
                ? `Could not load users: ${limitsError}`
                : "No users found for renovation limit."}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 920,
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...th, paddingLeft: 12 }}>Pool</th>
                  <th style={th}>Name</th>
                  <th style={th}>Role</th>
                  <th style={{ ...th, textAlign: "right" }}>Sales Reno</th>
                  <th style={{ ...th, textAlign: "right" }}>Presales Reno</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                  <th style={{ ...th, textAlign: "right" }}>Limit</th>
                  <th style={{ ...th, textAlign: "right" }}>Left</th>
                  <th style={{ ...th, minWidth: 100 }}>Usage</th>
                  <th style={{ ...th, paddingRight: 14 }}> </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u, i) => {
                  const last = i === sortedUsers.length - 1;
                  const border = last ? "none" : td.borderBottom;
                  return (
                    <tr
                      key={u.userId}
                      title={
                        !u.active
                          ? "Inactive"
                          : !u.inRenovationPool
                            ? "Not in renovation pool (limit 0)"
                            : u.remaining === 0
                              ? "At capacity this month"
                              : u.pct > 80
                                ? `Usage ${u.pct}%`
                                : undefined
                      }
                      style={{
                        background: rowBackground(u),
                        opacity: limitsLoading ? 0.75 : 1,
                        transition: "background 0.2s ease, opacity 0.2s ease",
                      }}
                    >
                      <td style={{ ...td, paddingLeft: 12, borderBottom: border }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: 999,
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                            whiteSpace: "nowrap",
                            color: u.inRenovationPool ? "#166534" : "#475569",
                            background: u.inRenovationPool
                              ? "rgba(22, 163, 74, 0.14)"
                              : "rgba(100, 116, 139, 0.14)",
                            border: `1px solid ${
                              u.inRenovationPool
                                ? "rgba(22, 163, 74, 0.28)"
                                : "rgba(100, 116, 139, 0.28)"
                            }`,
                          }}
                        >
                          {u.inRenovationPool ? "In pool" : "Not in pool"}
                        </span>
                      </td>
                      <td style={{ ...td, fontWeight: 600, borderBottom: border }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 140,
                            }}
                          >
                            {u.name}
                          </span>
                          {!u.active ? (
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: 10,
                                fontWeight: 600,
                                color: C.warningText,
                              }}
                            >
                              Inactive
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td style={{ ...td, color: C.muted, fontSize: 12, borderBottom: border }}>
                        {u.role.replace(/_/g, " ")}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: C.muted,
                          borderBottom: border,
                        }}
                      >
                        {u.inRenovationPool ? u.salesRenovationThisMonth : "—"}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: C.muted,
                          borderBottom: border,
                        }}
                      >
                        {u.inRenovationPool ? u.presalesRenovationThisMonth : "—"}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          borderBottom: border,
                        }}
                      >
                        {u.inRenovationPool ? u.current : "—"}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          color: !u.inRenovationPool || u.limit === 0 ? C.danger : C.text,
                          borderBottom: border,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          title="Edit limit (0 removes from pool)"
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            color: "inherit",
                            font: "inherit",
                            fontVariantNumeric: "tabular-nums",
                            textDecoration: "underline",
                            textDecorationColor: C.border,
                            textUnderlineOffset: 3,
                          }}
                        >
                          {u.limit}
                        </button>
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color:
                            u.inRenovationPool && u.remaining === 0 ? C.danger : C.muted,
                          borderBottom: border,
                        }}
                      >
                        {u.inRenovationPool ? u.remaining : "—"}
                      </td>
                      <td style={{ ...td, borderBottom: border }}>
                        {u.inRenovationPool ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 88 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 3,
                                background: C.border,
                                borderRadius: 2,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, u.pct))}%`,
                                  height: "100%",
                                  background: C.text,
                                  opacity: 0.45,
                                  borderRadius: 2,
                                  transition: "width 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                color: C.muted,
                                fontVariantNumeric: "tabular-nums",
                                minWidth: 36,
                                textAlign: "right",
                              }}
                            >
                              {u.pct}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: C.muted }}>—</span>
                        )}
                      </td>
                      <td style={{ ...td, paddingRight: 14, borderBottom: border }}>
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            color: C.accent,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {sortedUsers.length > VIEWPORT_ROWS ? (
          <div
            style={{
              padding: "7px 12px",
              borderTop: `1px solid ${C.border}`,
              fontSize: 11,
              color: C.muted,
              background: C.surface,
              textAlign: "center",
            }}
          >
            Showing top {VIEWPORT_ROWS} · scroll for {sortedUsers.length - VIEWPORT_ROWS} more
          </div>
        ) : null}
      </div>

      {showModal && currentEditingUser ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: C.overlay,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            animation: "leadLimitFadeSlide 0.22s ease",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: "90%",
              maxWidth: 400,
              background: C.card,
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                Renovation limit
              </span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: C.muted,
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: C.text }}>
                {currentEditingUser.name}
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
                Set limit &gt; 0 to add to the renovation pool. Set <strong>0</strong> to remove
                from the pool (no auto Renovation assigns).
              </p>
              <input
                type="number"
                min={0}
                value={currentEditingLimit}
                onChange={(e) => setCurrentEditingLimit(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 15,
                  fontWeight: 600,
                  boxSizing: "border-box",
                  background: C.surface,
                  color: C.text,
                  fontVariantNumeric: "tabular-nums",
                  outline: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 16,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    color: C.text,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lim = Number(currentEditingLimit);
                    if (Number.isNaN(lim) || lim < 0) return;
                    void leadLimitsApi
                      .setUserRenovationLimit(currentEditingUser.userId, lim)
                      .then((res) => {
                        setShowModal(false);
                        loadLimits({ force: true });
                        const data = (res ?? {}) as Record<string, unknown>;
                        const msg =
                          typeof data.message === "string" && data.message.trim()
                            ? data.message.trim()
                            : lim > 0
                              ? `Added to renovation pool (limit ${lim}).`
                              : "Removed from renovation pool.";
                        notifySuccess(msg);
                      })
                      .catch((e) =>
                        notifyError(
                          e instanceof Error ? e.message : "Failed to update limit.",
                        ),
                      );
                  }}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 8,
                    border: "none",
                    background: C.accent,
                    color: C.white,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
