"use client";

import React, { useMemo, useState } from "react";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import {
  disconnectGoogleCalendar,
  fetchGoogleCalendarConnectUrl,
  fetchGoogleCalendarStatus,
  fetchGoogleMyEvents,
} from "@/lib/google-calendar-client";

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
type CalendarEvent = {
  id?: string;
  summary?: string;
  start?: string;
  end?: string;
  htmlLink?: string;
};

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
  const [gConnected, setGConnected] = useState(false);
  const [gEmail, setGEmail] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const [gErr, setGErr] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);

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

  const weekIsoRange = useMemo(() => {
    const min = new Date(weekStart);
    min.setHours(0, 0, 0, 0);
    const max = new Date(weekStart);
    max.setDate(max.getDate() + 7);
    max.setHours(0, 0, 0, 0);
    return { timeMin: min.toISOString(), timeMax: max.toISOString() };
  }, [weekStart]);

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

  const refreshGoogleStatus = React.useCallback(async () => {
    try {
      setGErr("");
      const s = await fetchGoogleCalendarStatus();
      setGConnected(Boolean(s.connected));
      setGEmail(typeof s.googleEmail === "string" ? s.googleEmail : "");
    } catch (e) {
      setGConnected(false);
      setGEmail("");
      setGErr(e instanceof Error ? e.message : "Google status failed");
    }
  }, []);

  React.useEffect(() => {
    void refreshGoogleStatus();
  }, [refreshGoogleStatus]);

  React.useEffect(() => {
    if (!gConnected) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    void fetchGoogleMyEvents(weekIsoRange.timeMin, weekIsoRange.timeMax)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((e) => {
        if (!cancelled) setGErr(e instanceof Error ? e.message : "Could not load events");
      });
    return () => {
      cancelled = true;
    };
  }, [gConnected, weekIsoRange.timeMax, weekIsoRange.timeMin]);

  const handleConnect = React.useCallback(async () => {
    setGBusy(true);
    try {
      const u = await fetchGoogleCalendarConnectUrl();
      window.location.href = u;
    } catch (e) {
      setGErr(e instanceof Error ? e.message : "Connect failed");
      setGBusy(false);
    }
  }, []);

  const handleDisconnect = React.useCallback(async () => {
    setGBusy(true);
    try {
      await disconnectGoogleCalendar();
      setGConnected(false);
      setGEmail("");
      setEvents([]);
    } catch (e) {
      setGErr(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setGBusy(false);
    }
  }, []);

  return (
    <div
      className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
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

        <div className="bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-y-auto">
          <div className="flex items-center gap-3 border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] px-6 py-3">
            <div className="w-9 h-9 rounded-md overflow-hidden flex flex-col items-center justify-center bg-[var(--crm-danger)] text-white flex-shrink-0">
              <span className="text-[7px] font-bold uppercase tracking-wide bg-[var(--crm-danger-text)] w-full text-center leading-tight py-px">
                July
              </span>
              <span className="text-base font-bold leading-tight">17</span>
            </div>
            <h1 className="text-lg font-semibold text-[var(--crm-text-primary)]">
              HUB Calendar
            </h1>
          </div>

          <main className="px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[1400px]">
              {/* ── Subtitle ── */}
              <p className="mb-5 max-w-xl text-sm leading-relaxed text-[var(--crm-text-muted)]">
                Connect your account once, then view your calendar events
                directly inside CRM with the same weekly calendar layout used in
                the design module.
              </p>

              {/* ── Main card ── */}
              <div className="mb-6 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
                {/* Card header */}
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--crm-accent-soft)] text-xl font-semibold text-[var(--crm-accent)]">
                    {today.getDate()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--crm-text-primary)]">
                      Calendar
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--crm-text-muted)]">
                      Your events plus all team events
                    </p>
                  </div>
                </div>

                {/* Card body: responsive 3-column grid - left, center (grows), right */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,240px)_minmax(420px,1fr)_minmax(200px,320px)] gap-6 items-start">
                  {/* Left: connect + status */}
                  <div className="flex flex-col gap-3">
                    {!gConnected ? (
                      <button
                        onClick={() => void handleConnect()}
                        disabled={gBusy}
                        className="w-full rounded-full bg-[var(--crm-accent)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--crm-shadow-sm)] transition-colors hover:brightness-110 disabled:opacity-60"
                      >
                        {gBusy ? "Connecting..." : "Connect HUB Calendar"}
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleDisconnect()}
                        disabled={gBusy}
                        className="w-full rounded-full border border-rose-300 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700 shadow-[var(--crm-shadow-sm)] transition-colors hover:bg-rose-100 disabled:opacity-60"
                      >
                        {gBusy ? "Disconnecting..." : "Disconnect Google Calendar"}
                      </button>
                    )}
                    <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3">
                      <span
                        className={`mb-2 inline-block rounded px-2.5 py-0.5 text-xs font-semibold ${
                          gConnected
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[var(--crm-neutral-bg)] text-[var(--crm-neutral-text)]"
                        }`}
                      >
                        {gConnected ? "Connected" : "Not Connected"}
                      </span>
                      <p className="text-xs leading-relaxed text-[var(--crm-text-muted)]">
                        {gConnected
                          ? `Connected account: ${gEmail || "Google user"}`
                          : "No account connected. Connect once to load your calendar events inside CRM."}
                      </p>
                      {gErr ? <p className="mt-2 text-xs text-rose-600">{gErr}</p> : null}
                    </div>
                  </div>

                  {/* Center: mini calendar - will grow to fill available space */}
                  <div className="flex justify-center">
                    <div className="w-full max-w-[380px] rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-[var(--crm-shadow-sm)]">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <button
                          onClick={prevMiniMonth}
                          className="px-2 text-lg text-[var(--crm-text-muted)] transition-colors hover:text-[var(--crm-text-primary)]"
                          aria-label="Previous month"
                        >
                          ‹
                        </button>
                        <span className="text-sm font-semibold text-[var(--crm-text-primary)]">
                          {MONTHS[miniMonth]} {miniYear}
                        </span>
                        <button
                          onClick={nextMiniMonth}
                          className="px-2 text-lg text-[var(--crm-text-muted)] transition-colors hover:text-[var(--crm-text-primary)]"
                          aria-label="Next month"
                        >
                          ›
                        </button>
                      </div>

                      <div className="grid grid-cols-7 text-center mb-2">
                        {MINI_DAY_LABELS.map((d, i) => (
                          <div
                            key={i}
                            className="py-1 text-[11px] font-medium text-[var(--crm-text-muted)]"
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
                                  ? "h-8 w-8 bg-[var(--crm-accent)] font-semibold text-white shadow-[var(--crm-shadow-sm)]"
                                  : cell.type !== "curr"
                                    ? "h-7 w-7 text-[var(--crm-border-strong)]"
                                    : "h-7 w-7 text-[var(--crm-text-secondary)] hover:bg-[var(--crm-accent-soft)]",
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
                  <div className="w-full max-w-[320px] rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
                    <h3 className="mb-2 text-sm font-semibold text-[var(--crm-text-primary)]">
                      Visible events this week
                    </h3>
                    {!gConnected ? (
                      <p className="text-xs text-[var(--crm-text-muted)]">
                        Connect Google Calendar to load events.
                      </p>
                    ) : events.length === 0 ? (
                      <p className="text-xs text-[var(--crm-text-muted)]">
                        No events scheduled for this week yet.
                      </p>
                    ) : (
                      <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                        {events.slice(0, 20).map((ev, i) => (
                          <a
                            key={ev.id ?? `ev-${i}`}
                            href={ev.htmlLink || "#"}
                            target={ev.htmlLink ? "_blank" : undefined}
                            rel={ev.htmlLink ? "noopener noreferrer" : undefined}
                            className="block rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 hover:border-[var(--crm-border-strong)]"
                          >
                            <p className="text-[12px] font-semibold text-[var(--crm-text-primary)]">
                              {ev.summary || "(No title)"}
                            </p>
                            <p className="text-[11px] text-[var(--crm-text-muted)]">
                              {ev.start ? new Date(ev.start).toLocaleString() : "Time not set"}
                            </p>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Weekly calendar separated into its own card */}
              <div className="mb-6 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
                <div
                  className="grid border-b border-[var(--crm-border)]"
                  style={{ gridTemplateColumns: "70px repeat(7, 1fr)" }}
                >
                  <div className="flex items-end justify-end py-2 pb-2 pr-2 text-right text-xs text-[var(--crm-text-muted)]">
                    GMT+05:30
                  </div>
                  {weekDays.map((d, i) => (
                    <div
                      key={i}
                      className="border-l border-[var(--crm-border)] py-2 text-center"
                    >
                      <div
                        className={`text-[10px] font-semibold tracking-wider uppercase ${isToday(d) ? "text-[var(--crm-accent)]" : "text-[var(--crm-text-muted)]"}`}
                      >
                        {DAY_NAMES[i]}
                      </div>
                      <div
                        className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-xl font-normal ${isToday(d) ? "bg-[var(--crm-accent)] text-white" : "text-[var(--crm-text-primary)]"}`}
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
                          background: "var(--crm-danger)",
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
                          background: "var(--crm-danger)",
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
                      <div className="pt-1 pr-3 text-right text-xs text-[var(--crm-text-muted)]">
                        {hour}
                      </div>
                      {Array.from({ length: 7 }).map((_, di) => (
                        <div
                          key={di}
                          className="border-l border-t border-[var(--crm-border)]"
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
