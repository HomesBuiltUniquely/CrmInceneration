"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type ActivityKind = "note" | "update" | "call";
type FilterId = "all" | "calls" | "notes" | "updates";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  timestamp: string;
  author: string;
  detail: string;
};

const SUMMARY_ITEMS = [
  { title: "Lead Created", time: "Oct 12, 09:15 AM", icon: "user-plus" as const },
  { title: "Meeting Scheduled", time: "Nov 15, 02:30 PM", icon: "calendar" as const },
  { title: "Call Logged", time: "Nov 22, 10:30 AM", icon: "phone" as const },
];

const ACTIVITIES: ActivityItem[] = [
  {
    id: "1",
    kind: "note",
    title: "STILL PROPERTY NOT YET CONSTRUCTED. CUSTOMER IS LOOKING FOR A RENTAL PROPERTY.",
    timestamp: "17 June 2026, 12:14:13 PM",
    author: "Meghana",
    detail:
      "STILL PROPERTY NOT YET CONSTRUCTED. CUSTOMER IS LOOKING FOR A RENTAL PROPERTY.",
  },
  {
    id: "2",
    kind: "update",
    title: "Milestone updated to Experience / Meeting Scheduled",
    timestamp: "16 June 2026, 04:22:01 PM",
    author: "Meghana",
    detail: "Experience → Meeting Scheduled",
  },
  {
    id: "3",
    kind: "note",
    title: "Customer requested callback after site visit photos are shared.",
    timestamp: "15 June 2026, 11:08:44 AM",
    author: "Sarah Jenkins",
    detail: "Follow up once photos are uploaded to reference gallery.",
  },
  {
    id: "4",
    kind: "call",
    title: "Outbound call logged — no answer, left voicemail.",
    timestamp: "14 June 2026, 09:31:20 AM",
    author: "Meghana",
    detail: "Attempted contact on primary number.",
  },
];

const FILTER_COUNTS = {
  all: 29,
  calls: 1,
  notes: 3,
  updates: 25,
};

function getCenteredPanelPosition(panelWidth: number, panelHeight: number) {
  const margin = 16;
  const x = (window.innerWidth - panelWidth) / 2;
  const y = (window.innerHeight - panelHeight) / 2;
  return clampPanelPosition(x, y, panelWidth, panelHeight);
}

function clampPanelPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
) {
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, x), window.innerWidth - panelWidth - margin),
    y: Math.min(Math.max(margin, y), window.innerHeight - panelHeight - margin),
  };
}

export default function ActivityHistoryWithConnector() {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [open, setOpen] = useState(false);
  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });

  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState(ACTIVITIES[0]?.id ?? "");

  const selected = ACTIVITIES.find((a) => a.id === selectedId) ?? ACTIVITIES[0];

  const openPanel = () => {
    const panelWidth = Math.min(920, window.innerWidth - 32);
    const estimatedHeight = Math.min(560, window.innerHeight - 48);
    setPanelPosition(getCenteredPanelPosition(panelWidth, estimatedHeight));
    setPanelEntered(false);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const centered = getCenteredPanelPosition(rect.width, rect.height);
    setPanelPosition(centered);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const closePanel = useCallback(() => {
    setPanelEntered(false);
    window.setTimeout(() => setOpen(false), 280);
  }, []);

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    const rect = panelRef.current.getBoundingClientRect();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    const next = clampPanelPosition(
      event.clientX - dragOffsetRef.current.x,
      event.clientY - dragOffsetRef.current.y,
      rect.width,
      rect.height,
    );

    panelRef.current.style.left = `${next.x}px`;
    panelRef.current.style.top = `${next.y}px`;
    setPanelPosition(next);
  }, []);

  const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closePanel]);

  return (
    <>
      <article className="rounded-xl border border-[#e0e5ec] bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Activity History</p>

        <ul className="mt-3 space-y-3">
          {SUMMARY_ITEMS.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f3f4f6] text-[#9ca3af]">
                <SummaryIcon type={item.icon} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">{item.title}</p>
                <p className="text-[11px] text-[#9ca3af]">{item.time}</p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={openPanel}
          aria-expanded={open}
          className={`group/btn mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[11px] font-black uppercase tracking-wide transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10b981] active:scale-[0.97] ${
            open
              ? "border-[#10b981] bg-[#d1fae5] text-[#047857] shadow-md"
              : "border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] hover:-translate-y-0.5 hover:border-[#10b981] hover:bg-[#d1fae5] hover:text-[#047857] hover:shadow-lg"
          }`}
        >
          View All Activity
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </article>

      {open ? (
        <div
          className={`fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
            panelEntered ? "opacity-100" : "opacity-0"
          }`}
          onClick={closePanel}
          aria-hidden="true"
        />
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          className={`fixed z-[95] flex max-h-[calc(100vh-6rem)] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            panelEntered ? "scale-100 opacity-100" : "scale-[0.86] opacity-0"
          }`}
          style={{ left: panelPosition.x, top: panelPosition.y }}
          role="dialog"
          aria-modal="true"
          aria-label="Activity History"
        >
          <div
            className={`flex items-center justify-between border-b border-[#eef1f5] px-5 py-4 select-none touch-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#fef3c7] text-[#d97706]">
                📋
              </span>
              <h2 className="text-[13px] font-black uppercase tracking-[0.08em] text-[#374151]">
                Activity History
              </h2>
              <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[10px] font-bold text-[#3b82f6]">
                {FILTER_COUNTS.all} EVENTS
              </span>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-md px-2 py-1 text-[18px] leading-none text-[#9ca3af] hover:bg-[#f3f4f6]"
              aria-label="Close activity history"
            >
              ×
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-[#eef1f5] px-5 py-3">
            <FilterPill
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`All ${FILTER_COUNTS.all}`}
            />
            <FilterPill
              active={filter === "calls"}
              onClick={() => setFilter("calls")}
              label={`Calls ${FILTER_COUNTS.calls}`}
              icon="📞"
            />
            <FilterPill
              active={filter === "notes"}
              onClick={() => setFilter("notes")}
              label={`Notes ${FILTER_COUNTS.notes}`}
              icon="📝"
            />
            <FilterPill
              active={filter === "updates"}
              onClick={() => setFilter("updates")}
              label={`Updates ${FILTER_COUNTS.updates}`}
              icon="🔄"
            />
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="min-h-0 border-b border-[#eef1f5] lg:border-b-0 lg:border-r">
              <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                {FILTER_COUNTS.all} In All
              </p>
              <ul className="max-h-[420px] overflow-y-auto">
                {ACTIVITIES.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full border-b border-[#f1f5f9] px-4 py-3 text-left transition ${
                        selectedId === item.id ? "bg-[#eff6ff]" : "hover:bg-[#f9fafb]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <KindBadge kind={item.kind} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
                              {item.kind}
                            </p>
                            <p className="shrink-0 text-[10px] text-[#9ca3af]">{item.timestamp}</p>
                          </div>
                          <p className="mt-1 text-[12px] font-semibold leading-snug text-[#111827]">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[#9ca3af]">{item.author}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-h-[280px] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Event Detail</p>
              {selected ? (
                <div className="mt-3">
                  <div className="flex items-start justify-between gap-2">
                    <KindBadge kind={selected.kind} />
                    <p className="text-[10px] text-[#9ca3af]">{selected.timestamp}</p>
                  </div>
                  <p className="mt-3 text-[14px] font-bold leading-snug text-[#111827]">{selected.title}</p>
                  <div className="mt-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
                    <p className="text-[12px] text-[#6b7280]">—</p>
                    <p className="mt-2 text-[12px] text-[#9ca3af]">→</p>
                    <p className="mt-2 font-mono text-[12px] font-semibold text-[#10b981]">{selected.detail}</p>
                  </div>
                  <p className="mt-3 text-[11px] text-[#9ca3af]">👤 By: {selected.author}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
        active
          ? "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]"
          : "border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d1d5db] hover:bg-[#f9fafb]"
      }`}
    >
      {icon ? <span>{icon}</span> : null}
      {label}
    </button>
  );
}

function KindBadge({ kind }: { kind: ActivityKind }) {
  const styles =
    kind === "note"
      ? "bg-[#fef3c7] text-[#d97706]"
      : kind === "call"
        ? "bg-[#fee2e2] text-[#dc2626]"
        : "bg-[#dbeafe] text-[#2563eb]";

  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-black uppercase ${styles}`}
    >
      {kind === "note" ? "N" : kind === "call" ? "C" : "U"}
    </span>
  );
}

function SummaryIcon({ type }: { type: "user-plus" | "calendar" | "phone" }) {
  if (type === "user-plus") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    );
  }
  if (type === "calendar") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.8.62 2.66a2 2 0 0 1-.45 2.11L8 9.92a16 16 0 0 0 6.08 6.08l1.43-1.28a2 2 0 0 1 2.11-.45c.86.29 1.76.5 2.66.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
