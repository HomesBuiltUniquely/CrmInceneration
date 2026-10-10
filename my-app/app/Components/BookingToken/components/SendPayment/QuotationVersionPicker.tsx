"use client";

import {
  formatQuoteAmount,
  resolveQuoteVerifyUrl,
  sortQuotesForRevisionDisplay,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import { formatCrmDateTime } from "@/lib/date-time-format";
import type { QuoteLoadState } from "../BookingQuoteVersionPicker";

type Props = {
  loadState: QuoteLoadState;
  error: string;
  options: LeadQuoteOption[];
  hubLeadId: string;
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  dealQuoteId?: string | null;
  amountRefreshing?: boolean;
  disabled?: boolean;
  fieldError?: string;
};

function formatQuoteCreatedAt(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatCrmDateTime(value);
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function matchesDealQuote(option: LeadQuoteOption, dealQuoteId?: string | null): boolean {
  const locked = dealQuoteId?.trim();
  if (!locked) return false;
  return option.quoteId === locked || option.id === locked;
}

/** Compact quotation picker — no inner scroll; titles stay bold dark for scan. */
export default function QuotationVersionPicker({
  loadState,
  error,
  options,
  hubLeadId,
  selectedQuoteId,
  onSelectQuote,
  dealQuoteId,
  amountRefreshing = false,
  disabled = false,
  fieldError,
}: Props) {
  const revisionOptions = sortQuotesForRevisionDisplay(options);
  const latestOption = options.find((option) => option.isLatest) ?? null;
  const latestDiffersFromDeal =
    latestOption != null && !matchesDealQuote(latestOption, dealQuoteId);

  return (
    <section className="shrink-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#0F172A]">
          Quotation version
        </p>
        {latestDiffersFromDeal ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-800">
            Newer
          </span>
        ) : null}
      </div>

      {loadState === "loading" ? (
        <p className="mt-1.5 text-[12px] text-[#5B6778]">Loading quotations…</p>
      ) : null}
      {loadState === "error" ? (
        <p className="mt-1.5 rounded-[12px] border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1.5 text-[12px] text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      {loadState === "empty" ? (
        <p className="mt-1.5 rounded-[12px] border border-[#E3E8EE] bg-white px-2.5 py-1.5 text-[12px] text-[#5B6778]">
          No quotation found for this lead yet.
        </p>
      ) : null}

      {loadState === "ready" && revisionOptions.length > 0 ? (
        <div
          role="radiogroup"
          aria-label="Quotation version"
          className="sp-stagger mt-1.5 space-y-1.5"
        >
          {revisionOptions.map((option, index) => {
            const selected = option.id === selectedQuoteId;
            const isLatest = Boolean(option.isLatest);
            const onDeal = matchesDealQuote(option, dealQuoteId);
            const quoteUrl = resolveQuoteVerifyUrl(option, hubLeadId);
            const versionLabel =
              option.version != null ? `V${option.version}` : option.label;
            return (
              <button
                key={`${option.id}-${option.version ?? index}-${index}`}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onSelectQuote(option.id)}
                className={`sp-card relative w-full rounded-[12px] border px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "sp-card-selected border-[#0F172A] bg-white"
                    : "border-[#CBD3DD] bg-white hover:border-[#0F172A]/55"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <p className="text-[12px] font-bold text-[#0F172A]">{versionLabel}</p>
                      {isLatest ? (
                        <span className="rounded-full bg-[#E7F6EF] px-1 py-px text-[8px] font-bold uppercase tracking-wide text-[#047857]">
                          Latest
                        </span>
                      ) : null}
                      {onDeal ? (
                        <span className="rounded-full bg-[#F1F5F9] px-1 py-px text-[8px] font-bold uppercase tracking-wide text-[#5B6778]">
                          On deal
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-[#5B6778]">
                      {formatQuoteCreatedAt(option.createdAt)}
                      {option.quoteId ? ` · ${option.quoteId}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={`sp-check inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                        selected
                          ? "sp-check-on border-[#0F172A] bg-[#0F172A] text-white"
                          : "sp-check-off border-[#CBD3DD] bg-white"
                      }`}
                      aria-hidden
                    >
                      {selected ? (
                        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none">
                          <path
                            d="M3.5 8.2 6.4 11l6-6.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <p className="text-[12px] font-bold tabular-nums text-[#0F172A]">
                      {amountRefreshing && selected
                        ? "…"
                        : formatQuoteAmount(option.amount)}
                    </p>
                    {quoteUrl ? (
                      <a
                        href={quoteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="text-[10px] font-semibold text-[#047857] hover:underline"
                      >
                        Open →
                      </a>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {fieldError ? (
        <p className="mt-1.5 text-[11px] text-[#b91c1c]" role="alert" aria-live="polite">
          {fieldError}
        </p>
      ) : null}
    </section>
  );
}
