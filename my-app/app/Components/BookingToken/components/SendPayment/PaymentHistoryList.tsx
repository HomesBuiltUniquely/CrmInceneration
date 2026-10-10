"use client";

import type { PaymentHistoryEntry } from "@/lib/booking-payment-history-api";
import { formatQuoteAmount } from "@/lib/crm-quote-links";
import {
  formatPaymentKind,
  formatPaymentSource,
  isEasebuzzPayment,
} from "@/lib/booking-payment-display";
import { formatFormSubmittedAt } from "@/lib/booking-token-display-format";

export type HistoryFilter = "all" | "online" | "offline";

type Props = {
  loading: boolean;
  history: PaymentHistoryEntry[];
  paymentCount: number;
  proofCount: number;
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  selectedEntryId: string;
  onSelectEntry: (id: string) => void;
  showFilters?: boolean;
};

export default function PaymentHistoryList({
  loading,
  history,
  paymentCount,
  proofCount,
  filter,
  onFilterChange,
  selectedEntryId,
  onSelectEntry,
  showFilters = true,
}: Props) {
  return (
    <section className="flex min-h-[220px] flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#0F172A]">
          Payment history
        </p>
        <p className="text-[11px] text-[#5B6778]">
          {paymentCount} payment{paymentCount === 1 ? "" : "s"}
          {proofCount > 0
            ? ` · ${proofCount} proof${proofCount === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>

      {showFilters ? (
        <div
          className="mt-1.5 flex shrink-0 flex-wrap gap-1"
          role="group"
          aria-label="History filter"
        >
          {(
            [
              ["all", "All"],
              ["online", "Online"],
              ["offline", "Proof"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onFilterChange(id)}
              className={`sp-chip min-h-8 rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 ${
                filter === id
                  ? "border-[#047857] bg-[#E7F6EF] text-[#047857]"
                  : "border-[#E3E8EE] bg-white text-[#5B6778] hover:border-[#CBD3DD]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
        {loading ? (
          <p className="py-3 text-[13px] text-[#5B6778]">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="py-3 text-[13px] text-[#5B6778]">
            {paymentCount === 0 ? "No payments recorded yet." : "No payments in this filter."}
          </p>
        ) : (
          <ul className="sp-stagger space-y-1.5 pb-1">
            {history.map((entry) => {
              const selected = entry.id === selectedEntryId;
              const source = formatPaymentSource(entry.source);
              const kind = formatPaymentKind(entry.paymentKind);
              const isToken = kind.toUpperCase().includes("TOKEN");
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(entry.id)}
                    className={`sp-card w-full rounded-[12px] border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 ${
                      selected
                        ? "sp-card-selected border-[#047857] bg-white"
                        : "border-[#E3E8EE] bg-white hover:border-[#CBD3DD]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-bold text-[#0F172A]">
                        Payment {entry.sequence} · {formatQuoteAmount(entry.amount)}
                      </p>
                      {isToken ? (
                        <span className="rounded-full bg-[#E7F6EF] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#047857]">
                          Token
                        </span>
                      ) : isEasebuzzPayment(entry) ? (
                        <span className="rounded-full bg-[#E7F6EF] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#047857]">
                          Online
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#5B6778]">
                      {formatFormSubmittedAt(entry.createdAt)}
                      {source ? ` · ${source}` : ""}
                      {entry.recordedBy ? ` · by ${entry.recordedBy}` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
