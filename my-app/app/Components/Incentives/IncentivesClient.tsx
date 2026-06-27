"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { salesWorkspaceSidebarSections } from "../Shared/sidebar-data";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  normalizeRole,
} from "@/lib/auth/api";
import { buildIncentiveProfile } from "@/lib/incentives-profile";
import { loadIncentivesRoster, type IncentivesRoster } from "@/lib/incentives-roster";
import IncentiveDashboard from "./IncentiveDashboard";
import TeamIncentivesOverview from "./TeamIncentivesOverview";
import "./incentives.css";

export default function IncentivesClient() {
  const [role, setRole] = useState("SALES_EXECUTIVE");
  const [profileName, setProfileName] = useState("User");
  const [roster, setRoster] = useState<IncentivesRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<number | null>(null);
  const [showTeamOverview, setShowTeamOverview] = useState(false);

  useEffect(() => {
    setRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""));
    setProfileName(window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY)?.trim() || "User");

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY) ?? "";
        if (!token) {
          setLoadError("Please sign in to view incentives.");
          setRoster(null);
          return;
        }
        const next = await loadIncentivesRoster(token);
        if (cancelled) return;
        setRoster(next);
        const defaultExec =
          next.executives.find((e) => e.id === next.viewer.id) ?? next.executives[0] ?? null;
        setSelectedExecutiveId(defaultExec?.id ?? null);
      } catch {
        if (!cancelled) setLoadError("Could not load team roster.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const profileInitials = useMemo(
    () =>
      profileName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("") || "U",
    [profileName],
  );

  const roleLabel = useMemo(
    () =>
      role
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    [role],
  );

  const visibleExecutives = useMemo(() => {
    if (!roster) return [];
    if (!roster.canPickManager || !selectedManagerId) return roster.executives;
    const managerId = Number(selectedManagerId);
    return roster.executives.filter((e) => e.managerId === managerId);
  }, [roster, selectedManagerId]);

  useEffect(() => {
    if (!visibleExecutives.length) {
      setSelectedExecutiveId(null);
      return;
    }
    if (!visibleExecutives.some((e) => e.id === selectedExecutiveId)) {
      setSelectedExecutiveId(visibleExecutives[0]?.id ?? null);
    }
  }, [visibleExecutives, selectedExecutiveId]);

  const selectedMember = useMemo(
    () => visibleExecutives.find((e) => e.id === selectedExecutiveId) ?? null,
    [visibleExecutives, selectedExecutiveId],
  );

  const selectedProfile = useMemo(
    () => (selectedMember ? buildIncentiveProfile(selectedMember) : null),
    [selectedMember],
  );

  const viewingLabel = useMemo(() => {
    if (!selectedMember || !roster) return "Elite Reporting View & Performance Tracking";
    const isSelf = selectedMember.id === roster.viewer.id;
    if (isSelf && !roster.canPickTeam) {
      return `Your individual incentives · ${selectedMember.name}`;
    }
    if (isSelf) return `Your incentives · ${selectedMember.name}`;
    return `Viewing ${selectedMember.name}${
      selectedMember.managerName ? ` · Team: ${selectedMember.managerName}` : ""
    }`;
  }, [roster, selectedMember]);

  return (
    <div className="inc-root xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <QuickAccessSidebar
          appBadge="HO WS"
          appName="Hows"
          appTagline="by HUB"
          sections={salesWorkspaceSidebarSections}
          profileName={profileName}
          profileRole={roleLabel}
          profileInitials={profileInitials}
        />

        <div className="min-w-0 xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-[var(--inc-border)] bg-[var(--inc-surface)] shadow-sm">
            <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
              <Image src="/HowsCrmLogo.png" alt="Hows CRM" width={44} height={44} />
              <div>
                <h1 className="text-base font-bold text-[var(--inc-text)]">Incentives</h1>
                <p className="text-xs text-[var(--inc-muted)]">
                  {roster?.canPickTeam ? "Team & individual performance" : "Your performance tracking"}
                </p>
              </div>
            </div>
          </div>

          <main className="p-4 md:p-6 lg:p-8">
            {loading ? (
              <p className="text-sm text-[var(--inc-muted)]">Loading incentives…</p>
            ) : loadError ? (
              <p className="text-sm text-[#dc2626]">{loadError}</p>
            ) : !roster || !selectedProfile || !selectedMember ? (
              <p className="text-sm text-[var(--inc-muted)]">No incentive data available for this view.</p>
            ) : (
              <>
                {roster.canPickTeam ? (
                  <>
                    <section className="mb-6 rounded-xl border border-[var(--inc-border)] bg-[var(--inc-surface)] p-4 shadow-sm">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {roster.canPickManager ? (
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
                              Sales Manager
                            </span>
                            <select
                              value={selectedManagerId}
                              onChange={(e) => {
                                setSelectedManagerId(e.target.value);
                                setShowTeamOverview(false);
                              }}
                              className="mt-1 w-full rounded-lg border border-[var(--inc-border)] bg-white px-3 py-2 text-[13px] text-[var(--inc-text)]"
                            >
                              <option value="">All teams</option>
                              {roster.managers.map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
                            Sales Executive
                          </span>
                          <select
                            value={selectedExecutiveId ?? ""}
                            onChange={(e) => setSelectedExecutiveId(Number(e.target.value) || null)}
                            className="mt-1 w-full rounded-lg border border-[var(--inc-border)] bg-white px-3 py-2 text-[13px] text-[var(--inc-text)]"
                          >
                            {visibleExecutives.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                                {e.managerName ? ` · ${e.managerName}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap items-end gap-2">
                          {visibleExecutives.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setShowTeamOverview((v) => !v)}
                              className={`inline-flex h-[42px] items-center justify-center rounded-lg px-4 text-[12px] font-bold uppercase tracking-wide transition ${
                                showTeamOverview
                                  ? "bg-[var(--inc-navy)] text-white"
                                  : "border border-[var(--inc-border)] bg-white text-[var(--inc-text)] hover:bg-[#f8fafc]"
                              }`}
                            >
                              Team Incentives
                            </button>
                          ) : null}
                          <p className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[12px] text-[var(--inc-muted)]">
                            {roster.canPickManager
                              ? "Super Admin / Sales Admin can browse all teams and executives."
                              : "Sales Manager view — your direct team only."}
                          </p>
                        </div>
                      </div>
                    </section>

                    {showTeamOverview && visibleExecutives.length > 1 ? (
                      <TeamIncentivesOverview
                        members={visibleExecutives}
                        selectedId={selectedExecutiveId}
                        onSelect={(id) => {
                          setSelectedExecutiveId(id);
                          setShowTeamOverview(false);
                        }}
                      />
                    ) : null}
                  </>
                ) : (
                  <section className="mb-6 rounded-xl border border-[var(--inc-green-border)] bg-[var(--inc-green-soft)] px-4 py-3">
                    <p className="text-[13px] font-semibold text-[#047857]">
                      Showing your individual incentives — {roster.viewer.name}
                    </p>
                  </section>
                )}

                <IncentiveDashboard profile={selectedProfile} viewingLabel={viewingLabel} />

                <button
                  type="button"
                  className="fixed bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-lg bg-[var(--inc-navy)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-lg"
                >
                  <span aria-hidden>📊</span>
                  Live Calculator
                </button>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
