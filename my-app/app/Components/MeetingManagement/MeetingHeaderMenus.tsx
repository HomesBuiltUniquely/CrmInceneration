"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatRangeLabel, resolveDatePreset } from "@/lib/meeting-date-range";
import { DateRangePresets, MultiSelectChips, type FilterDraft, type FilterOption } from "./FilterModal";
import { focusRing } from "./motion";

export function MeetingHeaderMenus({
  value,
  designers,
  sales,
  peopleCount,
  dateCount,
  onApply,
}: {
  value: FilterDraft;
  designers: FilterOption[];
  sales: FilterOption[];
  peopleCount: number;
  dateCount: number;
  onApply: (draft: FilterDraft) => void;
}) {
  const [menu, setMenu] = useState<"filter" | "date" | null>(null);
  const [draft, setDraft] = useState<FilterDraft>(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) setDraft(value);
  }, [menu, value]);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const range = draft.preset
    ? resolveDatePreset(draft.preset, new Date(), { from: draft.dateFrom, to: draft.dateTo })
    : null;

  const apply = () => {
    onApply(draft);
    setMenu(null);
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <MenuButton label="Filter" count={peopleCount} open={menu === "filter"} onClick={() => setMenu(menu === "filter" ? null : "filter")} icon={<FilterIcon />} />
      <MenuButton label="Date range" count={dateCount} open={menu === "date"} onClick={() => setMenu(menu === "date" ? null : "date")} icon={<CalendarIcon />} />

      {menu === "filter" ? (
        <div role="dialog" aria-label="Filter meetings" className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#E3E8EE] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
            <MultiSelectChips
              label="Designers"
              placeholder="Search designers"
              emptyLabel="All designers"
              options={designers}
              selected={draft.designerIds}
              onChange={(designerIds) => setDraft((current) => ({ ...current, designerIds }))}
            />
            <MultiSelectChips
              label="Sales"
              placeholder="All sales team"
              emptyLabel="All sales team"
              options={sales}
              selected={draft.salesIds}
              onChange={(salesIds) => setDraft((current) => ({ ...current, salesIds }))}
            />
            <label className="block text-[13px] font-semibold text-[#334155]">
              Branch
              <select
                value={draft.branchIds[0] ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, branchIds: event.target.value ? [event.target.value] : [] }))}
                className={`mt-1 h-11 w-full rounded-xl border border-[#E3E8EE] bg-white px-3 text-[14px] font-semibold text-[#0F172A] ${focusRing}`}
              >
                <option value="">All branches</option>
              </select>
            </label>
            <LabelChips labels={draft.labels} onChange={(labels) => setDraft((current) => ({ ...current, labels }))} />
          </div>
          <MenuFooter
            onReset={() => setDraft({ ...draft, designerIds: [], salesIds: [], branchIds: [], labels: [] })}
            onApply={apply}
          />
        </div>
      ) : null}

      {menu === "date" ? (
        <div role="dialog" aria-label="Calendar range" className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(460px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#E3E8EE] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            <DateRangePresets
              preset={draft.preset}
              dateFrom={draft.dateFrom}
              dateTo={draft.dateTo}
              summary={formatRangeLabel(range)}
              onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            />
          </div>
          <MenuFooter
            onReset={() => setDraft({ ...draft, preset: "", dateFrom: "", dateTo: "" })}
            onApply={apply}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  label,
  count,
  open,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  open: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  const active = open || count > 0;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold tracking-wide ${focusRing} ${
        active
          ? "border-[#1D4ED8] bg-[#EFF6FF] text-[#1E40AF] shadow-[0_0_0_1px_rgba(29,78,216,0.12)]"
          : "border-[#CBD5E1] bg-white text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC]"
      }`}
    >
      <span className={`inline-flex items-center ${active ? "text-[#1D4ED8]" : "text-[#475569]"}`}>{icon}</span>
      <span>{label}</span>
      {count > 0 ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1D4ED8] px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function MenuFooter({ onReset, onApply }: { onReset: () => void; onApply: () => void }) {
  return (
    <div className="flex items-center justify-between border-t border-[#E3E8EE] px-4 py-3">
      <button type="button" onClick={onReset} className={`text-[13px] font-semibold text-[#334155] underline-offset-4 hover:underline ${focusRing}`}>
        Reset
      </button>
      <button type="button" onClick={onApply} className={`inline-flex h-10 items-center rounded-xl bg-[#22C55E] px-4 text-[14px] font-bold text-[#052E16] ${focusRing}`}>
        Apply
      </button>
    </div>
  );
}

const LABELS = ["Showroom Visit", "Virtual Meeting", "Site Visit"];

function LabelChips({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[#334155]">Meeting label</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LABELS.map((label) => {
          const selected = labels.some((item) => item.toLowerCase() === label.toLowerCase());
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(selected ? labels.filter((item) => item.toLowerCase() !== label.toLowerCase()) : [...labels, label])
              }
              className={`inline-flex h-10 items-center rounded-full border px-3 text-[13px] font-semibold ${focusRing} ${
                selected ? "border-2 border-[#22C55E] bg-[#F0FDF4] text-[#14532D]" : "border-[#E3E8EE] bg-white text-[#334155]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 6h16l-6 7v5l-4-2v-3L4 6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
