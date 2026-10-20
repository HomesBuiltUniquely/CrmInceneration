"use client";

import { motion, useReducedMotion } from "framer-motion";
import { focusRing } from "./motion";
import type { PageSize } from "./useMeetingFilters";

const numberFormat = new Intl.NumberFormat("en-IN");

export function Pagination({
  page,
  pageCount,
  pageSize,
  rangeStart,
  rangeEnd,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: PageSize;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
}) {
  const reduce = useReducedMotion();
  const items = pageItems(page, pageCount);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E3E8EE] px-4 py-2 md:px-5">
      <p className="text-[12px] font-medium text-[#64748B]" aria-live="polite">
        {total === 0
          ? "Showing 0 meetings"
          : `Showing ${numberFormat.format(rangeStart)}–${numberFormat.format(rangeEnd)} of ${numberFormat.format(total)}`}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <label className="mr-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#475569]">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value) as PageSize)}
            className={`h-8 rounded-lg border border-[#E3E8EE] bg-white px-1.5 text-[12px] font-semibold text-[#0F172A] transition hover:border-[#94A3B8] ${focusRing}`}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
        <PageButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </PageButton>
        {items.map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="px-0.5 text-[12px] font-semibold text-[#94A3B8]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPage(item)}
              className={`relative inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[12px] font-bold transition-colors ${focusRing} ${
                item === page ? "text-[#052E16]" : "text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              }`}
            >
              {item === page ? (
                <motion.span
                  layoutId="meeting-page-pill"
                  className="absolute inset-0 rounded-lg bg-[#22C55E]"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                />
              ) : null}
              <span className="relative">{item}</span>
            </button>
          ),
        )}
        <PageButton label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-lg border border-[#E3E8EE] bg-white px-2.5 text-[12px] font-semibold text-[#334155] transition hover:border-[#94A3B8] hover:bg-[#F8FAFC] disabled:hover:border-[#E3E8EE] disabled:hover:bg-white disabled:opacity-40 ${focusRing}`}
    >
      {children}
    </button>
  );
}

function pageItems(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 1) return [1];
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, "…", pageCount];
  if (page >= pageCount - 2) return [1, "…", pageCount - 2, pageCount - 1, pageCount];
  return [1, "…", page - 1, page, page + 1, "…", pageCount];
}
