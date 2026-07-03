"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { leads } from "@/lib/data";
import { getStoredLeadStatus, LEAD_STATUS_EVENT } from "@/lib/lead-status";
import type { LeadRowModel } from "@/lib/leads-filter";

import { persistLeadsListScrollBeforeNavigate } from "@/lib/leads-view-persist";
import { buildLeadDetailPath, type CrmWorkspace } from "@/lib/crm-workspace";

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
    <div className="h-1.5 w-full max-w-[5.5rem] rounded-full bg-[var(--crm-border)]">
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

function dueDateToneClass(tone: LeadRowModel["dueDate"]["tone"]): string {
  if (tone === "today") return "text-[var(--crm-accent)]";
  if (tone === "tomorrow") return "text-[var(--crm-warning-text)]";
  if (tone === "yesterday" || tone === "overdue") return "text-[var(--crm-danger-text)]";
  return "text-[var(--crm-text-secondary)]";
}

function formatDueDateSingleLine(dueDate: LeadRowModel["dueDate"]): string {
  if (dueDate.label === "—") return "—";
  const isRelative =
    dueDate.label === "Today" ||
    dueDate.label === "Tomorrow" ||
    dueDate.label === "Yesterday";
  if (isRelative && dueDate.detail) {
    return `${dueDate.label}, ${dueDate.detail}`;
  }
  if (dueDate.detail) return dueDate.detail;
  return dueDate.label;
}

function extractDueDateTime(detail: string): string | undefined {
  const match = detail.match(/,\s*(\d{1,2}:\d{2}\s*[AP]M)$/i);
  return match?.[1];
}

/** Compact table cell — full string stays in `title` tooltip. */
function formatDueDateCompact(dueDate: LeadRowModel["dueDate"]): {
  headline: string;
  subline?: string;
} {
  if (dueDate.label === "—") return { headline: "—" };

  const isRelative =
    dueDate.label === "Today" ||
    dueDate.label === "Tomorrow" ||
    dueDate.label === "Yesterday";

  if (isRelative) {
    return {
      headline: dueDate.label,
      subline: dueDate.detail ? extractDueDateTime(dueDate.detail) : undefined,
    };
  }

  const subline = dueDate.detail ? extractDueDateTime(dueDate.detail) : undefined;
  return { headline: dueDate.label, subline };
}


type LeadRowActionProps = {
  row: LeadRowModel;
  selected: boolean;
  onToggleSelected: (checked: boolean) => void;
  showSelection: boolean;
  showActions: boolean;
  gridClass: string;
  onDelete?: (row: LeadRowModel) => void;
  onAssign?: (row: LeadRowModel) => void;
  leadsWorkspace?: CrmWorkspace;
};

function getLeadsTableGridClass(showActions: boolean): string {
  return showActions
    ? "grid w-full grid-cols-[28px_minmax(0,0.72fr)_minmax(0,1.44fr)_minmax(0,0.78fr)_minmax(0,0.95fr)_minmax(0,0.62fr)_minmax(0,0.67fr)_minmax(0,0.77fr)_118px] items-start gap-x-2"
    : "grid w-full grid-cols-[28px_minmax(0,0.72fr)_minmax(0,1.55fr)_minmax(0,0.82fr)_minmax(0,1fr)_minmax(0,0.68fr)_minmax(0,0.72fr)_minmax(0,0.82fr)] items-start gap-x-2";
}

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

function openLeadDetail(
  router: ReturnType<typeof useRouter>,
  row: LeadRowModel,
  leadsWorkspace: CrmWorkspace = "sales",
) {
  persistLeadsListScrollBeforeNavigate();
  const url = buildLeadDetailPath(row.leadType, row.id, leadsWorkspace);
  if (typeof window !== "undefined") {
    const width = 1080;
    const height = 720;
    const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - height) / 2));
    const popup = window.open(
      url,
      "_blank",
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
    if (popup) {
      popup.focus();
      return;
    }
  }
  router.push(url, { scroll: false });
}

function LeadRowAction({
  row,
  selected,
  onToggleSelected,
  showSelection,
  showActions,
  gridClass,
  onDelete,
  onAssign,
  leadsWorkspace = "sales",
}: LeadRowActionProps) {
  const router = useRouter();
  const critical = row.journey.status?.tone === "critical";
  return (
    <div
      onClick={() => openLeadDetail(router, row, leadsWorkspace)}
      className={`${gridClass} cursor-pointer border-t border-[var(--crm-border)] px-4 py-3 transition-all hover:bg-[var(--crm-surface-subtle)] ${
        selected ? "bg-blue-50/60 ring-1 ring-inset ring-blue-100" : ""
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLeadDetail(router, row, leadsWorkspace);
        }
      }}
    >
      <div className="flex min-h-[64px] items-center gap-2">
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
      <div className="flex min-h-[56px] items-center self-center">
        <div className="truncate text-[11px] font-semibold text-[var(--crm-text-secondary)]">
          {row.enquiryDate}
        </div>
      </div>
      <div className="flex min-h-[56px] min-w-0 items-start gap-2 self-start">
        <div className="leading-tight">
          <div className="text-[12px] font-semibold text-[var(--crm-text-primary)]">{row.name}</div>
          <div className="mt-1 text-[11px] font-medium text-[var(--crm-text-muted)]">{row.company}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {row.verificationTag === "verified" ? (
              <TinyTag chip={{ label: "Verified", tone: "green" }} />
            ) : row.verificationTag === "unverified" ? (
              <TinyTag chip={{ label: "Unverified", tone: "amber" }} />
            ) : null}
            {row.reinquiry ? (
              <span
                title={
                  row.reinquirySources
                    ? `Additional sources: ${row.reinquirySources}`
                    : "Repeat inquiry — same customer contacted again"
                }
              >
                <TinyTag chip={{ label: "Re-inquiry", tone: "rose" }} />
              </span>
            ) : null}
            {row.callDelayed ? <TinyTag chip={{ label: "Call Delayed", tone: "violet" }} /> : null}
            {row.pipelineBadge === "presales" ? (
              <TinyTag chip={{ label: "Presales", tone: "amber" }} />
            ) : row.pipelineBadge === "sales" ? (
              <TinyTag chip={{ label: "Sales", tone: "blue" }} />
            ) : null}
            {row.handedOffReadOnly ? (
              <TinyTag chip={{ label: "Handed Off — Read Only", tone: "slate" }} />
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-[56px] min-w-0 items-center self-center">
        <div className="min-w-0 truncate">
          {row.statusLabel ? <ChipPill chip={{ label: row.statusLabel, tone: "slate" }} /> : null}
        </div>
      </div>

      <div className="min-h-[56px] min-w-0 self-start">
        <div className="text-[10px] font-bold tracking-wide text-[var(--crm-text-muted)]">{row.journey.stage}</div>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar pct={row.journey.progressPct} tone={critical ? "critical" : "normal"} />
          <div className="text-[10px] font-semibold text-[var(--crm-text-muted)]">{row.journey.progressLabel}</div>
        </div>
        {row.journey.status ? <StatusInline status={row.journey.status} /> : null}
      </div>

      <div className="flex min-h-[56px] min-w-0 items-center self-center">
        <div className="truncate text-[11px] font-semibold text-[var(--crm-text-secondary)]">{row.owner.name}</div>
      </div>

      <div className="min-h-[56px] min-w-0 self-center pt-0.5">
        <div className={`truncate text-[11px] font-semibold ${row.engagement.tone === "late" ? "text-[var(--crm-danger-text)]" : "text-[var(--crm-text-muted)]"}`}>
          {row.engagement.time}
        </div>
        <div className="mt-0.5 truncate text-[10px] font-semibold text-[var(--crm-text-muted)]">
          {row.engagement.action}
        </div>
      </div>

      {(() => {
        const due = formatDueDateCompact(row.dueDate);
        return (
          <div
            className="min-h-[56px] min-w-0 self-center py-0.5"
            title={formatDueDateSingleLine(row.dueDate)}
          >
            <div className={`truncate text-[11px] font-semibold leading-none ${dueDateToneClass(row.dueDate.tone)}`}>
              {due.headline}
            </div>
            {due.subline ? (
              <div className="mt-0.5 truncate text-[10px] font-medium text-[var(--crm-text-muted)]">
                {due.subline}
              </div>
            ) : null}
          </div>
        );
      })()}

      {showActions ? (
        <div className="flex min-h-[56px] w-full shrink-0 flex-col justify-center gap-1 self-center">
          {onAssign ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onAssign(row);
              }}
              className="min-h-[28px] w-full rounded-lg border border-blue-200 bg-[var(--crm-surface)] px-2 py-1 text-[10px] font-semibold text-blue-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md active:translate-y-0"
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
              className="min-h-[28px] w-full rounded-lg border border-rose-200 bg-[var(--crm-surface)] px-2 py-1 text-[10px] font-semibold text-rose-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:shadow-md active:translate-y-0"
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
    <div className="flex items-center justify-between border-t border-[var(--crm-border)] px-4 py-4">
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
  leadsWorkspace?: CrmWorkspace;
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
  leadsWorkspace = "sales",
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
  const gridClass = getLeadsTableGridClass(showActions);
  const allSelected = rows.length > 0 && rows.every((row) => selectedRowIds.includes(row.id));
  const someSelected = selectedRowIds.length > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <section className="mx-auto mt-5 w-full max-w-[1400px] px-4">
      <div className="overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[var(--crm-shadow-sm)]">
        <div className={`${gridClass} bg-[var(--crm-surface-subtle)] px-4 py-3 text-[10px] font-bold tracking-wide text-[var(--crm-text-muted)]`}>
          <div>
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
          <div>ENQUIRY DATE</div>
          <div>LEAD NAME</div>
          <div>STATUS</div>
          <div>JOURNEY TRACK</div>
          <div>OWNER</div>
          <div>ENGAGEMENT</div>
          <div>DUE DATE</div>
          {showActions ? <div className="text-center leading-tight">ACTIONS</div> : null}
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
          rows.map((r, idx) => (
            <LeadRowAction
              key={`${r.id}:${r.leadType}:${idx}`}
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
              gridClass={gridClass}
              onDelete={onDeleteRow}
              onAssign={onAssignRow}
              leadsWorkspace={leadsWorkspace}
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
