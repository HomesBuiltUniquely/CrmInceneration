"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE, focusRing } from "./motion";
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
    <div className="flex flex-col gap-3 border-t border-[#E3E8EE] px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
      <p className="text-[13px] font-semibold text-[#5B6778]" aria-live="polite">
        {total === 0
          ? "Showing 0 meetings"
          : `Showing ${numberFormat.format(rangeStart)}–${numberFormat.format(rangeEnd)} of ${numberFormat.format(total)} meetings`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#334155]">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value) as PageSize)}
            className={`h-11 rounded-xl border border-[#E3E8EE] bg-white px-2 text-[14px] font-semibold text-[#0F172A] ${focusRing}`}
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
            <span key={`gap-${index}`} className="px-1 text-[14px] font-semibold text-[#5B6778]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPage(item)}
              className={`relative inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-[14px] font-bold ${focusRing} ${
                item === page ? "text-[#052E16]" : "text-[#334155] hover:-translate-y-px"
              }`}
            >
              {item === page ? (
                <motion.span
                  layoutId="meeting-page-pill"
                  className="absolute inset-0 rounded-xl bg-[#22C55E]"
                  transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
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
      className={`inline-flex h-11 items-center rounded-xl border border-[#E3E8EE] bg-white px-3 text-[14px] font-semibold text-[#334155] hover:-translate-y-px disabled:translate-y-0 disabled:opacity-40 ${focusRing}`}
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
