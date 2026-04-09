"use client";

import React, { useMemo, useState } from "react";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MINI_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const HOURS: string[] = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12:00 am";
  if (i < 12) return `${i}:00 am`;
  if (i === 12) return "12:00 pm";
  return `${i - 12}:00 pm`;
});

type Cell = { day: number; type: "prev" | "curr" | "next" };

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function HubCalendarPage(): React.ReactElement {
  const [role, setRole] = React.useState("SUPER_ADMIN");
  React.useEffect(() => {
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "SUPER_ADMIN";
    setRole(normalizeRole(stored) || "SUPER_ADMIN");
  }, []);
  const today = useMemo(() => new Date(), []);
  const [miniMonth, setMiniMonth] = useState<number>(today.getMonth());
  const [miniYear, setMiniYear] = useState<number>(today.getFullYear());
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Mini calendar cells
  const { cells, daysInMonth } = useMemo(() => {
    const daysInMonth = getDaysInMonth(miniYear, miniMonth);
    const firstDay = getFirstDayOfMonth(miniYear, miniMonth);
    const prevMonthDays = getDaysInMonth(miniYear, miniMonth - 1);
    const cells: Cell[] = [];
    for (let i = firstDay - 1; i >= 0; i--)
      cells.push({ day: prevMonthDays - i, type: "prev" });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, type: "curr" });
    let nextDay = 1;
    while (cells.length < 42) cells.push({ day: nextDay++, type: "next" });
    return { cells, daysInMonth };
  }, [miniMonth, miniYear]);

  const prevMiniMonth = () => {
    if (miniMonth === 0) {
      setMiniMonth(11);
      setMiniYear((y) => y - 1);
    } else setMiniMonth((m) => m - 1);
  };
  const nextMiniMonth = () => {
    if (miniMonth === 11) {
      setMiniMonth(0);
      setMiniYear((y) => y + 1);
    } else setMiniMonth((m) => m + 1);
  };

  // Week view
  const getWeekStart = (offset: number): Date => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const weekStart = useMemo(
    () => getWeekStart(weekOffset),
    [today, weekOffset],
  );
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const sm = weekDays[0].getMonth();
  const em = weekDays[6].getMonth();
  const weekMonthLabel =
    sm === em
      ? `${MONTHS[sm]} ${weekDays[0].getFullYear()}`
      : `${MONTHS[sm]} / ${MONTHS[em]} ${weekDays[0].getFullYear()}`;

  const isToday = (d: Date): boolean =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  // refs and state for current time line
  const weekGridRef = React.useRef<HTMLDivElement | null>(null);
  const [linePos, setLinePos] = React.useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 0 });

  React.useEffect(() => {
    const updateLine = () => {
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const rowHeight = 44; // matches minHeight used for rows
      const top = (minutesSinceMidnight / 60) * rowHeight; // in px from top of time grid

      const grid = weekGridRef.current;
      if (!grid) return;
      const containerWidth = grid.clientWidth; // includes time column
      const timeCol = 70; // px as in gridTemplateColumns
      const contentWidth = Math.max(0, containerWidth - timeCol);
      const colWidth = contentWidth / 7;

      // find index of today in weekDays
      const todayIndex = weekDays.findIndex((d) => isToday(d));
      const left =
        timeCol + (todayIndex >= 0 ? todayIndex * colWidth + colWidth / 2 : 0);
      const width = contentWidth;

      setLinePos({ top, left, width });
    };

    updateLine();
    const iv = setInterval(updateLine, 60 * 1000);
    window.addEventListener("resize", updateLine);
    return () => {
      clearInterval(iv);
      window.removeEventListener("resize", updateLine);
    };
  }, [weekDays]);

  return (
    <div
      className="min-h-screen bg-[#f7f9fc] xl:h-screen xl:overflow-hidden"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="hidden xl:block">
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={role.replace(/_/g, " ")}
            profileRole={role}
            profileInitials="AD"
          />
        </div>

        <div className="bg-[#f7f9fc] xl:h-screen xl:overflow-y-auto">
          <div className="bg-white border-b border-gray-200 flex items-center gap-3 px-6 py-3">
            <div className="w-9 h-9 rounded-md overflow-hidden flex flex-col items-center justify-center bg-red-600 text-white flex-shrink-0">
              <span className="text-[7px] font-bold uppercase tracking-wide bg-red-700 w-full text-center leading-tight py-px">
                July
              </span>
              <span className="text-base font-bold leading-tight">17</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              HUB Calendar
            </h1>
          </div>

          <main className="px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[1400px]">
              {/* ── Subtitle ── */}
              <p className="text-sm text-gray-500 mb-5 max-w-xl leading-relaxed">
                Connect your account once, then view your calendar events
                directly inside CRM with the same weekly calendar layout used in
                the design module.
              </p>

              {/* ── Main card ── */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                {/* Card header */}
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-xl font-semibold text-blue-600 flex-shrink-0">
                    {today.getDate()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Calendar
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Your events plus all team events
                    </p>
                  </div>
                </div>

                {/* Card body: responsive 3-column grid - left, center (grows), right */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,240px)_minmax(420px,1fr)_minmax(200px,320px)] gap-6 items-start">
                  {/* Left: connect + status */}
                  <div className="flex flex-col gap-3">
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full py-3 px-6 shadow-md transition-colors">
                      Connect HUB Calendar
                    </button>
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <span className="inline-block bg-gray-200 text-gray-600 text-xs font-semibold px-2.5 py-0.5 rounded mb-2">
                        Not Connected
                      </span>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        No account connected. Connect once to load your calendar
                        events inside CRM.
                      </p>
                    </div>
                  </div>

                  {/* Center: mini calendar - will grow to fill available space */}
                  <div className="flex justify-center">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm w-full max-w-[380px]">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <button
                          onClick={prevMiniMonth}
                          className="text-gray-400 hover:text-gray-700 text-lg px-2 transition-colors"
                          aria-label="Previous month"
                        >
                          ‹
                        </button>
                        <span className="text-sm font-semibold text-gray-800">
                          {MONTHS[miniMonth]} {miniYear}
                        </span>
                        <button
                          onClick={nextMiniMonth}
                          className="text-gray-400 hover:text-gray-700 text-lg px-2 transition-colors"
                          aria-label="Next month"
                        >
                          ›
                        </button>
                      </div>

                      <div className="grid grid-cols-7 text-center mb-2">
                        {MINI_DAY_LABELS.map((d, i) => (
                          <div
                            key={i}
                            className="text-[11px] text-gray-400 font-medium py-1"
                          >
                            {d}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 text-center gap-y-1">
                        {cells.map((cell, i) => {
                          const isTodayCell =
                            cell.type === "curr" &&
                            cell.day === today.getDate() &&
                            miniMonth === today.getMonth() &&
                            miniYear === today.getFullYear();
                          const base =
                            "mx-auto flex items-center justify-center text-sm rounded-full transition-all";
                          return (
                            <button
                              key={i}
                              className={[
                                base,
                                isTodayCell
                                  ? "bg-blue-600 text-white font-semibold w-8 h-8 shadow-md"
                                  : cell.type !== "curr"
                                    ? "text-gray-300 w-7 h-7"
                                    : "text-gray-700 hover:bg-blue-50 w-7 h-7",
                              ].join(" ")}
                              aria-current={isTodayCell ? "date" : undefined}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: visible events - smaller */}
                  <div className="w-full max-w-[320px] border border-gray-200 rounded-xl p-4 bg-white">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">
                      Visible events this week
                    </h3>
                    <p className="text-xs text-gray-400">
                      No events scheduled for this week yet.
                    </p>
                  </div>
                </div>
              </div>

              {/* Weekly calendar separated into its own card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <div
                  className="grid border-b border-gray-200"
                  style={{ gridTemplateColumns: "70px repeat(7, 1fr)" }}
                >
                  <div className="py-2 pr-2 text-right text-xs text-gray-400 flex items-end justify-end pb-2">
                    GMT+05:30
                  </div>
                  {weekDays.map((d, i) => (
                    <div
                      key={i}
                      className="border-l border-gray-200 py-2 text-center"
                    >
                      <div
                        className={`text-[10px] font-semibold tracking-wider uppercase ${isToday(d) ? "text-blue-600" : "text-gray-400"}`}
                      >
                        {DAY_NAMES[i]}
                      </div>
                      <div
                        className={`text-xl font-normal w-8 h-8 flex items-center justify-center rounded-full mx-auto mt-1 ${isToday(d) ? "bg-blue-600 text-white" : "text-gray-900"}`}
                      >
                        {d.getDate()}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className="overflow-y-auto relative"
                  style={{ maxHeight: 520 }}
                  ref={weekGridRef}
                >
                  {/* current time red line overlay */}
                  <div
                    style={{
                      position: "absolute",
                      left: 70,
                      right: 0,
                      top: linePos.top,
                      pointerEvents: "none",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          height: 2,
                          background: "#ef4444",
                          boxShadow: "0 0 6px rgba(239,68,68,0.6)",
                        }}
                      />
                      {/* red dot at current day */}
                      <div
                        style={{
                          position: "absolute",
                          left: linePos.left - 6,
                          top: -6,
                          width: 12,
                          height: 12,
                          borderRadius: 9999,
                          background: "#ef4444",
                          boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                        }}
                      />
                    </div>
                  </div>

                  {HOURS.map((hour, hi) => (
                    <div
                      key={hi}
                      className="grid"
                      style={{
                        gridTemplateColumns: "70px repeat(7, 1fr)",
                        minHeight: 44,
                      }}
                    >
                      <div className="text-right pr-3 pt-1 text-xs text-gray-400">
                        {hour}
                      </div>
                      {Array.from({ length: 7 }).map((_, di) => (
                        <div
                          key={di}
                          className="border-l border-t border-gray-100"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
