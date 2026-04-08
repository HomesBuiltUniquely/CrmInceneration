"use client";

import { useEffect, useRef, useState } from "react";
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


type LeadRowActionProps = {
  row: LeadRowModel;
  selected: boolean;
  onToggleSelected: (checked: boolean) => void;
  onDelete?: (row: LeadRowModel) => void;
  onAssign?: (row: LeadRowModel) => void;
};

function LeadRowAction({
  row,
  selected,
  onToggleSelected,
  onDelete,
  onAssign,
}: LeadRowActionProps) {
  const router = useRouter();
  const critical = row.journey.status?.tone === "critical";
  return (
    <div
      onClick={() => router.push(`/Leads/${row.leadType}/${row.id}`)}
      className={`group grid cursor-pointer grid-cols-12 items-center gap-3 border-t border-slate-100 px-6 py-4 transition-all hover:bg-blue-50/40 ${
        selected ? "bg-blue-50/60 ring-1 ring-inset ring-blue-100" : ""
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/Leads/${row.leadType}/${row.id}`);
        }
      }}
    >
      <div className="col-span-1 flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onToggleSelected(event.target.checked)}
          className="h-4 w-4 cursor-pointer accent-blue-600"
        />
      </div>
      <div className="col-span-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 shadow-inner" />
        <div className="leading-tight">
          <div className="text-[12px] font-semibold text-slate-800">{row.name}</div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">{row.company}</div>
        </div>
      </div>

      <div className="col-span-2">
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

      <div className="col-span-1">
        <div className={`text-[11px] font-semibold ${row.engagement.tone === "late" ? "text-rose-600" : "text-slate-500"}`}>
          {row.engagement.time}
        </div>
        <div className="mt-1 text-[11px] font-semibold text-slate-700">{row.engagement.action}</div>
      </div>

      <div className="col-span-1 flex justify-end gap-2">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onAssign?.(row);
          }}
          className="rounded-xl border border-blue-200 px-2 py-1 text-[10px] font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-100"
        >
          Assign
        </button>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(row);
          }}
          className="rounded-xl border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100"
        >
          Delete
        </button>
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
  selectedRowIds?: string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;
  onDeleteRow?: (row: LeadRowModel) => void;
  onAssignRow?: (row: LeadRowModel) => void;
};

export default function LeadsTable({
  rows: rowsProp,
  loading,
  page = 0,
  totalPages = 1,
  onPageChange,
  pageSize = 20,
  onPageSizeChange,
  selectedRowIds = [],
  onSelectedRowIdsChange,
  onDeleteRow,
  onAssignRow,
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
  const allSelected = rows.length > 0 && rows.every((row) => selectedRowIds.includes(row.id));
  const someSelected = selectedRowIds.length > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <section className="mx-auto mt-5 max-w-[1200px] px-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-12 gap-3 bg-gradient-to-r from-slate-50 to-blue-50/60 px-6 py-4 text-[10px] font-bold tracking-wide text-slate-500">
          <div className="col-span-1">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                onSelectedRowIdsChange?.(
                  event.target.checked ? rows.map((row) => row.id) : []
                )
              }
              className="h-4 w-4 cursor-pointer accent-blue-600"
            />
          </div>
          <div className="col-span-3">LEAD NAME</div>
          <div className="col-span-2">STATUS</div>
          <div className="col-span-2">JOURNEY TRACK</div>
          <div className="col-span-2">OWNER</div>
          <div className="col-span-1">ENGAGEMENT</div>
          <div className="col-span-1 text-right">ACTIONS</div>
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
          rows.map((r) => (
            <LeadRowAction
              key={r.id}
              row={r}
              selected={selectedRowIds.includes(r.id)}
              onToggleSelected={(checked) => {
                if (!onSelectedRowIdsChange) return;
                if (checked) {
                  onSelectedRowIdsChange([...new Set([...selectedRowIds, r.id])]);
                  return;
                }
                onSelectedRowIdsChange(selectedRowIds.filter((id) => id !== r.id));
              }}
              onDelete={onDeleteRow}
              onAssign={onAssignRow}
            />
          ))
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
