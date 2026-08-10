"use client";
import { useState, useEffect, ChangeEvent } from "react";
import { leadLimitsApi } from "@/lib/lead-limits-api";
import { adminPanelApi } from "@/lib/admin-panel-api";
import { mergeUserRowsById, pickNumber } from "@/lib/api-normalize";
import { cn } from "@/lib/cn";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";

// Reuse the colour tokens
const C = {
  bg: "var(--crm-app-bg)",
  card: "var(--crm-surface)",
  surface: "var(--crm-surface-subtle)",
  elevated: "var(--crm-surface-elevated)",
  primary: "var(--crm-accent)",
  primaryHover: "var(--crm-accent-strong)",
  accent: "var(--crm-accent)",
  danger: "var(--crm-danger)",
  dangerBg: "var(--crm-danger-bg)",
  dangerText: "var(--crm-danger-text)",
  success: "var(--crm-success)",
  successBg: "var(--crm-success-bg)",
  successText: "var(--crm-success-text)",
  warningBg: "var(--crm-warning-bg)",
  warningText: "var(--crm-warning-text)",
  info: "var(--crm-info)",
  infoBg: "var(--crm-info-bg)",
  infoText: "var(--crm-info-text)",
  neutral: "var(--crm-neutral)",
  neutralBg: "var(--crm-neutral-bg)",
  neutralText: "var(--crm-neutral-text)",
  border: "var(--crm-border)",
  borderStrong: "var(--crm-border-strong)",
  text: "var(--crm-text-primary)",
  muted: "var(--crm-text-muted)",
  badgeBg: "var(--crm-accent-soft)",
  badgeText: "var(--crm-accent)",
  inputBg: "var(--crm-input-bg)",
  overlay: "var(--crm-overlay)",
  tabGrad: "var(--crm-tab-grad)",
  white: "#fff",
  disabled: "var(--crm-border-strong)",
};

interface UserLimit {
  userId: number;
  name: string;
  role: string;
  branch: string;
  current: number;
  limit: number;
  remaining: number;
  pct: number;
}

function normalizedUserRole(u: Record<string, unknown>): string {
  const candidate = u.role ?? u.userRole ?? u.authority ?? u.type ?? "";
  return normalizeRole(String(candidate));
}

function mapLimitUser(u: Record<string, unknown>, idx: number, fallbackLimit: number): UserLimit {
  const userId = Number(u.userId ?? u.id ?? idx);
  const limit = pickNumber(u, ["renovationLimit"]) ?? fallbackLimit;
  const current = pickNumber(u, ["renovationAssignedThisMonth"]) ?? 0;
  const remaining = pickNumber(u, ["remaining", "remainingLeads"]) ?? Math.max(0, limit - current);
  const pct =
    pickNumber(u, ["renovationUsagePercent"]) ??
    (limit > 0 ? Math.round((current / limit) * 1000) / 10 : 0);
  return {
    userId,
    name: String(u.fullName ?? u.name ?? u.username ?? `User ${userId}`),
    role: normalizedUserRole(u),
    branch: String(u.branch ?? ""),
    current,
    limit,
    remaining,
    pct,
  };
}

export default function RenovationLeadLimitDashboard() {
  const { notifySuccess, notifyError } = useGlobalNotifier();
  const [viewerRole, setViewerRole] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    setViewerRole(normalizeRole(role));
  }, []);

  const canManageLeadLimits = viewerRole === "SUPER_ADMIN" || viewerRole === "SALES_ADMIN";
  
  const [defaultLimit, setDefaultLimit] = useState<string>("20");
  const [users, setUsers] = useState<UserLimit[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  
  // Single edit modal state
  const [showModal, setShowModal] = useState(false);
  const [currentEditingUser, setCurrentEditingUser] = useState<UserLimit | null>(null);
  const [currentEditingLimit, setCurrentEditingLimit] = useState<string>("");

  const loadLimits = () => {
    setLimitsLoading(true);
    void Promise.all([
      leadLimitsApi.getRenovationLimits().catch(() => null),
      // We also need all users from PRESALES and SALES
      adminPanelApi.listUsersByRole("PRESALES_EXECUTIVE").catch(() => [] as Array<Record<string, unknown>>),
      adminPanelApi.listUsersByRole("PRE_SALES").catch(() => [] as Array<Record<string, unknown>>),
      adminPanelApi.listUsersByRole("PRESALES_MANAGER").catch(() => [] as Array<Record<string, unknown>>),
      adminPanelApi.listUsersByRole("SALES_EXECUTIVE").catch(() => [] as Array<Record<string, unknown>>),
      adminPanelApi.listUsersByRole("SALES_MANAGER").catch(() => [] as Array<Record<string, unknown>>),
    ])
      .then(([apiResult, presalesExec, preSales, presalesMgr, salesExec, salesMgr]) => {
        // Renovation limit covers all standard users.
        const combined = [...presalesExec, ...preSales, ...presalesMgr, ...salesExec, ...salesMgr];
        
        // Use the returned API array to map to `users`. If `apiResult` has the right shape, we merge.
        // Assuming API returns `{ users: [...], defaultLimit: 20 }` or similar structure.
        const apiData = (apiResult ?? {}) as Record<string, unknown>;
        const rawUsers = [
          ...(Array.isArray(apiData.salesManagers) ? apiData.salesManagers : []),
          ...(Array.isArray(apiData.salesExecutives) ? apiData.salesExecutives : []),
          ...(Array.isArray(apiData.users) ? apiData.users : [])
        ];
        const d = pickNumber(apiData, ["defaultRenovationLimit", "defaultLimit", "limit", "value", "default"]);
        const finalDefault = d !== undefined ? d : 20;
        if (d !== undefined) setDefaultLimit(String(d));
        
        const merged = mergeUserRowsById(combined, rawUsers as Array<Record<string, unknown>>);
        setUsers(merged.map((r, i) => mapLimitUser(r, i, finalDefault)));
      })
      .catch(() => setUsers([]))
      .finally(() => setLimitsLoading(false));
  };

  useEffect(() => {
    if (!canManageLeadLimits) return;
    loadLimits();
  }, [canManageLeadLimits]);

  if (!canManageLeadLimits) {
    return (
      <div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 0 }}>
          Lead limit management is available only for Sales Admin and Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div>      <div style={{ background: C.tabGrad, borderRadius: 16, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, margin: 0 }}>
            Default monthly Renovation limit for users
          </p>
          <p style={{ color: C.white, fontSize: 13, marginTop: 6, fontWeight: 600 }}>
            📌 Current: <strong style={{ fontSize: 14 }}>{defaultLimit} leads/month</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            type="number"
            value={defaultLimit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDefaultLimit(e.target.value)}
            style={{ width: 80, padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, textAlign: "center", outline: "none", background: C.card, color: C.text }}
          />
          <button
            style={{ background: C.success, color: "white", padding: "8px 18px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            onClick={() => {
              const n = Number(defaultLimit);
              if (Number.isNaN(n)) return;
              void leadLimitsApi.setRenovationDefault(n)
                .then(() => {
                  loadLimits();
                  notifySuccess("Default renovation lead limit updated.");
                })
                .catch((e) => notifyError(e instanceof Error ? e.message : "Failed to update default limit."));
            }}
          >
            Update Default
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.muted }}>
          {limitsLoading ? "Loading…" : `${users.length} users`}
        </span>
        <button
          onClick={loadLimits}
          style={{
            background: C.accent, color: "white", padding: "7px 16px", borderRadius: "8px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer"
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ borderBottom: `2px solid ${C.border}` }}>
            <tr style={{ background: C.surface }}>
              {["Name", "Role", "Branch", "Current", "Limit", "Remaining", "Usage", "Action"].map((c) => (
                <th key={c} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {limitsLoading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: C.muted }}>Loading renovation limits…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: C.muted }}>No users found for renovation limit.</td></tr>
            ) : (
              users.map((u, i) => {
                const barColor = u.pct === 0 ? C.borderStrong : u.pct < 50 ? C.success : u.pct < 80 ? "var(--crm-warning-text)" : C.danger;
                return (
                  <tr key={u.userId} style={{ background: u.limit === 0 ? C.dangerBg : i % 2 === 0 ? C.card : C.surface, color: C.text }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 14 }}>{u.name}</td>
                    <td style={{ padding: "12px 14px" }}><span style={{ background: C.badgeBg, color: C.badgeText, padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{u.role}</span></td>
                    <td style={{ padding: "12px 14px", fontSize: 14 }}>{u.branch}</td>
                    <td style={{ padding: "12px 14px", fontSize: 14, color: u.current === 0 ? C.danger : C.text, fontWeight: 600 }}>{u.current}</td>
                    <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 600 }}>{u.limit}</td>
                    <td style={{ padding: "12px 14px", fontSize: 14, color: u.remaining === 0 ? C.danger : C.success, fontWeight: 600 }}>{u.remaining}</td>
                    <td style={{ padding: "12px 14px", minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: C.borderStrong, borderRadius: 3 }}>
                          <div style={{ width: `${u.pct}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: barColor, minWidth: 38 }}>{u.pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <button
                        style={{ background: C.primary, color: "white", padding: "5px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        onClick={() => {
                          setCurrentEditingUser(u);
                          setCurrentEditingLimit(String(u.limit) || "");
                          setShowModal(true);
                        }}
                      >
                        Set Limit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && currentEditingUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: C.overlay }}>
          <div style={{ width: "90%", maxWidth: 500, background: C.card, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: C.tabGrad, padding: "16px 20px", color: "white", fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
              <span>Set Renovation Monthly Limit</span>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ margin: "0 0 16px 0", color: C.text, fontWeight: 600 }}>Setting limit for: <strong>{currentEditingUser.name}</strong></p>
              <input
                type="number"
                value={currentEditingLimit}
                onChange={(e) => setCurrentEditingLimit(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: 8, border: `2px solid ${C.primary}`, fontSize: 16, boxSizing: "border-box", background: C.surface, color: C.text }}
                autoFocus
              />
              <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
                <button onClick={() => setShowModal(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.surface, color: C.text, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button
                  onClick={() => {
                    const lim = Number(currentEditingLimit);
                    if (Number.isNaN(lim)) return;
                    void leadLimitsApi.setUserRenovationLimit(currentEditingUser.userId, lim)
                      .then(() => {
                        setShowModal(false);
                        loadLimits();
                        notifySuccess("Renovation limit updated.");
                      })
                      .catch(e => notifyError(e instanceof Error ? e.message : "Failed to update limit."));
                  }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.success, color: "white", fontWeight: 600, cursor: "pointer" }}
                >
                  Save Limit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
