"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { leads } from "@/lib/data";
import { getStoredLeadStatus, LEAD_STATUS_EVENT } from "@/lib/lead-status";
import type { LeadRowModel } from "@/lib/leads-filter";

type ChipTone = "blue" | "green" | "amber" | "rose" | "violet" | "slate";

type Chip = { label: string; tone: ChipTone };

function ChipPill({ chip }: { chip: Chip }) {
  const cls =
    chip.tone === "blue"
      ? "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]"
      : chip.tone === "green"
        ? "bg-[var(--crm-success-bg)] text-[var(--crm-success-text)] ring-1 ring-[var(--crm-success)]"
        : chip.tone === "amber"
          ? "bg-[var(--crm-warning-bg)] text-[var(--crm-warning-text)] ring-1 ring-[var(--crm-warning-border)]"
          : chip.tone === "rose"
            ? "bg-[var(--crm-danger-bg)] text-[var(--crm-danger-text)] ring-1 ring-[var(--crm-danger)]"
            : chip.tone === "violet"
              ? "bg-violet-100 text-violet-700 ring-1 ring-violet-300"
            : "bg-[var(--crm-surface-subtle)] text-[var(--crm-text-muted)]";

  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{chip.label}</span>;
}

function TinyTag({ chip }: { chip: Chip }) {
  const cls =
    chip.tone === "blue"
      ? "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]"
      : chip.tone === "green"
        ? "bg-[var(--crm-success-bg)] text-[var(--crm-success-text)] ring-1 ring-[var(--crm-success)]"
        : chip.tone === "amber"
          ? "bg-[var(--crm-warning-bg)] text-[var(--crm-warning-text)] ring-1 ring-[var(--crm-warning-border)]"
          : chip.tone === "rose"
            ? "bg-[var(--crm-danger-bg)] text-[var(--crm-danger-text)] ring-1 ring-[var(--crm-danger)]"
            : chip.tone === "violet"
              ? "bg-violet-100 text-violet-700 ring-1 ring-violet-300"
            : "bg-[var(--crm-surface-subtle)] text-[var(--crm-text-muted)]";
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold leading-none ${cls}`}>{chip.label}</span>;
}

function ProgressBar({ pct, tone }: { pct: number; tone: "normal" | "critical" }) {
  const bar = tone === "critical" ? "bg-[var(--crm-danger)]" : "bg-[var(--crm-accent)]";
  return (
    <div className="h-1.5 w-28 rounded-full bg-[var(--crm-border)]">
      <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

function StatusInline({ status }: { status: NonNullable<LeadRowModel["journey"]["status"]> }) {
  const cls =
    status.tone === "critical"
      ? "text-[var(--crm-danger-text)]"
      : "text-[var(--crm-warning-text)]";
  return (
    <div className={`mt-1 text-[10px] font-semibold ${cls}`}>
      {status.label}
    </div>
  );
}


type LeadRowActionProps = {
  row: LeadRowModel;
  selected: boolean;
  onToggleSelected: (checked: boolean) => void;
  showSelection: boolean;
  showActions: boolean;
  onDelete?: (row: LeadRowModel) => void;
  onAssign?: (row: LeadRowModel) => void;
};

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--crm-text-muted)]" fill="none" xmlns="http://www.w3.org/2000/svg">
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
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--crm-danger)] text-white shadow-[var(--crm-shadow-sm)] hover:brightness-110"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function LeadRowAction({
  row,
  selected,
  onToggleSelected,
  showSelection,
  showActions,
  onDelete,
  onAssign,
}: LeadRowActionProps) {
  const router = useRouter();
  const critical = row.journey.status?.tone === "critical";
  return (
    <div
      onClick={() => router.push(`/Leads/${row.leadType}/${row.id}`)}
      className={`grid cursor-pointer grid-cols-12 items-start gap-3 border-t border-[var(--crm-border)] px-6 py-4 transition-all hover:bg-[var(--crm-surface-subtle)] ${
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
      <div className="col-span-1 flex min-h-[64px] items-center gap-2">
        {showSelection ? (
          <input
            type="checkbox"
            checked={selected}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onToggleSelected(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-blue-600"
          />
        ) : null}
      </div>
      <div className="col-span-3 flex min-h-[64px] items-start gap-3">
        <div className="leading-tight">
          <div className="text-[12px] font-semibold text-[var(--crm-text-primary)]">{row.name}</div>
          <div className="mt-1 text-[11px] font-medium text-[var(--crm-text-muted)]">{row.company}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {row.verificationTag === "verified" ? (
              <TinyTag chip={{ label: "Verified", tone: "green" }} />
            ) : row.verificationTag === "unverified" ? (
              <TinyTag chip={{ label: "Unverified", tone: "amber" }} />
            ) : null}
            {row.reinquiry ? <TinyTag chip={{ label: "Re-inquiry", tone: "rose" }} /> : null}
            {row.callDelayed ? <TinyTag chip={{ label: "Call Delayed", tone: "violet" }} /> : null}
          </div>
        </div>
      </div>

      <div className="col-span-2 flex min-h-[64px] items-center pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {row.statusLabel ? <ChipPill chip={{ label: row.statusLabel, tone: "slate" }} /> : null}
        </div>
      </div>

      <div className="col-span-2 min-h-[64px]">
        <div className="text-[10px] font-bold tracking-wide text-[var(--crm-text-muted)]">{row.journey.stage}</div>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar pct={row.journey.progressPct} tone={critical ? "critical" : "normal"} />
          <div className="text-[10px] font-semibold text-[var(--crm-text-muted)]">{row.journey.progressLabel}</div>
        </div>
        {row.journey.status ? <StatusInline status={row.journey.status} /> : null}
      </div>

      <div className="col-span-2 flex min-h-[64px] items-center gap-2">
        <div className="text-[12px] font-semibold text-[var(--crm-text-secondary)]">{row.owner.name}</div>
      </div>

      <div className={showActions ? "col-span-1 min-h-[64px] pt-0.5" : "col-span-2 min-h-[64px] pt-0.5"}>
        <div className={`text-[11px] font-semibold ${row.engagement.tone === "late" ? "text-[var(--crm-danger-text)]" : "text-[var(--crm-text-muted)]"}`}>
          {row.engagement.time}
        </div>
        <div className="mt-1 whitespace-nowrap text-[11px] font-semibold text-[var(--crm-text-secondary)]">
          {row.engagement.action}
        </div>
      </div>

      {showActions ? (
        <div className="col-span-1 flex min-h-[64px] items-center justify-end gap-2">
          {onAssign ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onAssign(row);
              }}
              className="rounded-xl border border-blue-200 px-2 py-1 text-[10px] font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-100"
            >
              Assign
            </button>
          ) : null}
          {onDelete ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete(row);
              }}
              className="rounded-xl border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
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
    <div className="flex items-center justify-between border-t border-[var(--crm-border)] px-6 py-4">
      <div className="flex items-center gap-1 text-[12px]">
        <button
          type="button"
          disabled={disabled || page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          className="h-8 w-8 rounded-full text-[var(--crm-text-muted)] hover:bg-[var(--crm-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
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
                  ? "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]"
                  : "text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
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
          className="h-8 w-8 rounded-full text-[var(--crm-text-muted)] hover:bg-[var(--crm-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold text-[var(--crm-text-muted)]">Rows</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
          className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--crm-text-secondary)]"
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
  const showActions = Boolean(onAssignRow || onDeleteRow);
  const showSelection = showActions && Boolean(onSelectedRowIdsChange);
  const allSelected = rows.length > 0 && rows.every((row) => selectedRowIds.includes(row.id));
  const someSelected = selectedRowIds.length > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <section className="mx-auto mt-5 max-w-[1200px] px-6">
      <div className="overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[var(--crm-shadow-sm)]">
        <div className="grid grid-cols-12 gap-3 bg-[var(--crm-surface-subtle)] px-6 py-4 text-[10px] font-bold tracking-wide text-[var(--crm-text-muted)]">
          <div className="col-span-1">
            {showSelection ? (
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
            ) : null}
          </div>
          <div className="col-span-3">LEAD NAME</div>
          <div className="col-span-2">STATUS</div>
          <div className="col-span-2">JOURNEY TRACK</div>
          <div className="col-span-2">OWNER</div>
          <div className={showActions ? "col-span-1" : "col-span-2"}>ENGAGEMENT</div>
          {showActions ? <div className="col-span-1 text-right">ACTIONS</div> : null}
        </div>
        {loading ? (
          <div className="border-t border-[var(--crm-border)] px-6 py-10 text-center text-[12px] text-[var(--crm-text-muted)]">
            Loading leads…
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-[var(--crm-border)] px-6 py-10 text-center text-[12px] text-[var(--crm-text-muted)]">
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
              showSelection={showSelection}
              showActions={showActions}
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
