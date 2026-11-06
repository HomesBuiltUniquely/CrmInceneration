"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE, focusRing } from "./motion";
import { PAGE_SIZES, type PageSize } from "./useMeetingFilters";

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
        <div className="mr-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#475569]">
          <span>Rows</span>
          <RowsSizePicker pageSize={pageSize} onPageSize={onPageSize} />
        </div>
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

function RowsSizePicker({
  pageSize,
  onPageSize,
}: {
  pageSize: PageSize;
  onPageSize: (size: PageSize) => void;
}) {
  const reduce = useReducedMotion();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  const clearClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const wrapOut = () => {
    clearClose();
    setOpen(true);
  };

  const wrapIn = (delayMs = 120) => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), delayMs);
  };

  useEffect(() => () => clearClose(), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (size: PageSize) => {
    onPageSize(size);
    clearClose();
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="inline-flex h-8 items-center"
      onMouseEnter={wrapOut}
      onMouseLeave={() => wrapIn(160)}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="row-open"
            id={listId}
            role="listbox"
            aria-label="Rows per page"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scaleX: 0.65 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scaleX: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scaleX: 0.65 }}
            transition={reduce ? { duration: 0.12 } : { duration: 0.26, ease: EASE }}
            style={{ originX: 0 }}
            className="flex h-8 overflow-hidden rounded-lg border border-[#22C55E] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.1)]"
          >
            <ul className="flex h-8 flex-row items-stretch">
              {PAGE_SIZES.map((size, index) => {
                const selected = size === pageSize;
                return (
                  <motion.li
                    key={size}
                    initial={reduce ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.18, delay: 0.02 + index * 0.028, ease: EASE }
                    }
                    className="h-full"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(size)}
                      className={`flex h-full min-w-9 items-center justify-center px-2.5 text-[12px] font-bold tabular-nums transition-colors ${focusRing} ${
                        selected
                          ? "bg-[#22C55E] text-[#052E16]"
                          : "text-[#334155] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]"
                      } ${index > 0 ? "border-l border-[#E8EEF4]" : ""}`}
                    >
                      <motion.span
                        whileHover={reduce || selected ? undefined : { scale: 1.1 }}
                        whileTap={reduce ? undefined : { scale: 0.92 }}
                        transition={{ duration: 0.14, ease: EASE }}
                      >
                        {size}
                      </motion.span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.button
            key="row-closed"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={false}
            aria-controls={listId}
            aria-label={`Rows per page, ${pageSize}`}
            onClick={wrapOut}
            onFocus={wrapOut}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
            transition={reduce ? { duration: 0.1 } : { duration: 0.16, ease: EASE }}
            className={`inline-flex h-8 min-w-[2.75rem] items-center justify-center gap-1 rounded-lg border border-[#E3E8EE] bg-white px-2 text-[12px] font-bold tabular-nums text-[#0F172A] transition hover:border-[#94A3B8] hover:bg-[#F8FAFC] ${focusRing}`}
          >
            <span>{pageSize}</span>
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-[#64748B]" fill="none" aria-hidden>
              <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
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
