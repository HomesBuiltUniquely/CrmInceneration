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

// Update CalendarEvent to include details for the Intelligent Modal
type CalendarEvent = {
  id?: string;
  summary?: string;
  start?: string;
  end?: string;
  htmlLink?: string;
  description?: string;
  organizer?: { email?: string; displayName?: string };
  attendees?: { email?: string; displayName?: string }[];
};

type Cell = { day: number; type: "prev" | "curr" | "next" };

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function HubCalendarPage(): React.ReactElement | null {
  const [role, setRole] = React.useState("SUPER_ADMIN");
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
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
  
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Handle OAuth Redirect Status
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        setSuccessMsg("Successfully connected to Google Calendar!");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("error")) {
        setGErr("Connection failed: " + params.get("error"));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Clear success message quickly
  React.useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Mini calendar cells
  const { cells } = useMemo(() => {
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

  const jumpGoogleCalendarToday = () => {
    setWeekOffset(0);
    setMiniMonth(today.getMonth());
    setMiniYear(today.getFullYear());
  };

  const handleDayClick = (cellDay: number, type: "prev" | "curr" | "next") => {
    let m = miniMonth;
    let y = miniYear;
    if (type === "prev") {
      if (m === 0) { m = 11; y--; } else m--;
    } else if (type === "next") {
      if (m === 11) { m = 0; y++; } else m++;
    }
    const clickedDate = new Date(y, m, cellDay);
    clickedDate.setHours(0, 0, 0, 0);
    
    const todayZero = new Date(today);
    todayZero.setHours(0, 0, 0, 0);
    todayZero.setDate(todayZero.getDate() - todayZero.getDay());
    
    const targetZero = new Date(clickedDate);
    targetZero.setDate(targetZero.getDate() - targetZero.getDay());
    
    const diffDays = Math.round((targetZero.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24));
    setWeekOffset(Math.round(diffDays / 7));
    
    if (type !== "curr") {
       setMiniMonth(m);
       setMiniYear(y);
    }
  };

  // Week view
  const getWeekStart = (offset: number): Date => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const weekStart = useMemo(() => getWeekStart(weekOffset), [today, weekOffset]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

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
  const [linePos, setLinePos] = React.useState<{ top: number; left: number; width: number; }>({ top: 0, left: 0, width: 0 });

  React.useEffect(() => {
    const updateLine = () => {
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const rowHeight = 44; // matches minHeight used for rows
      const top = (minutesSinceMidnight / 60) * rowHeight;

      const grid = weekGridRef.current;
      if (!grid) return;
      const containerWidth = grid.clientWidth;
      const timeCol = 70;
      const contentWidth = Math.max(0, containerWidth - timeCol);
      const colWidth = contentWidth / 7;

      const todayIndex = weekDays.findIndex((d) => isToday(d));
      const left = timeCol + (todayIndex >= 0 ? todayIndex * colWidth + colWidth / 2 : 0);
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
  }, [weekDays, mounted]);

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

  const refreshEvents = React.useCallback(async () => {
    if (!gConnected) return;
    try {
      const rows = await fetchGoogleMyEvents(weekIsoRange.timeMin, weekIsoRange.timeMax);
      setEvents(rows);
    } catch (e) {
      setGErr(e instanceof Error ? e.message : "Could not load events");
    }
  }, [gConnected, weekIsoRange.timeMin, weekIsoRange.timeMax]);

  React.useEffect(() => {
    if (gConnected) {
      refreshEvents();
      // 60-second auto-refresh polling
      const timer = setInterval(refreshEvents, 60000);
      return () => clearInterval(timer);
    } else {
      setEvents([]);
    }
  }, [gConnected, refreshEvents]);

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
      setSuccessMsg("Calendar disconnected successfully.");
    } catch (e) {
      setGErr(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setGBusy(false);
    }
  }, []);

  // Logic to plot events onto the 24-hr `weekGridRef` timeline grid
  const positionedEvents = useMemo(() => {
    const validEvents = events.filter(e => e.start && e.end && e.start.includes("T"));
    
    // Group by day index (0-6) based on weekStart reference
    const ds = Array.from({length: 7}, () => [] as any[]);
    validEvents.forEach(e => {
        const sd = new Date(e.start!);
        const dIdx = sd.getDay();
        ds[dIdx].push({
            ...e,
            startMin: sd.getHours() * 60 + sd.getMinutes(),
            endMin: new Date(e.end!).getHours() * 60 + new Date(e.end!).getMinutes()
        });
    });

    const result: { ev: CalendarEvent, style: React.CSSProperties }[] = [];
    ds.forEach((dayEvents, dIdx) => {
        dayEvents.sort((a, b) => a.startMin - b.startMin);
        
        const columns: any[][] = [];
        dayEvents.forEach(ev => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const lastEvInCol = columns[i][columns[i].length - 1];
                if (lastEvInCol.endMin <= ev.startMin) {
                    columns[i].push(ev);
                    placed = true;
                    break;
                }
            }
            if (!placed) columns.push([ev]);
        });

        columns.forEach((col, colIdx) => {
            col.forEach(ev => {
                const wPct = 100 / columns.length;
                const dMin = ev.endMin - ev.startMin;
                result.push({
                    ev,
                    style: {
                        position: "absolute",
                        top: `${(ev.startMin / 60) * 44}px`,
                        height: `${Math.max(20, (dMin / 60) * 44)}px`,
                        left: `calc(70px + ((100% - 70px) / 7 * ${dIdx}) + (((100% - 70px) / 7) * ${colIdx * wPct / 100}))`,
                        width: `calc(((100% - 70px) / 7) * ${wPct / 100} - 4px)`,
                        zIndex: 10
                    }
                });
            });
        });
    });
    return result;
  }, [events]);

  const allowedRoles = [
    "SUPER_ADMIN",
    "ADMIN",
    "SALES_ADMIN",
    "CRM_MANAGER",
    "SALES_MANAGER",
    "SALES_EXECUTIVE",
    "DESIGNER",
  ];
  const isAuthorized = allowedRoles.includes(role);

  if (!mounted) return null;

  return (
    <div
      className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Intelligent Event Modal */}
      {modalEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-2xl bg-[var(--crm-surface)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-[var(--crm-accent)] p-5 flex items-start justify-between text-white">
                      <div>
                         <h3 className="text-xl font-bold pr-4">{modalEvent.summary || "(No Title)"}</h3>
                         <p className="text-sm opacity-90 mt-1">
                            {new Date(modalEvent.start!).toLocaleString()} - {new Date(modalEvent.end!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </p>
                      </div>
                      <button onClick={() => setModalEvent(null)} className="opacity-80 hover:opacity-100 p-1 text-xl font-bold">✕</button>
                  </div>
                  <div className="p-6 space-y-5 text-sm text-[var(--crm-text-primary)]">
                      {modalEvent.organizer && (
                          <div className="flex items-start gap-3">
                              <span className="font-semibold text-[var(--crm-text-muted)] w-20 shrink-0">Organizer:</span>
                              <span className="break-all">{modalEvent.organizer.displayName || modalEvent.organizer.email}</span>
                          </div>
                      )}
                      {modalEvent.attendees && modalEvent.attendees.length > 0 && (
                          <div className="flex items-start gap-3">
                              <span className="font-semibold text-[var(--crm-text-muted)] w-20 shrink-0">Attendees:</span>
                              <div className="flex flex-wrap gap-1.5">
                                 {modalEvent.attendees.map((a, i) => (
                                    <span key={i} className="bg-[var(--crm-surface-subtle)] border border-[var(--crm-border)] px-2 py-0.5 rounded-full text-xs font-medium">
                                       {a.displayName || a.email}
                                    </span>
                                 ))}
                              </div>
                          </div>
                      )}
                      {modalEvent.description && (
                          <div className="flex items-start gap-3">
                              <span className="font-semibold text-[var(--crm-text-muted)] w-20 shrink-0">Details:</span>
                              <div dangerouslySetInnerHTML={{__html: modalEvent.description}} className="prose prose-sm prose-p:my-1 opacity-80 max-h-32 overflow-y-auto" />
                          </div>
                      )}
                  </div>
                  <div className="bg-[var(--crm-surface-elevated)] px-6 py-4 border-t border-[var(--crm-border)] flex justify-end">
                      <a 
                         href={modalEvent.htmlLink || "#"} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="rounded-full bg-[var(--crm-accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 shadow-sm"
                      >
                         Open in Web App
                      </a>
                  </div>
              </div>
          </div>
      )}

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
                {MONTHS[today.getMonth()].substring(0, 3)}
              </span>
              <span className="text-base font-bold leading-tight">{today.getDate()}</span>
            </div>
            <h1 className="text-lg font-semibold text-[var(--crm-text-primary)]">
              HUB Calendar
            </h1>
          </div>

          <main className="px-4 py-6 md:px-6 lg:px-8">
            {!isAuthorized ? (
                <div className="mx-auto flex max-w-xl h-64 flex-col items-center justify-center rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-sm">
                    <h2 className="text-2xl font-bold text-rose-600 mb-2">Access Denied</h2>
                    <p className="text-[var(--crm-text-muted)] text-center px-6">
                        Your role ({role}) is not authorized to view the Calendar functionalities.
                    </p>
                </div>
            ) : (
                <div className="mx-auto max-w-[1400px]">
                  {successMsg && (
                      <div className="mb-4 bg-emerald-100 text-emerald-800 px-4 py-3 border border-emerald-200 rounded-lg text-sm font-medium flex items-center justify-between">
                          <span>{successMsg}</span>
                          <button onClick={() => setSuccessMsg("")} className="opacity-70 hover:opacity-100 font-bold">✕</button>
                      </div>
                  )}

                  <p className="mb-5 max-w-xl text-sm leading-relaxed text-[var(--crm-text-muted)]">
                    Connect your account once, then view your calendar events directly inside CRM.
                  </p>

                  {/* ── Main card ── */}
                  <div className="mb-6 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex gap-3">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--crm-accent-soft)] text-xl font-semibold text-[var(--crm-accent)]">
                            {today.getDate()}
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold text-[var(--crm-text-primary)]">Calendar</h2>
                            <p className="mt-0.5 text-sm text-[var(--crm-text-muted)]">Your events plus all team events</p>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 bg-[var(--crm-surface-subtle)] p-1 rounded-lg border border-[var(--crm-border)]">
                          <button onClick={jumpGoogleCalendarToday} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--crm-surface)] hover:bg-[var(--crm-border)] text-[var(--crm-text-primary)] shadow-sm transition">
                             Today
                          </button>
                          <button onClick={() => setWeekOffset(o => o - 1)} className="p-1 px-3 rounded-md bg-[var(--crm-surface)] hover:bg-[var(--crm-border)] text-[var(--crm-text-primary)] text-sm shadow-sm transition">
                             ‹
                          </button>
                          <button onClick={() => setWeekOffset(o => o + 1)} className="p-1 px-3 rounded-md bg-[var(--crm-surface)] hover:bg-[var(--crm-border)] text-[var(--crm-text-primary)] text-sm shadow-sm transition">
                             ›
                          </button>
                          <button onClick={refreshEvents} className="ml-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--crm-accent)] text-white hover:brightness-110 shadow-sm transition">
                             Refresh
                          </button>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,240px)_minmax(420px,1fr)_minmax(200px,320px)] gap-6 items-start">
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
                          {gErr ? <p className="mt-2 text-xs font-medium text-rose-600">{gErr}</p> : null}
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <div className="w-full max-w-[380px] rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-[var(--crm-shadow-sm)]">
                          <div className="flex items-center justify-between mb-3 px-1">
                            <button
                              onClick={prevMiniMonth}
                              className="px-2 text-lg text-[var(--crm-text-muted)] transition-colors hover:text-[var(--crm-text-primary)]"
                            >
                              ‹
                            </button>
                            <span className="text-sm font-semibold text-[var(--crm-text-primary)]">
                              {MONTHS[miniMonth]} {miniYear}
                            </span>
                            <button
                              onClick={nextMiniMonth}
                              className="px-2 text-lg text-[var(--crm-text-muted)] transition-colors hover:text-[var(--crm-text-primary)]"
                            >
                              ›
                            </button>
                          </div>

                          <div className="grid grid-cols-7 text-center mb-2">
                            {MINI_DAY_LABELS.map((d, i) => (
                              <div key={i} className="py-1 text-[11px] font-medium text-[var(--crm-text-muted)]">{d}</div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 text-center gap-y-1">
                            {cells.map((cell, i) => {
                              const isTodayCell =
                                cell.type === "curr" &&
                                cell.day === today.getDate() &&
                                miniMonth === today.getMonth() &&
                                miniYear === today.getFullYear();
                              
                              return (
                                <button
                                  key={i}
                                  onClick={() => handleDayClick(cell.day, cell.type)}
                                  className={[
                                    "mx-auto flex items-center justify-center text-sm rounded-full transition-all",
                                    isTodayCell
                                      ? "h-8 w-8 bg-[var(--crm-accent)] font-semibold text-white shadow-sm"
                                      : cell.type !== "curr"
                                        ? "h-7 w-7 text-[var(--crm-border-strong)] hover:bg-[var(--crm-surface-subtle)]"
                                        : "h-7 w-7 text-[var(--crm-text-secondary)] hover:bg-[var(--crm-accent-soft)] hover:text-[var(--crm-accent)]",
                                  ].join(" ")}
                                >
                                  {cell.day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="w-full max-w-[320px] rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
                        <h3 className="mb-2 text-sm font-semibold text-[var(--crm-text-primary)]">Visible events this week</h3>
                        {!gConnected ? (
                          <p className="text-xs text-[var(--crm-text-muted)]">Connect Google Calendar to load events.</p>
                        ) : events.length === 0 ? (
                          <p className="text-xs text-[var(--crm-text-muted)]">No events scheduled for this week yet.</p>
                        ) : (
                          <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                            {events.slice(0, 20).map((ev, i) => (
                              <button
                                key={ev.id ?? `ev-${i}`}
                                onClick={() => setModalEvent(ev)}
                                className="block w-full text-left rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 hover:border-[var(--crm-accent)]"
                              >
                                <p className="text-[12px] font-semibold text-[var(--crm-text-primary)] truncate">
                                  {ev.summary || "(No title)"}
                                </p>
                                <p className="text-[11px] text-[var(--crm-text-muted)] pt-0.5">
                                  {ev.start ? new Date(ev.start).toLocaleString([], {weekday: 'short', hour:'2-digit', minute:'2-digit'}) : "Time not set"}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Weekly calendar */}
                  <div className="mb-6 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
                    <div className="flex items-center justify-between py-2 px-1 mb-2">
                       <h3 className="font-bold text-[var(--crm-text-primary)]">{MONTHS[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}</h3>
                    </div>
                    
                    <div className="grid border-b border-[var(--crm-border)]" style={{ gridTemplateColumns: "70px repeat(7, 1fr)" }}>
                      <div className="flex items-end justify-end py-2 pb-2 pr-2 text-right text-xs text-[var(--crm-text-muted)]">
                        GMT+05:30
                      </div>
                      {weekDays.map((d, i) => (
                        <div key={i} className="border-l border-[var(--crm-border)] py-2 text-center">
                          <div className={`text-[10px] font-semibold tracking-wider uppercase ${isToday(d) ? "text-[var(--crm-accent)]" : "text-[var(--crm-text-muted)]"}`}>
                            {DAY_NAMES[i]}
                          </div>
                          <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-xl font-normal ${isToday(d) ? "bg-[var(--crm-accent)] text-white shadow-sm" : "text-[var(--crm-text-primary)]"}`}>
                            {d.getDate()}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="overflow-y-auto relative" style={{ maxHeight: 520 }} ref={weekGridRef}>
                      {/* current time red line overlay */}
                      <div style={{ position: "absolute", left: 70, right: 0, top: linePos.top, pointerEvents: "none", zIndex: 20 }}>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "var(--crm-danger)", boxShadow: "0 0 6px rgba(239,68,68,0.6)" }} />
                          <div style={{ position: "absolute", left: linePos.left - 6, top: -6, width: 12, height: 12, borderRadius: 9999, background: "var(--crm-danger)", boxShadow: "0 0 8px rgba(239,68,68,0.6)" }} />
                        </div>
                      </div>

                      {/* Event Blocks */}
                      {positionedEvents.map((pe, i) => (
                          <div
                            key={pe.ev.id || i}
                            style={pe.style}
                            onClick={() => setModalEvent(pe.ev)}
                            className="overflow-hidden rounded bg-[var(--crm-accent-soft)] px-1.5 py-0.5 text-xs border-l-4 border-l-[var(--crm-accent)] shadow-sm hover:brightness-95 transition-all cursor-pointer overflow-ellipsis break-words"
                          >
                              <div className="font-semibold text-[var(--crm-accent)] text-[11px] leading-tight opacity-90">{pe.ev.summary || "(No title)"}</div>
                              {parseFloat(pe.style.height as string) > 30 && (
                                <div className="text-[9px] text-[var(--crm-accent)] opacity-80 mt-0.5">
                                  {new Date(pe.ev.start!).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                                </div>
                              )}
                          </div>
                      ))}

                      {HOURS.map((hour, hi) => (
                        <div key={hi} className="grid" style={{ gridTemplateColumns: "70px repeat(7, 1fr)", minHeight: 44 }}>
                          <div className="pt-1 pr-3 text-right text-xs text-[var(--crm-text-muted)] bg-[var(--crm-surface)] relative z-10">{hour}</div>
                          {Array.from({ length: 7 }).map((_, di) => (
                            <div key={di} className="border-l border-t border-[var(--crm-border)] border-dashed opacity-50" />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
