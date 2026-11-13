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
};

function versionTitle(row: GroupedCustomerQuoteSend): string {
  if (row.versionNumber != null && row.versionNumber > 0) {
    return `Version ${row.versionNumber}`;
  }
  if (row.quoteId) return `Quote #${row.quoteId}`;
  return "Quote";
}

function formatSentWhen(value: string | null): string {
  if (!value) return "—";
  return formatCrmDateTime(value);
}

export default function CustomerQuoteSendsPanel({
  quoteSentInfo,
  quoteSentCount = 0,
  quoteLink,
  quoteId,
  className = "",
}: Props) {
  const grouped = resolveGroupedCustomerQuoteSends({
    quoteSentInfo,
    quoteSentCount,
    quoteLink,
    quoteId,
  });

  if (grouped.length === 0) {
    return (
      <section
        className={`rounded-xl border border-dashed border-[#dfe6ef] bg-[#fbfcff] px-4 py-3 ${className}`}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
          Sent to customer
        </p>
        <p className="mt-2 text-[12px] text-[#94a3b8]">
          No quote emailed yet. Versions appear here after you send.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`flex min-h-0 flex-col rounded-xl border border-[#e8edf4] bg-[#fbfcff] ${className}`}
    >
      <div className="border-b border-[#edf1f6] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#475569]">
          Sent to customer
        </p>
        <p className="mt-0.5 text-[11px] text-[#94a3b8]">
          Grouped by version · only emails you sent
        </p>
      </div>
      <ul className="max-h-[220px] overflow-y-auto px-2 py-2">
        {grouped.map((row) => (
          <li
            key={row.key}
            className="rounded-lg px-2 py-2.5 transition-colors hover:bg-white/80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#0f172a]">{versionTitle(row)}</p>
                <p className="mt-0.5 text-[11px] text-[#64748b]">
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
                    Sent {row.sendCount}×
                  </span>
                ) : null}
              </div>
            </div>
            {row.versionNumber == null && row.quoteId ? (
              <p className="mt-1 text-[10px] text-[#94a3b8]">Older send (version not recorded)</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
