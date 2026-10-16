"use client";

import type { MeetingRecord } from "@/lib/meeting-management-data";
import { EmptyState } from "./EmptyState";
import { MeetingRow } from "./MeetingRow";
import { Pagination } from "./Pagination";
import { TableSkeleton } from "./TableSkeleton";
import type { PageSize } from "./useMeetingFilters";

const HEADERS = ["No.", "Customer", "Status", "Assigned to", "Meeting", "Date & time", "Lead budget", "Lead quote", "Actions"];

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
  onCancel,
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
  onCancel: (row: MeetingRecord) => void;
  onClear: () => void;
}) {
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
      <div className="py-1">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[16%]" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
          </colgroup>
          <caption className="sr-only">Meetings</caption>
          <thead>
            <tr className="bg-[#F7F9FA]">
              {HEADERS.map((header) => (
                <th key={header} scope="col" className="bg-[#F7F9FA] px-2.5 py-2 text-[12px] font-bold text-[#5B6778] first:rounded-tl-xl last:rounded-tr-xl">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState onClear={onClear} />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <MeetingRow
                  key={`${row.id}-${row.appointmentId ?? "lead"}`}
                  row={row}
                  sequence={(page - 1) * pageSize + index + 1}
                  onView={() => onView(row)}
                  onReschedule={() => onReschedule(row)}
                  onCancel={() => onCancel(row)}
                />
              ))
            )}
          </tbody>
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
