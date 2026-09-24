"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  fetchBookingTokenGlobalSearch,
  type BookingTokenDeal,
} from "@/lib/booking-done-api";
import { bookingTokenDealToDealRow } from "@/lib/booking-token-leads";
import type { DealRow } from "../types";
import BookingPaymentPanel, {
  type BookingPaymentPanelMode,
} from "./BookingPaymentPanel";

const MIN_Q = 2;
const DEBOUNCE_MS = 320;
const PAGE_SIZE = 20;

/** Fill gaps so sparse Hub search hits still map safely into DealRow. */
function normalizeSearchDeal(deal: BookingTokenDeal): BookingTokenDeal {
  const listing = String(deal.listingType ?? "").trim().toLowerCase();
  const listingType =
    listing === "token" || listing === "booking" || listing === "cancel"
      ? listing
      : deal.listingType;
  return {
    ...deal,
    id: String(deal.id ?? ""),
    leadType: String(deal.leadType ?? ""),
    leadId: Number(deal.leadId) || 0,
    customerName: String(deal.customerName ?? "").trim() || "Unknown",
    dealValue: Number(deal.dealValue) || 0,
    preBookingAmount: Number(deal.preBookingAmount) || 0,
    paymentKind: deal.paymentKind ?? "",
    tokenStatus: deal.tokenStatus ?? "",
    bookingStatus: deal.bookingStatus ?? "",
    submittedAt: deal.submittedAt || new Date(0).toISOString(),
    listingType,
    assign: deal.assign ?? deal.assignee ?? null,
    assignee: deal.assignee ?? deal.assign ?? null,
  };
}

function listingBadge(listingType: string) {
  const t = listingType.trim().toLowerCase();
  if (t === "cancel") {
    return (
      <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700">
        Cancel
      </span>
    );
  }
  if (t === "booking") {
    return (
      <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
        Booking
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
      Token
    </span>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export default function BookingTokenGlobalSearch() {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeqRef = useRef(0);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<DealRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<BookingPaymentPanelMode>("view");
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    const seq = ++requestSeqRef.current;
    if (q.length < MIN_Q) {
      if (seq === requestSeqRef.current) {
        setRows([]);
        setTotalElements(0);
        setError("");
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await fetchBookingTokenGlobalSearch({
        q,
        page: 0,
        size: PAGE_SIZE,
      });
      if (seq !== requestSeqRef.current) return;
      const deals = Array.isArray(result.deals) ? result.deals : [];
      setRows(
        deals.map((deal: BookingTokenDeal) =>
          bookingTokenDealToDealRow(normalizeSearchDeal(deal)),
        ),
      );
      const total = Number(result.totalElements);
      setTotalElements(Number.isFinite(total) && total >= 0 ? total : deals.length);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setRows([]);
      setTotalElements(0);
      setError(err instanceof Error ? err.message : "Unable to search deals.");
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void runSearch(debounced);
  }, [debounced, open, runSearch]);

  const openDeal = (row: DealRow) => {
    if (!row.id) return;
    setSelectedDeal(row);
    setPanelMode("view");
    setPanelOpen(true);
    setOpen(false);
  };

  const showPanel = open && (query.trim().length > 0 || rows.length > 0 || loading || error);

  return (
    <>
      <BookingPaymentPanel
        open={panelOpen}
        mode={panelMode}
        deal={selectedDeal}
        onClose={() => {
          setPanelOpen(false);
          setSelectedDeal(null);
        }}
        onUpdated={() => {
          if (debounced.length >= MIN_Q) void runSearch(debounced);
        }}
      />

      <div ref={rootRef} className="relative w-full min-w-[220px] max-w-md flex-1 sm:min-w-[280px]">
        <label className="sr-only" htmlFor={listId}>
          Global search across token, booking, and cancel
        </label>
        <div
          className={`flex items-center gap-2 rounded-xl border bg-[var(--bt-surface)] px-3 py-2 shadow-sm transition ${
            open
              ? "border-slate-400 ring-2 ring-slate-900/10"
              : "border-[var(--bt-border)] hover:border-slate-300"
          }`}
        >
          <SearchIcon className="shrink-0 text-[var(--bt-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
              Global search
            </p>
            <input
              ref={inputRef}
              id={listId}
              type="search"
              value={query}
              autoComplete="off"
              spellCheck={false}
              placeholder="Name, phone, or Easebuzz txn id"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              className="w-full bg-transparent text-[13px] font-medium text-[var(--bt-text)] outline-none placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDebounced("");
                setRows([]);
                setError("");
                inputRef.current?.focus();
              }}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--bt-muted)] hover:bg-slate-100 hover:text-[var(--bt-text)]"
            >
              Clear
            </button>
          ) : null}
        </div>

        {showPanel ? (
          <div
            role="listbox"
            aria-label="Global search results"
            className="absolute left-0 right-0 z-50 mt-2 max-h-[min(420px,70vh)] overflow-hidden rounded-xl border border-[var(--bt-border)] bg-white shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--bt-border)] bg-slate-50/90 px-3 py-2">
              <p className="text-[11px] font-semibold text-[var(--bt-muted)]">
                Token · Booking · Cancel
              </p>
              {totalElements > 0 && !loading ? (
                <p className="text-[11px] tabular-nums text-[var(--bt-text)]">
                  {totalElements} match{totalElements === 1 ? "" : "es"}
                </p>
              ) : null}
            </div>

            <div className="max-h-[min(360px,60vh)] overflow-y-auto">
              {query.trim().length > 0 && query.trim().length < MIN_Q ? (
                <p className="px-4 py-6 text-center text-[13px] text-[var(--bt-muted)]">
                  Type at least {MIN_Q} characters
                </p>
              ) : loading ? (
                <p className="px-4 py-6 text-center text-[13px] text-[var(--bt-muted)]">
                  Searching…
                </p>
              ) : error ? (
                <p className="px-4 py-6 text-center text-[13px] text-red-600">{error}</p>
              ) : rows.length === 0 && debounced.length >= MIN_Q ? (
                <p className="px-4 py-6 text-center text-[13px] text-[var(--bt-muted)]">
                  No deals match “{debounced}”
                </p>
              ) : rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-[var(--bt-muted)]">
                  Search token, booking, and cancel together
                </p>
              ) : (
                <ul className="divide-y divide-[var(--bt-border)]">
                  {rows
                    .filter((row) => Boolean(row.id))
                    .map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => openDeal(row)}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                          {row.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-[var(--bt-text)]">
                              {row.customer}
                            </span>
                            {listingBadge(row.listingType)}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[var(--bt-muted)]">
                            {[row.leadIdentifier || `Lead #${row.leadId}`, row.assign]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-500">
                            {row.dealValue}
                            {row.asset ? ` · ${row.asset}` : ""}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {totalElements > rows.length ? (
              <p className="border-t border-[var(--bt-border)] px-3 py-2 text-center text-[11px] text-[var(--bt-muted)]">
                Showing first {rows.length} of {totalElements}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
