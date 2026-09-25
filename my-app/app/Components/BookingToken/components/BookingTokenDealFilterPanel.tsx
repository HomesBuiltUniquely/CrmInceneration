"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CRM_TOKEN_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { loadIncentivesRoster, type IncentivesRoster } from "@/lib/incentives-roster";
import {
  bookingDealFilterSummary,
  buildAppliedBookingDealFilters,
  DEFAULT_BOOKING_DEAL_FILTERS,
  executivesForManager,
  isBookingDealFilterActive,
  type BookingDealFilterDraft,
  type BookingDealFilterState,
} from "@/lib/booking-token-deal-filters";

type Props = {
  value: BookingDealFilterState;
  onChange: (next: BookingDealFilterState) => void;
  viewerRole: string;
  /** Hide team filters for sales executives (Hub scopes to self). */
  showHierarchyFilters?: boolean;
};

const EMPTY_DRAFT: BookingDealFilterDraft = {
  salesManagerId: null,
  salesExecutiveId: null,
  pendingCancellationsOnly: false,
  bufferDealsOnly: false,
};

const selectClassName =
  "h-8 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-2.5 pr-7 text-[12px] font-medium text-slate-800 outline-none transition hover:border-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200/70 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

function ChevronDown() {
  return (
    <svg
      className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M2.5 4.5 L6 8 L9.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterToggle({
  checked,
  title,
  hint,
  onChange,
}: {
  checked: boolean;
  title: string;
  hint: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-200 ${
        checked
          ? "bg-emerald-50 ring-1 ring-emerald-200/80"
          : "bg-slate-50/80 ring-1 ring-slate-200/80 hover:bg-slate-100/80"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-slate-800">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{hint}</span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export default function BookingTokenDealFilterPanel({
  value,
  onChange,
  viewerRole,
  showHierarchyFilters = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDealFilterDraft>(EMPTY_DRAFT);
  const [roster, setRoster] = useState<IncentivesRoster | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const normalizedRole = normalizeRole(viewerRole);
  const isSalesManager = normalizedRole === "SALES_MANAGER" || normalizedRole === "MANAGER";
  const showManagerPicker = showHierarchyFilters && !isSalesManager;

  useEffect(() => {
    if (!open) {
      setDraft({
        salesManagerId: value.salesManagerId,
        salesExecutiveId: value.salesExecutiveId,
        pendingCancellationsOnly: value.pendingCancellationsOnly,
        bufferDealsOnly: value.bufferDealsOnly,
      });
    }
  }, [open, value]);

  useEffect(() => {
    if (!open || !showHierarchyFilters) return;
    let cancelled = false;
    setRosterLoading(true);
    setRosterError("");
    void (async () => {
      try {
        const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY) ?? "";
        if (!token) {
          if (!cancelled) setRosterError("Sign in to load team filters.");
          return;
        }
        const next = await loadIncentivesRoster(token);
        if (!cancelled) setRoster(next);
      } catch {
        if (!cancelled) setRosterError("Could not load sales team.");
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showHierarchyFilters]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const managerOptions = useMemo(() => {
    if (!roster) return [];
    return roster.managers;
  }, [roster]);

  const executiveOptions = useMemo(() => {
    if (!roster) return [];
    if (isSalesManager) {
      return executivesForManager(roster, roster.viewer.id || null);
    }
    return executivesForManager(roster, draft.salesManagerId);
  }, [draft.salesManagerId, isSalesManager, roster]);

  const active = isBookingDealFilterActive(value);

  const apply = () => {
    if (!roster || !showHierarchyFilters) {
      onChange({
        ...DEFAULT_BOOKING_DEAL_FILTERS,
        pendingCancellationsOnly: draft.pendingCancellationsOnly,
        bufferDealsOnly: draft.bufferDealsOnly,
      });
      setOpen(false);
      return;
    }
    onChange(buildAppliedBookingDealFilters(draft, roster, viewerRole));
    setOpen(false);
  };

  const clear = () => {
    onChange(DEFAULT_BOOKING_DEAL_FILTERS);
    setDraft(EMPTY_DRAFT);
    setOpen(false);
  };

  const onManagerChange = (managerId: number | null) => {
    setDraft((prev) => ({
      ...prev,
      salesManagerId: managerId,
      salesExecutiveId: null,
    }));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`bt-btn bt-btn-toolbar ${active ? "bt-btn-toolbar-active" : ""}`}
      >
        <span aria-hidden>▾</span>
        Deals
        {active ? (
          <span className="max-w-[160px] truncate rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-white">
            {bookingDealFilterSummary(value)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter deals by team"
          className="bt-deal-filter-panel absolute right-0 z-50 mt-2 w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Filters
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              aria-label="Close filters"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-2.5 px-3.5 pb-3">
            {showHierarchyFilters ? (
              <>
                {rosterLoading ? (
                  <p className="py-1 text-[11px] text-slate-400">Loading team…</p>
                ) : rosterError ? (
                  <p className="py-1 text-[11px] text-red-600">{rosterError}</p>
                ) : null}

                {showManagerPicker ? (
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Manager
                    </span>
                    <span className="relative block">
                      <select
                        value={draft.salesManagerId ?? ""}
                        onChange={(event) =>
                          onManagerChange(Number(event.target.value) || null)
                        }
                        disabled={rosterLoading || !roster}
                        className={selectClassName}
                      >
                        <option value="">All managers</option>
                        {managerOptions.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown />
                    </span>
                  </label>
                ) : isSalesManager && roster ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/80">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Manager
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-800">
                      {roster.viewer.name}
                    </p>
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Executive
                  </span>
                  <span className="relative block">
                    <select
                      value={draft.salesExecutiveId ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          salesExecutiveId: Number(event.target.value) || null,
                        }))
                      }
                      disabled={
                        rosterLoading ||
                        !roster ||
                        (showManagerPicker && !draft.salesManagerId)
                      }
                      className={selectClassName}
                    >
                      <option value="">
                        {showManagerPicker && !draft.salesManagerId
                          ? "Select manager first"
                          : "All executives"}
                      </option>
                      {executiveOptions.map((executive) => (
                        <option key={executive.id} value={executive.id}>
                          {executive.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown />
                  </span>
                  {showManagerPicker &&
                  draft.salesManagerId &&
                  !rosterLoading &&
                  executiveOptions.length === 0 ? (
                    <p className="mt-1 text-[10px] text-slate-400">No executives under this manager.</p>
                  ) : null}
                </label>
              </>
            ) : null}

            <div className="space-y-1.5 pt-0.5">
              <FilterToggle
                checked={draft.bufferDealsOnly}
                title="9.9% buffer only"
                hint="Below exact 10% target"
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    bufferDealsOnly: next,
                  }))
                }
              />
              <FilterToggle
                checked={draft.pendingCancellationsOnly}
                title="Pending cancellations"
                hint="Awaiting approval"
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    pendingCancellationsOnly: next,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2.5">
            <button
              type="button"
              onClick={clear}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={showHierarchyFilters && rosterLoading}
              className="rounded-full bg-[var(--bt-navy)] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
