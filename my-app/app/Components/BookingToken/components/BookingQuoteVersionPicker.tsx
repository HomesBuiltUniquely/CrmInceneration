"use client";

import {
  formatQuoteAmount,
  resolveQuoteVerifyUrl,
  sortQuotesForRevisionDisplay,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import { formatCrmDateTime } from "@/lib/date-time-format";

export type QuoteLoadState = "idle" | "loading" | "ready" | "empty" | "error";

type Props = {
  loadState: QuoteLoadState;
  error: string;
  options: LeadQuoteOption[];
  hubLeadId: string;
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  selectedQuote: LeadQuoteOption | null;
  /** Deal's currently locked quote — used to mark "current on deal". */
  dealQuoteId?: string | null;
  amountRefreshing?: boolean;
  disabled?: boolean;
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

export default function BookingQuoteVersionPicker({
  loadState,
  error,
  options,
  hubLeadId,
  selectedQuoteId,
  onSelectQuote,
  selectedQuote,
  dealQuoteId,
  amountRefreshing = false,
  disabled = false,
}: Props) {
  const revisionOptions = sortQuotesForRevisionDisplay(options);
  const latestOption = options.find((option) => option.isLatest) ?? null;
  const latestDiffersFromDeal =
    latestOption != null && !matchesDealQuote(latestOption, dealQuoteId);

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
            Quotation version
          </p>
          <p className="mt-1 text-[12px] text-[#64748b]">
            Select the quote for remaining pay. 10% and due amount update live.
          </p>
        </div>
        {latestDiffersFromDeal ? (
          <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            Newer available
          </span>
        ) : null}
      </div>

      {loadState === "loading" ? (
        <p className="mt-3 text-[13px] text-[#64748b]">Loading quotations…</p>
      ) : null}
      {loadState === "error" ? (
        <p className="mt-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      {loadState === "empty" ? (
        <p className="mt-3 rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#64748b]">
          No quotation found for this lead yet.
        </p>
      ) : null}

      {loadState === "ready" && revisionOptions.length > 0 ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {revisionOptions.map((option, index) => {
              const selected = option.id === selectedQuoteId;
              const isLatest = Boolean(option.isLatest);
              const onDeal = matchesDealQuote(option, dealQuoteId);
              const quoteUrl = resolveQuoteVerifyUrl(option, hubLeadId);
              return (
                <div
                  key={`${option.id}-${option.version ?? index}-${index}`}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  onClick={() => {
                    if (!disabled) onSelectQuote(option.id);
                  }}
                  onKeyDown={(event) => {
                    if (disabled) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectQuote(option.id);
                    }
                  }}
                  className={`block rounded-xl border px-3 py-2.5 text-left transition ${
                    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  } ${
                    selected
                      ? "border-[#86efac] bg-[#ecfdf5] shadow-[inset_4px_0_0_#16a34a]"
                      : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[14px] font-bold text-[#0f172a]">{option.label}</p>
                    {isLatest ? (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                        Latest
                      </span>
                    ) : null}
                    {onDeal ? (
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                        On deal
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#64748b]">
                    Created on {formatQuoteCreatedAt(option.createdAt)}
                  </p>
                  {option.quoteId ? (
                    <p className="mt-0.5 text-[11px] text-[#64748b]">ID {option.quoteId}</p>
                  ) : null}
                  <p className="mt-2 text-[16px] font-bold text-[#0f172a]">
                    {formatQuoteAmount(option.amount)}
                  </p>
                  {quoteUrl ? (
                    <a
                      href={quoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1.5 inline-block text-[11px] font-semibold uppercase tracking-wide text-[#047857] hover:underline"
                    >
                      Open quotation →
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>

          {selectedQuote ? (
            <div className="rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#047857]">
                Selected for payment
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[#065f46]">
                {selectedQuote.label}
                {" · "}
                {amountRefreshing ? "Loading amount…" : formatQuoteAmount(selectedQuote.amount)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
