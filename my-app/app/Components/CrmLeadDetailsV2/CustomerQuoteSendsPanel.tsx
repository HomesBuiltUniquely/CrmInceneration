"use client";

import { formatQuoteAmount } from "@/lib/crm-quote-links";
import {
  resolveGroupedCustomerQuoteSends,
  type GroupedCustomerQuoteSend,
} from "@/lib/customer-quote-sends";
import { formatCrmDateTime } from "@/lib/date-time-format";
import type { QuoteSentInfo } from "@/lib/quote-sent-info";

type Props = {
  quoteSentInfo?: QuoteSentInfo | null;
  quoteSentCount?: number;
  quoteLink?: string | null;
  quoteId?: string | null;
  className?: string;
  /** Compact layout for Quote desk header (right blank space). */
  compact?: boolean;
};

function versionTitle(row: GroupedCustomerQuoteSend): string {
  if (row.versionNumber != null && row.versionNumber > 0) {
    return `Version ${row.versionNumber}`;
  }
  if (row.quoteId) return `Quote #${row.quoteId}`;
  return "Quote";
}

function formatSentWhen(value: string | null): string {
  if (!value) return "-";
  return formatCrmDateTime(value);
}

export default function CustomerQuoteSendsPanel({
  quoteSentInfo,
  quoteSentCount = 0,
  quoteLink,
  quoteId,
  className = "",
  compact = false,
}: Props) {
  const grouped = resolveGroupedCustomerQuoteSends({
    quoteSentInfo,
    quoteSentCount,
    quoteLink,
    quoteId,
  });

  if (grouped.length === 0) {
    if (compact) return null;
    return (
      <section
        className={`rounded-xl border border-dashed border-[#dfe6ef] bg-[#fbfcff] px-4 py-3 ${className}`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
          Sent to customer
        </p>
        <p className="mt-2 text-[12px] text-[#94a3b8]">
          No quote emailed yet. Versions appear here after you send.
        </p>
      </section>
    );
  }

  if (compact) {
    const hasMany = grouped.length > 2;
    return (
      <div className={`w-[260px] max-w-full ${className}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c3aed]">
            Versions sent
          </p>
          <span className="rounded-full bg-[#f3e8ff] px-2 py-1 text-[10px] font-bold text-[#6d28d9]">
            {grouped.length}
          </span>
        </div>
        {/* Stacked list: grows for 1–2 rows, then scrolls so 3+ versions still fit */}
        <div className="overflow-hidden rounded-xl border border-[#e4ddf7] bg-white shadow-sm">
          <ul
            className={`divide-y divide-[#f1eef8] overflow-y-auto overscroll-contain [scrollbar-width:thin] ${
              hasMany ? "max-h-44" : ""
            }`}
          >
            {grouped.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-[#1f2937]">
                    {versionTitle(row)}
                    {row.sendCount > 1 ? (
                      <span className="ml-1 font-semibold text-[#6366f1]">
                        {` · ${row.sendCount}x`}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[10px] text-[#64748b]">
                    {formatSentWhen(row.lastSentAt)}
                  </p>
                </div>
                {row.isCurrentLink ? (
                  <span className="shrink-0 rounded bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                    Current
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {hasMany ? (
            <p className="border-t border-[#f1eef8] bg-[#faf8ff] px-3 py-1 text-center text-[9px] font-medium text-[#7c3aed]">
              Scroll for more versions
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section
      className={`flex min-h-0 flex-col rounded-xl border border-[#e8edf4] bg-[#fbfcff] ${className}`}
    >
      <div className="border-b border-[#edf1f6] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
          Sent to customer
        </p>
        <p className="mt-1 text-[11px] text-[#94a3b8]">
          Grouped by version - only emails you sent
        </p>
      </div>
      <ul className="max-h-[220px] overflow-y-auto px-2 py-2">
        {grouped.map((row) => (
          <li
            key={row.key}
            className="rounded-lg px-2 py-2 transition-colors hover:bg-white/80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#0f172a]">{versionTitle(row)}</p>
                <p className="mt-1 text-[11px] text-[#64748b]">
                  {formatSentWhen(row.lastSentAt)}
                  {row.lastSentBy ? ` · ${row.lastSentBy}` : ""}
                </p>
                {row.quotedAmount != null ? (
                  <p className="mt-1 text-[12px] font-semibold text-[#334155]">
                    {formatQuoteAmount(row.quotedAmount)}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {row.isCurrentLink ? (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    Current
                  </span>
                ) : null}
                {row.sendCount > 1 ? (
                  <span className="rounded-md bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#4338ca]">
                    {`Sent ${row.sendCount}x`}
                  </span>
                ) : null}
              </div>
            </div>
            {row.versionNumber == null && row.quoteId ? (
              <p className="mt-1 text-[10px] text-[#94a3b8]">
                Older send (version not recorded)
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
