"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import "./booking-token.css";
import KpiCards from "./components/KpiCards";
import DealsTable from "./components/DealsTable";
import RecentLedger from "./components/RecentLedger";
import UrgentTasks from "./components/UrgentTasks";
import PipelineVelocity from "./components/PipelineVelocity";
import type { BookingTokenTab } from "./types";

export default function BookingTokenClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBookingDone = searchParams.get("from") === "booking-done";
  const highlightId = searchParams.get("highlight") ?? "";
  const [tab, setTab] = useState<BookingTokenTab>("bookings");
  const [role, setRole] = useState("SUPER_ADMIN");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const stored = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    if (stored !== "SUPER_ADMIN") {
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

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--crm-app-bg)] text-sm text-[var(--crm-text-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="bt-root min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <QuickAccessSidebar
          appBadge="HO WS"
          appName="Hows"
          appTagline="by HUB"
          sections={dashboardSidebarSections}
          profileName={roleLabel}
          profileRole={role}
          profileInitials="SA"
        />

        <div className="min-w-0 bg-[var(--bt-bg)] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-[var(--bt-border)] bg-[var(--bt-surface)] shadow-sm">
            <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
              <Image src="/HowsCrmLogo.png" alt="Hows CRM" width={44} height={44} />
              <div>
                <h1 className="text-base font-bold text-[var(--bt-text)]">Booking & Token</h1>
                <p className="text-xs text-[var(--bt-muted)]">Super Admin workspace</p>
              </div>
            </div>
          </div>

          <main className="p-6 lg:p-8">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight text-[var(--bt-text)] md:text-3xl">
                  Booking & Token Management
                </h2>
                <p className="mt-1 text-sm text-[var(--bt-muted)]">
                  Simplified view of active deal progress and tokenization.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-[var(--bt-border)] bg-[var(--bt-surface)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setTab("bookings")}
                    className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                      tab === "bookings"
                        ? "bg-[var(--bt-navy)] text-white"
                        : "text-[var(--bt-muted)] hover:text-[var(--bt-text)]"
                    }`}
                  >
                    Bookings
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("tokens")}
                    className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                      tab === "tokens"
                        ? "bg-[var(--bt-navy)] text-white"
                        : "text-[var(--bt-muted)] hover:text-[var(--bt-text)]"
                    }`}
                  >
                    Tokens
                  </button>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--bt-border)] bg-[var(--bt-surface)] px-4 py-2 text-xs font-bold uppercase text-[var(--bt-text)] hover:bg-slate-50"
                >
                  Filter
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--bt-border)] bg-[var(--bt-surface)] px-4 py-2 text-xs font-bold uppercase text-[var(--bt-text)] hover:bg-slate-50"
                >
                  Export
                </button>
              </div>
            </header>

            <div className="space-y-6">
              {fromBookingDone ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Lead from Booking Done is now listed in active deals below.
                </div>
              ) : null}
              <KpiCards />
              <DealsTable />
              <RecentLedger />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <UrgentTasks />
                <PipelineVelocity />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
