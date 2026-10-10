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
    <section>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
          Quotation version
        </p>
        {latestDiffersFromDeal ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
            Newer available
          </span>
        ) : null}
      </div>

      {loadState === "loading" ? (
        <p className="mt-2 text-[13px] text-[#5B6778]">Loading quotations…</p>
      ) : null}
      {loadState === "error" ? (
        <p className="mt-2 rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      {loadState === "empty" ? (
        <p className="mt-2 rounded-[14px] border border-[#E3E8EE] bg-white px-3 py-2 text-[13px] text-[#5B6778]">
          No quotation found for this lead yet.
        </p>
      ) : null}

      {loadState === "ready" && revisionOptions.length > 0 ? (
        <div role="radiogroup" aria-label="Quotation version" className="mt-2 space-y-2">
          {revisionOptions.map((option, index) => {
            const selected = option.id === selectedQuoteId;
            const isLatest = Boolean(option.isLatest);
            const onDeal = matchesDealQuote(option, dealQuoteId);
            const quoteUrl = resolveQuoteVerifyUrl(option, hubLeadId);
            const versionLabel =
              option.version != null ? `Version ${option.version}` : option.label;
            return (
              <button
                key={`${option.id}-${option.version ?? index}-${index}`}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onSelectQuote(option.id)}
                className={`relative w-full rounded-2xl border-2 px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "border-[#047857] bg-white shadow-[0_10px_24px_-12px_rgba(4,120,87,0.5)]"
                    : "border-[#E3E8EE] bg-white hover:border-[#CBD3DD]"
                }`}
              >
                <span
                  className={`absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-[#047857] bg-[#047857] text-white"
                      : "border-[#CBD3DD] bg-white"
                  }`}
                  aria-hidden
                >
                  {selected ? (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
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
                <div className="flex flex-wrap items-center gap-1.5 pr-7">
                  <p className="text-[14px] font-bold text-[#0F172A]">{versionLabel}</p>
                  {isLatest ? (
                    <span className="rounded-full bg-[#E7F6EF] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#047857]">
                      Latest
                    </span>
                  ) : null}
                  {onDeal ? (
                    <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5B6778]">
                      On deal
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] text-[#5B6778]">
                  {formatQuoteCreatedAt(option.createdAt)}
                  {option.quoteId ? ` · ID ${option.quoteId}` : ""}
                </p>
                <p className="mt-2 text-[16px] font-bold tabular-nums text-[#0F172A]">
                  {amountRefreshing && selected
                    ? "Loading…"
                    : formatQuoteAmount(option.amount)}
                </p>
                {quoteUrl ? (
                  <a
                    href={quoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-1.5 inline-block text-[11px] font-semibold text-[#047857] hover:underline"
                  >
                    Open quotation →
                  </a>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {fieldError ? (
        <p className="mt-2 text-[12px] text-[#b91c1c]" role="alert" aria-live="polite">
          {fieldError}
        </p>
      ) : null}
    </section>
  );
}
