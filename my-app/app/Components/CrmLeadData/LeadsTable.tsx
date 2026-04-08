"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { leads } from "@/lib/data";
import { getStoredLeadStatus, LEAD_STATUS_EVENT } from "@/lib/lead-status";
import type { LeadRowModel } from "@/lib/leads-filter";

type ChipTone = "blue" | "green" | "amber" | "rose" | "slate";

type Chip = { label: string; tone: ChipTone };

function ChipPill({ chip }: { chip: Chip }) {
  const cls =
    chip.tone === "blue"
      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
      : chip.tone === "green"
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        : chip.tone === "amber"
          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
          : chip.tone === "rose"
            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
            : "bg-slate-100 text-slate-600";

  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{chip.label}</span>;
}

function ProgressBar({ pct, tone }: { pct: number; tone: "normal" | "critical" }) {
  const bar = tone === "critical" ? "bg-rose-500" : "bg-blue-600";
  return (
    <div className="h-1.5 w-28 rounded-full bg-slate-200">
      <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

function StatusInline({ status }: { status: NonNullable<LeadRowModel["journey"]["status"]> }) {
  const cls =
    status.tone === "critical"
      ? "text-rose-600"
      : "text-amber-700";
  return (
    <div className={`mt-1 text-[10px] font-semibold ${cls}`}>
      {status.label}
    </div>
  );
}

function OwnerAvatar() {
  return <div className="h-7 w-7 rounded-full bg-slate-200 ring-2 ring-white" />;
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13 2 3 14h7l-1 8 12-14h-7l-1-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertButton({
  onClick,
}: {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm hover:bg-rose-600"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function LeadRow({ row }: { row: LeadRowModel }) {
  const router = useRouter();
  const critical = row.journey.status?.tone === "critical";

  return (
    <div
      onClick={() => router.push(`/Leads/${row.leadType}/${row.id}`)}
      className="grid cursor-pointer grid-cols-12 items-center gap-3 border-t border-slate-100 px-6 py-4 transition-colors hover:bg-slate-50"
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/Leads/${row.leadType}/${row.id}`);
        }
      }}
    >
      <div className="col-span-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-slate-200" />
        <div className="leading-tight">
          <div className="text-[12px] font-semibold text-slate-800">{row.name}</div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">{row.company}</div>
        </div>
      </div>

      <div className="col-span-3">
        {row.statusLabel ? <ChipPill chip={{ label: row.statusLabel, tone: "green" }} /> : null}
      </div>

      <div className="col-span-2">
        <div className="text-[10px] font-bold tracking-wide text-slate-400">{row.journey.stage}</div>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar pct={row.journey.progressPct} tone={critical ? "critical" : "normal"} />
          <div className="text-[10px] font-semibold text-slate-400">{row.journey.progressLabel}</div>
        </div>
        {row.journey.status ? <StatusInline status={row.journey.status} /> : null}
      </div>

      <div className="col-span-2 flex items-center gap-2">
        <OwnerAvatar />
        <div className="text-[12px] font-semibold text-slate-700">{row.owner.name}</div>
      </div>

      <div className="col-span-2">
        <div className={`text-[11px] font-semibold ${row.engagement.tone === "late" ? "text-rose-600" : "text-slate-500"}`}>
          {row.engagement.time}
        </div>
        <div className="mt-1 text-[11px] font-semibold text-slate-700">{row.engagement.action}</div>
      </div>

      <div className="col-span-0 flex justify-end">
        {row.actionIcon === "alert" ? (
          <AlertButton
            onClick={(event) => {
              event?.stopPropagation?.();
            }}
          />
        ) : (
          <button
            onClick={(event) => event.stopPropagation()}
            className="rounded-xl p-2 hover:bg-slate-50"
          >
            <BoltIcon />
          </button>
        )}
      </div>
    </div>
  );
}

export function LeadsPagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
}) {
  const safeTotal = Math.max(1, totalPages);
  const maxVisible = 7;
  const start = Math.max(0, Math.min(page - Math.floor(maxVisible / 2), Math.max(0, safeTotal - maxVisible)));
  const end = Math.min(safeTotal, start + maxVisible);
  const pages = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
      <div className="flex items-center gap-1 text-[12px]">
        <button
          type="button"
          disabled={disabled || page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        {pages.map((p) => {
          const active = p === page;
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(p)}
              className={`h-8 min-w-8 rounded-full px-2 font-semibold ${
                active
                  ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p + 1}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled || page >= safeTotal - 1}
          onClick={() => onPageChange(Math.min(safeTotal - 1, page + 1))}
          className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold text-slate-400">Rows</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700"
        >
          {[20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

type LeadsTableProps = {
  rows: LeadRowModel[];
  loading?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
};

export default function LeadsTable({
  rows: rowsProp,
  loading,
  page = 0,
  totalPages = 1,
  onPageChange,
  pageSize = 20,
  onPageSizeChange,
}: LeadsTableProps) {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    const readOverrides = () => {
      const nextOverrides = leads.reduce<Record<string, string>>((result, lead) => {
        result[lead.id] = getStoredLeadStatus(lead.id, lead.status);
        return result;
      }, {});

      setStatusOverrides(nextOverrides);
    };

    readOverrides();

    const handleStatusUpdate = () => {
      readOverrides();
    };

    window.addEventListener(LEAD_STATUS_EVENT, handleStatusUpdate);
    window.addEventListener("storage", handleStatusUpdate);

    return () => {
      window.removeEventListener(LEAD_STATUS_EVENT, handleStatusUpdate);
      window.removeEventListener("storage", handleStatusUpdate);
    };
  }, []);

  const rows = rowsProp.map((row) => {
    const nextStatus = statusOverrides[row.id];
    return {
      ...row,
      statusLabel: nextStatus ?? row.statusLabel,
    };
  });

  const showPagination = onPageChange && onPageSizeChange;

  return (
    <section className="mx-auto mt-5 max-w-[1200px] px-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 bg-slate-50 px-6 py-4 text-[10px] font-bold tracking-wide text-slate-400">
          <div className="col-span-3">LEAD NAME</div>
          <div className="col-span-3">STATUS</div>
          <div className="col-span-2">JOURNEY TRACK</div>
          <div className="col-span-2">OWNER</div>
          <div className="col-span-2">ENGAGEMENT</div>
          <div className="col-span-0 text-right">ACTIONS</div>
        </div>
        {loading ? (
          <div className="border-t border-slate-100 px-6 py-10 text-center text-[12px] text-slate-500">
            Loading leads…
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-slate-100 px-6 py-10 text-center text-[12px] text-slate-500">
            No leads found.
          </div>
        ) : (
          rows.map((r) => <LeadRow key={r.id} row={r} />)
        )}
        {showPagination ? (
          <LeadsPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            disabled={loading}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </div>
    </section>
  );
}
