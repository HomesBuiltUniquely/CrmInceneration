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
};

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
          className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--bt-border)] bg-white shadow-xl"
        >
          <div className="border-b border-[var(--bt-border)] bg-slate-50/80 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
              Deal filters
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--bt-text)]">
              {isSalesManager
                ? "Filter by your team or one sales executive"
                : "Pick a sales manager, then optionally one executive"}
            </p>
          </div>

          <div className="space-y-3 p-4">
            {showHierarchyFilters ? (
              <>
                {rosterLoading ? (
                  <p className="text-[12px] text-[var(--bt-muted)]">Loading team…</p>
                ) : rosterError ? (
                  <p className="text-[12px] text-red-600">{rosterError}</p>
                ) : null}

                {showManagerPicker ? (
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
                      Sales Manager
                    </span>
                    <select
                      value={draft.salesManagerId ?? ""}
                      onChange={(event) =>
                        onManagerChange(Number(event.target.value) || null)
                      }
                      disabled={rosterLoading || !roster}
                      className="mt-1 w-full rounded-md border border-[var(--bt-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--bt-text)] disabled:opacity-60"
                    >
                      <option value="">All sales managers</option>
                      {managerOptions.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : isSalesManager && roster ? (
                  <div className="rounded-lg border border-[var(--bt-border)] bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
                      Sales Manager
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-[var(--bt-text)]">
                      {roster.viewer.name}
                    </p>
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
                    Sales Executive
                  </span>
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
                    className="mt-1 w-full rounded-md border border-[var(--bt-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--bt-text)] disabled:opacity-60"
                  >
                    <option value="">
                      {showManagerPicker && !draft.salesManagerId
                        ? "Select manager first"
                        : isSalesManager
                          ? "All my executives"
                          : "All executives under manager"}
                    </option>
                    {executiveOptions.map((executive) => (
                      <option key={executive.id} value={executive.id}>
                        {executive.name}
                      </option>
                    ))}
                  </select>
                  {showManagerPicker && draft.salesManagerId && executiveOptions.length === 0 ? (
                    <p className="mt-1 text-[11px] text-[var(--bt-muted)]">
                      No executives found under this manager.
                    </p>
                  ) : null}
                </label>
              </>
            ) : null}

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--bt-border)] px-3 py-2.5 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={draft.pendingCancellationsOnly}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    pendingCancellationsOnly: event.target.checked,
                  }))
                }
                className="mt-0.5"
              />
              <span>
                <span className="block text-[12px] font-semibold text-[var(--bt-text)]">
                  Pending cancellations only
                </span>
                <span className="text-[11px] text-[var(--bt-muted)]">
                  Approval queue — deals awaiting manager decision
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--bt-border)] bg-white px-3 py-3">
            <button type="button" onClick={clear} className="bt-btn bt-btn-modal bt-btn-modal-ghost">
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={showHierarchyFilters && rosterLoading}
              className="bt-btn bt-btn-modal bt-btn-modal-primary disabled:opacity-60"
            >
              Apply filter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
