"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import InsightsDateFilterPopover from "@/app/Components/Insights/InsightsDateFilterPopover";
import InsightsDropdownFilter from "@/app/Components/Insights/InsightsDropdownFilter";
import {
  DEFAULT_BOOKING_DATE_FILTER,
  DEFAULT_INSIGHTS_DATE_FILTER,
  type BookingDateFilterState,
  type BookingDatePresetId,
} from "@/lib/booking-token-date-filter";
import type { DatePresetId } from "@/lib/meeting-date-range";
import type { FilterDraft, FilterOption } from "./FilterModal";
import { focusRing } from "./motion";

export function MeetingHeaderMenus({
  value,
  designers,
  sales,
  branches = [],
  onApply,
}: {
  value: FilterDraft;
  designers: FilterOption[];
  sales: FilterOption[];
  branches?: FilterOption[];
  onApply: (draft: FilterDraft) => void;
}) {
  const [menu, setMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setMenu(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const update = (partial: Partial<FilterDraft>) => {
    onApply({ ...value, ...partial });
  };

  const resetFilters = () => {
    onApply({
      ...value,
      designerIds: [],
      salesIds: [],
      branchIds: [],
      labels: [],
      progress: [],
    });
  };

  const filterActive =
    value.designerIds.length > 0 ||
    value.salesIds.length > 0 ||
    value.branchIds.length > 0 ||
    value.labels.length > 0 ||
    (value.progress?.length ?? 0) > 0;
  const filterCount =
    (value.designerIds.length ? 1 : 0) +
    (value.salesIds.length ? 1 : 0) +
    (value.branchIds.length ? 1 : 0) +
    (value.labels.length ? 1 : 0) +
    ((value.progress?.length ?? 0) > 0 ? 1 : 0);
  const designerOptions = [
    { value: "", label: "All designers" },
    ...designers.map((item) => ({ value: item.id, label: item.label })),
  ];
  const salesOptions = [
    { value: "", label: "All sales" },
    ...sales.map((item) => ({ value: item.id, label: item.label })),
  ];
  const branchOptions = [
    { value: "", label: "All ECs" },
    ...branches.map((item) => ({ value: item.id, label: item.label })),
  ];

  return (
    <div className="relative z-30 flex flex-wrap items-center gap-0.5">
      <div ref={filterRef} className="relative">
      <MenuButton
        label="Filter"
        count={filterCount}
        open={menu}
        onClick={() => setMenu((open) => !open)}
        icon={<FilterIcon />}
      />

      {menu ? (
        <div
          role="dialog"
          aria-label="Filter meetings"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(280px,calc(100vw-2rem))] overflow-visible rounded-lg border border-[#E3E8EE] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-[#E3E8EE] px-2.5 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Filters</span>
            <ResetIconButton label="Reset filters" disabled={!filterActive} onClick={resetFilters} />
          </div>
          <div className="space-y-2 px-2.5 py-2">
            <FilterField label="Designer">
              <InsightsDropdownFilter
                fullWidth
                matchWidth
                compact
                placeholder="All designers"
                ariaLabel="Designer"
                icon="users"
                value={value.designerIds[0] ?? ""}
                onChange={(id) => update({ designerIds: id ? [id] : [] })}
                options={designerOptions}
              />
            </FilterField>
            <FilterField label="Sales">
              <InsightsDropdownFilter
                fullWidth
                matchWidth
                compact
                placeholder="All sales"
                ariaLabel="Sales"
                icon="users"
                value={value.salesIds[0] ?? ""}
                onChange={(id) => update({ salesIds: id ? [id] : [] })}
                options={salesOptions}
              />
            </FilterField>
            <FilterField label="EC / Branch">
              <InsightsDropdownFilter
                fullWidth
                matchWidth
                compact
                placeholder="All ECs"
                ariaLabel="EC / Branch"
                icon="location"
                value={value.branchIds[0] ?? ""}
                onChange={(id) => update({ branchIds: id ? [id] : [] })}
                options={branchOptions}
              />
            </FilterField>
          </div>
        </div>
      ) : null}
      </div>
      <InsightsDateFilterPopover
        align="end"
        appearance="toolbar"
        idleLabel="Date range"
        subtitle="Meetings by start date"
        defaultFilter={DEFAULT_INSIGHTS_DATE_FILTER}
        value={toBookingDate(value)}
        onChange={(next) => update(fromBookingDate(next))}
      />
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#334155]">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

const BOOKING_TO_MEETING: Record<Exclude<BookingDatePresetId, "all" | "custom">, DatePresetId> = {
  currentMonth: "this-month",
  "3months": "last-3-months",
  "6months": "last-6-months",
  "1year": "last-1-year",
  previousMonth: "previous-month",
};

function toBookingDate(value: FilterDraft): BookingDateFilterState {
  if (value.preset === "all") return DEFAULT_BOOKING_DATE_FILTER;
  if (value.preset === "custom" || value.preset === "today") {
    return { preset: "custom", customFrom: value.dateFrom, customTo: value.dateTo };
  }
  if (!value.preset || value.preset === "this-month") return DEFAULT_INSIGHTS_DATE_FILTER;
  if (value.preset === "last-3-months") return { preset: "3months", customFrom: "", customTo: "" };
  if (value.preset === "last-6-months") return { preset: "6months", customFrom: "", customTo: "" };
  if (value.preset === "last-1-year") return { preset: "1year", customFrom: "", customTo: "" };
  if (value.preset === "previous-month") return { preset: "previousMonth", customFrom: "", customTo: "" };
  return DEFAULT_BOOKING_DATE_FILTER;
}

function fromBookingDate(next: BookingDateFilterState): Pick<FilterDraft, "preset" | "dateFrom" | "dateTo"> {
  if (next.preset === "all") return { preset: "all", dateFrom: "", dateTo: "" };
  if (next.preset === "currentMonth") return { preset: "", dateFrom: "", dateTo: "" };
  if (next.preset === "custom") {
    return { preset: "custom", dateFrom: next.customFrom, dateTo: next.customTo };
  }
  return { preset: BOOKING_TO_MEETING[next.preset], dateFrom: "", dateTo: "" };
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
      className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold tracking-wide transition-colors ${focusRing} ${
        active
          ? "bg-[#E8F1FF] text-[#1B3FA8]"
          : "text-[#334155] hover:bg-[#F4F6F8]"
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

function ResetIconButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition ${focusRing} ${
        disabled ? "cursor-not-allowed opacity-35" : "hover:bg-[#F1F5F9] hover:text-[#0F172A]"
      }`}
    >
      <ResetIcon />
    </button>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 6h16l-6 7v5l-4-2v-3L4 6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
