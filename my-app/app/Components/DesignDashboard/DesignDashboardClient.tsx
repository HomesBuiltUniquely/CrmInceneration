"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import {
  CRM_ROLE_STORAGE_KEY,
  canAccessDesignerDashboard,
  normalizeRole,
} from "@/lib/auth/api";
import {
  countUpcomingAppointments,
  fetchActiveDesignerRecords,
  fetchDesignerLeadsBundle,
  fetchDesignerMyAppointmentsNormalized,
  flattenDesignerLeadsBundle,
  resolveDesignerDisplayName,
  type DesignerQueueLeadRow,
  type NormalizedAppointmentRow,
} from "@/lib/designer-dashboard-client";

export default function DesignDashboardClient() {
  const router = useRouter();
  const { notifyError } = useGlobalNotifier();

  const [role] = useState(() => {
    if (typeof window === "undefined") return "";
    return normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "") || "";
  });

  const roleLabel = useMemo(() => {
    if (!role) return "User";
    return role
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }, [role]);

  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [resolvedDesignerName, setResolvedDesignerName] = useState<string | null>(null);
  const [superAdminDesignerChoice, setSuperAdminDesignerChoice] = useState("");
  const [designerOptions, setDesignerOptions] = useState<string[]>([]);
  const [leads, setLeads] = useState<DesignerQueueLeadRow[]>([]);
  const [appointments, setAppointments] = useState<NormalizedAppointmentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isSuperAdmin = role === "SUPER_ADMIN";

  const effectiveDesignerName = useMemo(() => {
    if (isSuperAdmin && superAdminDesignerChoice.trim()) {
      return superAdminDesignerChoice.trim();
    }
    return resolvedDesignerName?.trim() ?? "";
  }, [isSuperAdmin, resolvedDesignerName, superAdminDesignerChoice]);

  const upcomingCount = useMemo(
    () => countUpcomingAppointments(appointments, new Date()),
    [appointments],
  );

  useEffect(() => {
    if (!role) return;
    if (!canAccessDesignerDashboard(role)) {
      router.replace("/Leads");
    }
  }, [role, router]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const name = await resolveDesignerDisplayName();
      setResolvedDesignerName(name);

      if (isSuperAdmin && !name) {
        const rec = await fetchActiveDesignerRecords();
        const names = [...new Set(rec.map((r) => r.name).filter(Boolean))].sort();
        setDesignerOptions(names);
      }

      const workAs = (() => {
        if (isSuperAdmin && superAdminDesignerChoice.trim()) {
          return superAdminDesignerChoice.trim();
        }
        return name?.trim() ?? "";
      })();

      const bundlePromise = workAs
        ? fetchDesignerLeadsBundle(workAs)
        : Promise.resolve({});
      const [bundle, appts] = await Promise.all([
        bundlePromise,
        fetchDesignerMyAppointmentsNormalized(),
      ]);
      setLeads(flattenDesignerLeadsBundle(bundle));
      setAppointments(appts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load designer dashboard";
      setLoadError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, notifyError, superAdminDesignerChoice]);

  useEffect(() => {
    if (!role || !canAccessDesignerDashboard(role)) return;
    void loadDashboard();
  }, [role, loadDashboard, refreshToken]);

  const handleRetryResolve = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  const needsSuperAdminPick = isSuperAdmin && !resolvedDesignerName && designerOptions.length > 0;
  /** Designer-linked users without a resolved name (and super admins with no designer list) see recovery hints. */
  const showNoDesignerBanner =
    !loading &&
    !effectiveDesignerName &&
    !needsSuperAdminPick;

  return (
    <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={roleLabel}
            profileRole={role}
            profileInitials={roleLabel.slice(0, 2).toUpperCase()}
          />
        </div>

        <div className="bg-[var(--crm-surface)] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[var(--crm-shadow-sm)]">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 md:px-6">
              <h1 className="text-[1.75rem] font-bold tracking-[-0.04em] text-[var(--crm-text-primary)]">
                Designer Dashboard
              </h1>
              {effectiveDesignerName ? (
                <p className="text-[12px] font-medium text-[var(--crm-text-muted)]">
                  Designer name for APIs:{" "}
                  <span className="text-[var(--crm-text-secondary)]">{effectiveDesignerName}</span>
                </p>
              ) : null}
            </div>
          </div>

          <main className="px-4 py-6 md:px-6">
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 md:p-6">
              <h2 className="text-xl font-bold text-[var(--crm-text-primary)]">
                Welcome{resolvedDesignerName ? `, ${resolvedDesignerName}` : ""}
              </h2>
              <div className="mt-2 h-px bg-[var(--crm-accent)]" />

              {needsSuperAdminPick ? (
                <div className="mt-5 rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-4">
                  <p className="text-[13px] font-semibold text-[var(--crm-text-primary)]">
                    View queue as designer
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
                    Your account is not linked to a designer profile. Pick a designer to load the same
                    data as legacy Hub.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-text-muted)]">
                      Designer
                      <select
                        value={superAdminDesignerChoice}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSuperAdminDesignerChoice(v);
                          if (v.trim()) setRefreshToken((t) => t + 1);
                        }}
                        className="h-10 min-w-[220px] rounded-[12px] border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3 text-[14px] text-[var(--crm-text-primary)]"
                      >
                        <option value="">Select…</option>
                        {designerOptions.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}

              {showNoDesignerBanner ? (
                <div className="mt-5 rounded-[14px] border border-amber-200/90 bg-amber-50/90 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
                  <p className="text-[13px] font-semibold text-amber-950 dark:text-amber-100">
                    No designer name on your session
                  </p>
                  <p className="mt-1 text-[12px] text-amber-900/90 dark:text-amber-200/90">
                    Sign in again after linking your user to a Designer, or open{" "}
                    <code className="rounded bg-black/5 px-1 dark:bg-white/10">GET /api/auth/me</code> from Hub.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRetryResolve()}
                    className="mt-3 rounded-[12px] border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50"
                  >
                    Retry resolve
                  </button>
                </div>
              ) : null}

              {loadError ? (
                <p className="mt-4 text-[13px] text-red-600" role="alert">
                  {loadError}
                </p>
              ) : null}

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "My assigned clients", value: leads.length },
                  { label: "My appointments", value: appointments.length },
                  { label: "Upcoming meetings", value: upcomingCount },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-5 text-center"
                  >
                    <div className="text-4xl font-extrabold text-[var(--crm-accent)]">
                      {loading ? "…" : card.value}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--crm-text-muted)]">{card.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <div className="text-lg font-bold text-[var(--crm-text-primary)]">Quick actions</div>
                <Link
                  href="/appointment"
                  className="rounded-lg bg-[var(--crm-accent)] px-5 py-2 text-sm font-semibold text-white hover:brightness-105"
                >
                  Manage availability
                </Link>
                <Link
                  href="/google-calendar"
                  className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-5 py-2 text-sm font-semibold text-[var(--crm-text-primary)] hover:bg-[var(--crm-surface)]"
                >
                  Hub Calendar (Google)
                </Link>
              </div>

              <div className="mt-10 text-lg font-bold text-[var(--crm-text-primary)]">My clients (queue)</div>
              <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
                Form, Meta, Google, and Add leads in Fix Appointment, Meeting Scheduled, or Design Refinement
                Round (Revisit). Website leads are not included in this bundle.
              </p>

              <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--crm-border)]">
                <table className="min-w-[720px] w-full border-collapse text-left text-[13px]">
                  <thead className="bg-[var(--crm-surface-subtle)] text-[11px] font-bold uppercase tracking-wide text-[var(--crm-text-muted)]">
                    <tr>
                      <th className="px-3 py-2.5">Lead</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Milestone stage</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5">Sub-stage</th>
                      <th className="px-3 py-2.5">Lead ID</th>
                      <th className="px-3 py-2.5">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!effectiveDesignerName || loading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-[var(--crm-text-muted)]">
                          {loading ? "Loading…" : "Select a designer context to load leads."}
                        </td>
                      </tr>
                    ) : leads.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-[var(--crm-text-muted)]">
                          No leads in your queue for this milestone set.
                        </td>
                      </tr>
                    ) : (
                      leads.map((row) => (
                        <tr
                          key={`${row.leadType}-${row.id}`}
                          className="border-t border-[var(--crm-border)] hover:bg-[var(--crm-surface-subtle)]"
                        >
                          <td className="px-3 py-2.5 font-medium text-[var(--crm-text-primary)]">{row.name}</td>
                          <td className="px-3 py-2.5 text-[var(--crm-text-secondary)]">{row.leadType}</td>
                          <td className="px-3 py-2.5 text-[var(--crm-text-secondary)]">
                            {row.milestoneStage ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--crm-text-secondary)]">
                            {row.milestoneStageCategory ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--crm-text-secondary)]">
                            {row.milestoneSubStage ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--crm-text-muted)]">
                            {row.leadId ?? "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={row.href}
                              className="font-semibold text-[var(--crm-accent)] hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-10 text-lg font-bold text-[var(--crm-text-primary)]">My appointments</div>
              <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
                For designers, <code className="rounded bg-[var(--crm-surface-subtle)] px-1">GET /v1/Appointment</code>{" "}
                returns only your calendar when your role and designer linkage match Hub.
              </p>
              <div className="mt-3 space-y-2">
                {!effectiveDesignerName || loading ? null : appointments.length === 0 ? (
                  <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-6 text-center text-[var(--crm-text-muted)]">
                    No appointments returned for your session.
                  </div>
                ) : (
                  appointments.slice(0, 12).map((a, i) => (
                    <div
                      key={a.id ?? `appt-${i}`}
                      className="rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[var(--crm-text-primary)]">
                          {a.slotDisplayName ?? a.description ?? "Appointment"}
                        </span>
                        <span className="text-[12px] text-[var(--crm-text-muted)]">
                          {a.startTime ?? a.date ?? ""}
                        </span>
                      </div>
                      {a.description ? (
                        <p className="mt-1 text-[12px] text-[var(--crm-text-secondary)]">{a.description}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
