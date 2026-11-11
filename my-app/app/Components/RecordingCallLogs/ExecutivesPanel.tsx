"use client";

import { cn } from "@/lib/cn";
import { formatDurationLabel } from "@/lib/recording-call-logs/format";
import type { SummaryExecutiveRow } from "@/lib/recording-call-logs/executive";

type Props = {
  rows: SummaryExecutiveRow[];
  loading?: boolean;
  onExecutiveTap: (row: SummaryExecutiveRow) => void;
};

/** Mobile Summary → By executive panel parity. */
export default function ExecutivesPanel({
  rows,
  loading,
  onExecutiveTap,
}: Props) {
  return (
    <section className="mt-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F0FE] text-[#1D4ED8]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M4 18.5C4.8 16 6.7 14.5 9 14.5C11.3 14.5 13.2 16 14 18.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M15.2 18.5C15.7 16.9 16.9 15.9 18.5 15.6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-[#14171F]">By executive</h2>
            {rows.length > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-[#EEF2F7] px-2 text-[12px] font-bold text-[#14171F]">
                {rows.length}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] text-[#8A94A6]">
            Team under your scope · tap for full summary
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white px-4 py-12 text-center text-[13px] font-medium text-[#8A94A6]">
          Loading executives…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white px-4 py-12 text-center text-[13px] font-medium text-[#8A94A6]">
          No executives found for your role mapping.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const name = row.person.displayName.trim();
            const initial = name ? name[0]!.toUpperCase() : "?";
            const callDur =
              row.callTalkSec > 0
                ? formatDurationLabel(row.callTalkSec)
                : "--:--";
            const recDur =
              row.recordingTalkSec > 0
                ? formatDurationLabel(row.recordingTalkSec)
                : "--:--";

            return (
              <li key={`${row.person.displayName}-${row.person.userId}`}>
                <button
                  type="button"
                  onClick={() => onExecutiveTap(row)}
                  className={cn(
                    "flex w-full flex-col gap-3 rounded-2xl border border-[#E6EAF0] bg-white p-3.5 text-left",
                    "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition",
                    "hover:border-[#C9D3E0] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] text-[14px] font-bold text-[#1D4ED8]">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-[#14171F]">
                        {row.person.displayName}
                      </p>
                      <p className="text-[11px] font-medium text-[#8A94A6]">
                        {row.person.isPresales
                          ? "Presales executive"
                          : "Sales executive"}
                      </p>
                    </div>
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 shrink-0 text-[#8A94A6]"
                      fill="none"
                    >
                      <path
                        d="M7.5 4.5L13 10L7.5 15.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatChip
                      label="Calls"
                      value={String(row.callCount)}
                      meta={`${callDur} talk`}
                    />
                    <StatChip
                      label="Recordings"
                      value={String(row.recordingCount)}
                      meta={`${recDur} talk`}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatChip({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[10px] bg-[#F1F4F8] px-2.5 py-2">
      <p className="text-[11px] font-medium text-[#8A94A6]">{label}</p>
      <p className="mt-1 text-[18px] font-bold leading-none text-[#1D4ED8]">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] font-medium tabular-nums text-[#14171F]">
        {meta}
      </p>
    </div>
  );
}
