"use client";

import { formatQuoteAmount } from "@/lib/crm-quote-links";

type Props = {
  totalAmount: number;
  bookingAmount10: number;
  amountPaid: number;
  remaining10: number;
};

export default function SummaryStats({
  totalAmount,
  bookingAmount10,
  amountPaid,
  remaining10,
}: Props) {
  const pct =
    bookingAmount10 > 0
      ? Math.min(100, Math.round((amountPaid / bookingAmount10) * 100))
      : amountPaid > 0
        ? 100
        : 0;

  return (
    <div className="shrink-0 border-b border-[#E3E8EE] px-4 py-2.5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E3E8EE] bg-[#F7F9FA] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
            Total amount
          </p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums text-[#0F172A]">
            {formatQuoteAmount(totalAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E3E8EE] bg-[#F7F9FA] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
            10% booking amount
          </p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums text-[#0F172A]">
            {formatQuoteAmount(bookingAmount10)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#E7F6EF] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
            Amount paid
          </p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums text-[#047857]">
            {formatQuoteAmount(amountPaid)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#065F46] bg-[#065F46] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/80">
            Remaining (10%)
          </p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums text-white">
            {formatQuoteAmount(remaining10)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E3E8EE]">
          <div
            className="h-full rounded-full bg-[#065F46] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of booking amount paid`}
          />
        </div>
        <p className="shrink-0 text-[11px] font-semibold text-[#5B6778]">
          {pct}% of booking amount paid
        </p>
      </div>
    </div>
  );
}
