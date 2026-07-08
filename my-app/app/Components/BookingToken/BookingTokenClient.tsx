"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CrmAppShell from "../Shared/CrmAppShell";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { canAccessBookingTokenDashboard } from "@/lib/roleUtils";
import {
  DEFAULT_BOOKING_DATE_FILTER,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import "./booking-token.css";
import KpiCards from "./components/KpiCards";
import DealsTable from "./components/DealsTable";
import RecentLedger from "./components/RecentLedger";
import UrgentTasks from "./components/UrgentTasks";
import PipelineVelocity from "./components/PipelineVelocity";
import BookingTokenDateFilterPanel from "./components/BookingTokenDateFilterPanel";
import BookingTokenDealFilterPanel from "./components/BookingTokenDealFilterPanel";
import type { BookingTokenTab } from "./types";
import {
  DEFAULT_BOOKING_DEAL_FILTERS,
  type BookingDealFilterState,
} from "@/lib/booking-token-deal-filters";
import { isSuperAdminRole, isAdminRole } from "@/lib/roleUtils";

const TAB_ITEMS: { id: BookingTokenTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "token", label: "Token" },
  { id: "booking", label: "Booking" },
  { id: "cancel", label: "Cancel" },
];

export default function BookingTokenClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBookingDone = searchParams.get("from") === "booking-done";
  const highlightId = searchParams.get("highlight") ?? "";
  const [tab, setTab] = useState<BookingTokenTab>("all");
  const [dateFilter, setDateFilter] = useState<BookingDateFilterState>(
    DEFAULT_BOOKING_DATE_FILTER,
  );
  const [dealFilters, setDealFilters] = useState<BookingDealFilterState>(
    DEFAULT_BOOKING_DEAL_FILTERS,
  );
  const [kpiRefresh, setKpiRefresh] = useState(0);
  const [role, setRole] = useState("");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const stored = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    if (!canAccessBookingTokenDashboard(stored)) {
      router.replace("/Leads");
      return;
    }
    setRole(stored);
    setAllowed(true);
  }, [router]);

  useEffect(() => {
    if (!fromBookingDone || !highlightId) return;
    const target = document.getElementById(`deal-${highlightId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fromBookingDone, highlightId, allowed]);

  const roleLabel = useMemo(
    () =>
      role
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    [role],
  );

  const showDashboardExtras = tab !== "cancel";
  const showHierarchyFilters =
    isAdminRole(role) || role === "SALES_ADMIN" || role === "SALES_MANAGER";
  const workspaceLabel = isSuperAdminRole(role)
    ? "Super Admin workspace"
    : roleLabel
      ? `${roleLabel} workspace`
      : "Booking workspace";

  const ledgerTab = tab === "cancel" ? "all" : tab;
  const pipelineTab = tab === "cancel" ? "all" : tab;

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--crm-app-bg)] text-sm text-[var(--crm-text-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="bt-root min-h-screen bg-[var(--crm-app-bg)]">
      <CrmAppShell
        sections={dashboardSidebarSections}
        profileName={roleLabel}
        profileRole={role}
        profileInitials="SA"
      >
        <div className="min-w-0 bg-[var(--bt-bg)]">
          <div className="border-b border-[var(--bt-border)] bg-[var(--bt-surface)] shadow-sm">
            <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
              <Image src="/HowsCrmLogo.png" alt="Hows CRM" width={44} height={44} />
              <div>
                <h1 className="text-base font-bold text-[var(--bt-text)]">Booking & Token</h1>
                <p className="text-xs text-[var(--bt-muted)]">{workspaceLabel}</p>
              </div>
            </div>
          </div>

          <main className="p-6 lg:p-8">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight text-[var(--bt-text)] md:text-3xl">
                  Booking & Token Management
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-[var(--bt-border)] bg-[var(--bt-surface)] p-0.5">
                  {TAB_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={`bt-btn bt-btn-tab ${
                        tab === item.id ? "bt-btn-tab-active" : ""
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <BookingTokenDateFilterPanel value={dateFilter} onChange={setDateFilter} />
                <BookingTokenDealFilterPanel
                  value={dealFilters}
                  onChange={setDealFilters}
                  showHierarchyFilters={showHierarchyFilters}
                />
                <button
                  type="button"
                  className="bt-btn bt-btn-toolbar"
                >
                  Export
                </button>
              </div>
            </header>

            <div className="space-y-6">
              {fromBookingDone && (tab === "all" || tab === "token") ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Lead from Booking Done is now listed in active deals below.
                </div>
              ) : null}

              <KpiCards
                refreshSignal={kpiRefresh}
                dateFilter={dateFilter}
                dealFilters={dealFilters}
                tab={tab}
              />

              <DealsTable
                tab={tab}
                dateFilter={dateFilter}
                dealFilters={dealFilters}
                onDealCancelled={() => setTab("cancel")}
                onDealsChanged={() => setKpiRefresh((n) => n + 1)}
                onConvertedToBooking={() => setTab("booking")}
              />

              {showDashboardExtras ? (
                <>
                  <RecentLedger
                    refreshSignal={kpiRefresh}
                    dateFilter={dateFilter}
                    dealFilters={dealFilters}
                    tab={ledgerTab}
                  />
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <UrgentTasks />
                    <PipelineVelocity
                      refreshSignal={kpiRefresh}
                      dateFilter={dateFilter}
                      dealFilters={dealFilters}
                      tab={pipelineTab}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </main>
        </div>
      </CrmAppShell>
    </div>
  );
}
