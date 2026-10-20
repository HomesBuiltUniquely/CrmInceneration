"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MeetingRecord } from "@/lib/meeting-management-data";
import { EmptyState } from "./EmptyState";
import { MeetingRow } from "./MeetingRow";
import { Pagination } from "./Pagination";
import { TableSkeleton } from "./TableSkeleton";
import type { PageSize } from "./useMeetingFilters";

const HEADERS = ["No.", "Customer", "Progress", "Sales", "Meeting", "Date & time", "Lead budget", "Lead quote", "Delayed", "Actions"];

export function MeetingsTable({
  rows,
  loading,
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  onView,
  onReschedule,
  onClear,
}: {
  rows: MeetingRecord[];
  loading: boolean;
  page: number;
  pageSize: PageSize;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
  onView: (row: MeetingRecord) => void;
  onReschedule: (row: MeetingRecord) => void;
  onClear: () => void;
}) {
  const now = useMinuteNow();
  const reduce = useReducedMotion();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  return (
    <div>
      <style>{`
        .meeting-row td { background: #fff; transition: transform 200ms cubic-bezier(0.2,0.8,0.2,1); }
        .meeting-row:hover td, .meeting-row:focus-visible td { background: #f5faf8; }
        @media (prefers-reduced-motion: no-preference) {
          .meeting-row:hover td, .meeting-row:focus-visible td { transform: translateY(-3px); }
        }
        .meeting-row:hover, .meeting-row:focus-visible { filter: drop-shadow(0 8px 12px rgba(15,23,42,0.12)); }
        .meeting-row:hover td:first-child, .meeting-row:focus-visible td:first-child { border-radius: 12px 0 0 12px; }
        .meeting-row:hover td:last-child, .meeting-row:focus-visible td:last-child { border-radius: 0 12px 12px 0; }
      `}</style>
      <div className="overflow-x-auto py-1">
        <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col className="w-[52px]" />
            <col />
            <col className="w-[128px]" />
            <col className="w-[140px]" />
            <col className="w-[150px]" />
            <col className="w-[112px]" />
            <col className="w-[112px]" />
            <col className="w-[118px]" />
            <col className="w-[104px]" />
            <col className="w-[100px]" />
          </colgroup>
          <caption className="sr-only">Meetings</caption>
          <thead>
            <tr className="bg-[#F7F9FA]">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className={`whitespace-nowrap bg-[#F7F9FA] px-3 py-2.5 align-middle text-[12px] font-bold text-[#5B6778] first:rounded-tl-xl last:rounded-tr-xl ${header === "Actions" ? "text-center" : "text-left"}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <AnimatePresence mode="wait" initial={false}>
            <motion.tbody
              key={loading ? "loading" : page}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {loading ? (
                <TableSkeleton />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <EmptyState onClear={onClear} />
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <MeetingRow
                    key={`${row.id}-${row.appointmentId ?? "lead"}`}
                    row={row}
                    now={now}
                    sequence={(page - 1) * pageSize + index + 1}
                    onView={() => onView(row)}
                    onReschedule={() => onReschedule(row)}
                  />
                ))
              )}
            </motion.tbody>
          </AnimatePresence>
        </table>
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={total}
        onPage={onPage}
        onPageSize={onPageSize}
      />
    </div>
  );
}

function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
