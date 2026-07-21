"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ActivityItem } from "@/lib/data";
import { formatCrmDateTime } from "@/lib/date-time-format";
import {
  V2_BTN_ACTIVITY_OPEN,
  V2_BTN_FILTER_PILL,
  V2_BTN_GHOST_ICON,
  V2_BTN_LIST_ITEM,
} from "./lead-detail-v2-motion";
import {
  isQuoteSentActivityText,
  pickQuoteSentMotivateLine,
} from "@/lib/quote-sent-motivate";

export type ActivityHistoryHandle = {
  openPanel: (activityId?: string) => void;
};

type ActivityKind = "note" | "update" | "call";
type FilterId = "all" | "calls" | "notes" | "updates";

type DisplayActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  timestamp: string;
  author: string;
  detail: string;
  isQuoteSent?: boolean;
  motivateLine?: string;
};

const MOCK_ACTIVITIES: DisplayActivityItem[] = [
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

const MOCK_FILTER_COUNTS = {
  all: 29,
  calls: 1,
  notes: 3,
  updates: 25,
};

function mapApiTypeToKind(type: ActivityItem["type"]): ActivityKind {
  if (type === "note") return "note";
  if (type === "call") return "call";
  return "update";
}

function extractQuoteIdFromActivityText(...parts: Array<string | null | undefined>): string {
  const text = parts.map((p) => String(p ?? "")).join(" ");
  const fromPath = text.match(/\/quote\/(\d+)/i);
  if (fromPath?.[1]) return fromPath[1];
  const fromHash = text.match(/#(\d{3,})/);
  if (fromHash?.[1]) return fromHash[1];
  return "";
}

function mapApiActivity(activity: ActivityItem): DisplayActivityItem {
  const detail =
    activity.note?.trim() ||
    (activity.change
      ? `${activity.change.old || "—"} → ${activity.change.new || "—"}`
      : activity.description);
  const isQuoteSent =
    activity.type === "quote_sent_to_customer" ||
    isQuoteSentActivityText(
      activity.type,
      activity.description,
      detail,
      activity.change?.new,
    );
  const quoteId = extractQuoteIdFromActivityText(
    activity.description,
    detail,
    activity.change?.new,
  );
  const title = isQuoteSent
    ? quoteId
      ? `Quote Sent to Customer ⭐ · #${quoteId}`
      : "Quote Sent to Customer ⭐"
    : formatActivitySummaryTitle(activity.description);
  return {
    id: activity.id,
    kind: mapApiTypeToKind(activity.type),
    title,
    timestamp: formatActivityDisplayTime(activity.timestamp),
    author: activity.by,
    detail: formatActivityDetailText(detail),
    isQuoteSent,
    motivateLine: isQuoteSent ? pickQuoteSentMotivateLine(activity.id) : undefined,
  };
}

/** Short, readable label for sidebar summary rows. */
function formatActivitySummaryTitle(raw: string): string {
  const text = raw.trim();
  if (!text) return "Activity";

  const verifyAssignMatch = text.match(
    /^Lead verified by\s+(.+?)(?:\s*\(Presales\))?\.\s*Assigned to\s+(.+)\.?$/i,
  );
  if (verifyAssignMatch) {
    const by = verifyAssignMatch[1].trim();
    const to = verifyAssignMatch[2].replace(/\.$/, "").trim();
    return `Verified by ${by} · Assigned to ${to}`;
  }

  const verifyOnlyMatch = text.match(
    /^Lead verified by\s+(.+?)(?:\s*\(Presales\))?\.\s*No sales executive assigned\.?$/i,
  );
  if (verifyOnlyMatch) {
    return `Verified by ${verifyOnlyMatch[1].trim()} · No assignment`;
  }

  // Legacy audit only — not Quote Sent tile signal.
  const quoteLinkMatch = text.match(
    /quote\s*link\s*(?:set|changed)(?:\s*to)?[:\s]*(https?:\/\/\S+)?/i,
  );
  if (quoteLinkMatch) {
    const qid = extractQuoteIdFromActivityText(text, quoteLinkMatch[1]);
    return qid ? `Quote link set · #${qid}` : "Quote link saved";
  }

  if (/^quote\s*sent\s*to\s*customer/i.test(text)) {
    const qid = extractQuoteIdFromActivityText(text);
    return qid ? `Quote Sent to Customer ⭐ · #${qid}` : "Quote Sent to Customer ⭐";
  }

  if (/\bquote\s*sent\b/i.test(text) && !/status\s*changed/i.test(text) && !/quote\s*link\s*set/i.test(text)) {
    const qid = extractQuoteIdFromActivityText(text);
    return qid ? `Quote Sent to Customer ⭐ · #${qid}` : "Quote Sent to Customer ⭐";
  }

  const followUpMatch = text.match(
    /follow\s*up\s*date\s*changed\s*from\s*(.+?)\s*to\s*(.+)/i,
  );
  if (followUpMatch) {
    const next = formatActivityDisplayTime(followUpMatch[2].trim());
    return `Follow-up date updated · ${next}`;
  }

  if (text.length > 80) return `${text.slice(0, 77)}…`;
  return text;
}

function formatActivityDisplayTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const formatted = formatCrmDateTime(trimmed);
  return formatted === "—" ? trimmed : formatted;
}

function formatActivityDetailText(value: string): string {
  const text = value.trim();
  if (!text) return "—";

  return text.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?/g,
    (iso) => formatActivityDisplayTime(iso),
  );
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

function activityListKey(activities: ActivityItem[] | undefined): string {
  if (!activities?.length) return "mock";
  return activities.map((item) => `${item.id}:${item.timestamp}:${item.description}`).join("|");
}

const ActivityHistoryWithConnector = forwardRef<
  ActivityHistoryHandle,
  { activities?: ActivityItem[] }
>(function ActivityHistoryWithConnector({ activities }, ref) {
  const activitiesKey = activityListKey(activities);
  const hasApiActivities = Boolean(activities && activities.length > 0);

  const displayActivities = useMemo(() => {
    if (hasApiActivities && activities) return activities.map(mapApiActivity);
    return MOCK_ACTIVITIES;
  }, [activities, activitiesKey, hasApiActivities]);

  const summaryItems = useMemo(
    () =>
      displayActivities.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        time: item.timestamp,
        icon:
          item.kind === "call"
            ? ("phone" as const)
            : item.kind === "note"
              ? ("user-plus" as const)
              : ("calendar" as const),
      })),
    [displayActivities],
  );

  const filterCounts = useMemo(
    () =>
      hasApiActivities
        ? displayActivities.reduce(
            (acc, item) => {
              acc.all += 1;
              if (item.kind === "call") acc.calls += 1;
              if (item.kind === "note") acc.notes += 1;
              if (item.kind === "update") acc.updates += 1;
              return acc;
            },
            { all: 0, calls: 0, notes: 0, updates: 0 },
          )
        : MOCK_FILTER_COUNTS,
    [displayActivities, hasApiActivities],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const detailPaneRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [open, setOpen] = useState(false);
  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [positionMode, setPositionMode] = useState<"centered" | "custom">("centered");
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState(displayActivities[0]?.id ?? "");

  const filteredActivities = useMemo(
    () =>
      displayActivities.filter((item) => {
        if (filter === "all") return true;
        if (filter === "calls") return item.kind === "call";
        if (filter === "notes") return item.kind === "note";
        return item.kind === "update";
      }),
    [displayActivities, filter],
  );

  const selected =
    filteredActivities.find((a) => a.id === selectedId) ||
    displayActivities.find((a) => a.id === selectedId) ||
    filteredActivities[0] ||
    displayActivities[0];

  // Only reset when the activity list content changes — not on every render.
  useEffect(() => {
    setSelectedId((prev) => {
      if (prev && displayActivities.some((item) => item.id === prev)) return prev;
      return displayActivities[0]?.id ?? "";
    });
  }, [activitiesKey, displayActivities]);

  // Keep detail in sync when the active filter hides the current selection.
  useEffect(() => {
    if (!filteredActivities.length) return;
    if (filteredActivities.some((item) => item.id === selectedId)) return;
    setSelectedId(filteredActivities[0].id);
  }, [filteredActivities, selectedId]);

  const selectActivity = useCallback((activityId: string) => {
    setSelectedId(activityId);
    window.requestAnimationFrame(() => {
      detailPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const openPanel = useCallback(
    (activityId?: string) => {
      if (activityId && displayActivities.some((item) => item.id === activityId)) {
        setFilter("all");
        setSelectedId(activityId);
      }
      setPositionMode("centered");
      setPanelEntered(false);
      setOpen(true);
    },
    [displayActivities],
  );

  useImperativeHandle(ref, () => ({ openPanel }), [openPanel]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const closePanel = useCallback(() => {
    setPanelEntered(false);
    window.setTimeout(() => {
      setOpen(false);
      setPositionMode("centered");
    }, 280);
  }, []);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!panelRef.current || event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button")) return;

      const rect = panelRef.current.getBoundingClientRect();
      if (positionMode === "centered") {
        setPositionMode("custom");
        setPanelPosition({ x: rect.left, y: rect.top });
      }
      isDraggingRef.current = true;
      setIsDragging(true);
      dragOffsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [positionMode],
  );

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

  const panelTransform =
    positionMode === "centered"
      ? panelEntered
        ? "translate(-50%, -50%) scale(1)"
        : "translate(-50%, -50%) scale(0.86)"
      : panelEntered
        ? "scale(1)"
        : "scale(0.86)";

  const panelStyle =
    positionMode === "centered"
      ? { left: "50%", top: "50%", transform: panelTransform }
      : { left: panelPosition.x, top: panelPosition.y, transform: panelTransform };

  const modal =
    open && portalReady
      ? createPortal(
          <>
            <div
              className={`fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
                panelEntered ? "opacity-100" : "opacity-0"
              }`}
              onClick={closePanel}
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              className={`fixed z-[95] flex h-[min(760px,calc(100vh-2rem))] w-[min(1180px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                panelEntered ? "opacity-100" : "opacity-0"
              }`}
              style={panelStyle}
              role="dialog"
              aria-modal="true"
              aria-label="Activity History"
              data-no-dblclick-close
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
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151]">
                    Activity History
                  </h2>
                  <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[10px] font-bold text-[#3b82f6]">
                    {filterCounts.all} EVENTS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className={`rounded-md px-2 py-1 text-[18px] leading-none text-[#9ca3af] ${V2_BTN_GHOST_ICON}`}
                  aria-label="Close activity history"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-[#eef1f5] px-5 py-3">
                <FilterPill
                  active={filter === "all"}
                  onClick={() => setFilter("all")}
                  label={`All ${filterCounts.all}`}
                />
                <FilterPill
                  active={filter === "calls"}
                  onClick={() => setFilter("calls")}
                  label={`Calls ${filterCounts.calls}`}
                  icon="📞"
                />
                <FilterPill
                  active={filter === "notes"}
                  onClick={() => setFilter("notes")}
                  label={`Notes ${filterCounts.notes}`}
                  icon="📝"
                />
                <FilterPill
                  active={filter === "updates"}
                  onClick={() => setFilter("updates")}
                  label={`Updates ${filterCounts.updates}`}
                  icon="🔄"
                />
              </div>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="flex min-h-0 flex-col border-b border-[#eef1f5] lg:border-b-0 lg:border-r">
                  <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                      {filteredActivities.length} In {filter === "all" ? "All" : filter}
                    </p>
                    <p className="text-[10px] font-medium text-[#94a3b8]">
                      Click once to view details
                    </p>
                  </div>
                  <ul className="min-h-0 flex-1 overflow-y-auto">
                    {filteredActivities.map((item) => {
                      const isQuote = Boolean(item.isQuoteSent);
                      const selectedRow = selected?.id === item.id;
                      return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectActivity(item.id)}
                          aria-pressed={selectedRow}
                          className={`w-full border-b px-4 py-3 text-left ${
                            isQuote
                              ? selectedRow
                                ? "border-emerald-200 bg-[#d1fae5]"
                                : `border-emerald-100 bg-[#ecfdf5] text-[#065f46] ${V2_BTN_LIST_ITEM}`
                              : selectedRow
                                ? "border-[#f1f5f9] bg-[#eff6ff]"
                                : `border-[#f1f5f9] text-[#475569] ${V2_BTN_LIST_ITEM}`
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <KindBadge kind={item.kind} quoteSent={isQuote} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={`text-[10px] font-bold uppercase tracking-wide ${
                                    isQuote ? "text-emerald-700" : "text-[#9ca3af]"
                                  }`}
                                >
                                  {isQuote ? "Quote Sent to Customer ⭐" : item.kind}
                                </p>
                                <p
                                  className={`shrink-0 text-[10px] ${
                                    isQuote ? "text-emerald-600/80" : "text-[#9ca3af]"
                                  }`}
                                >
                                  {item.timestamp}
                                </p>
                              </div>
                              <p
                                className={`mt-1 line-clamp-2 text-[12px] font-semibold leading-snug ${
                                  isQuote ? "text-emerald-950" : "text-[#111827]"
                                }`}
                                title={item.title}
                              >
                                {item.title}
                              </p>
                              {isQuote && item.motivateLine ? (
                                <p className="mt-1 line-clamp-2 text-[11px] font-medium italic leading-snug text-emerald-800">
                                  {item.motivateLine}
                                </p>
                              ) : null}
                              <p
                                className={`mt-1 truncate text-[11px] ${
                                  isQuote ? "text-emerald-700/70" : "text-[#9ca3af]"
                                }`}
                              >
                                {item.author}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                </div>

                <div ref={detailPaneRef} className="min-h-0 overflow-y-auto p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                    Event Detail
                  </p>
                  {selected ? (
                    <div className="mt-3">
                      <div className="flex items-start justify-between gap-2">
                        <KindBadge kind={selected.kind} quoteSent={Boolean(selected.isQuoteSent)} />
                        <p className="text-[10px] text-[#9ca3af]">{selected.timestamp}</p>
                      </div>
                      <p className="mt-3 text-[14px] font-bold leading-snug text-[#111827]">
                        {selected.title}
                      </p>
                      {selected.isQuoteSent && selected.motivateLine ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-[#ecfdf5] px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                            Keep going
                          </p>
                          <p className="mt-1 text-[13px] font-semibold leading-snug text-emerald-900">
                            {selected.motivateLine}
                          </p>
                        </div>
                      ) : null}
                      <div
                        className={`mt-3 rounded-lg border p-3 ${
                          selected.isQuoteSent
                            ? "border-emerald-100 bg-[#f0fdf4]"
                            : "border-[#e5e7eb] bg-[#f9fafb]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[#374151]">
                          {selected.detail}
                        </p>
                      </div>
                      <p className="mt-3 text-[11px] text-[#9ca3af]">👤 By: {selected.author}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <article className="rounded-xl border border-[#e0e5ec] bg-white p-4" data-no-dblclick-close>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
          Activity History
        </p>
        <p className="mt-1 text-[11px] text-[#94a3b8]">Click a note to open details</p>

        <ul className="mt-3 divide-y divide-[#f1f5f9]">
          {summaryItems.map((item) => {
            const full = displayActivities.find((a) => a.id === item.id);
            const isQuote = Boolean(full?.isQuoteSent);
            return (
            <li key={item.id} className="first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => openPanel(item.id)}
                className={`flex w-full gap-3 rounded-lg px-1 py-3 text-left ${
                  isQuote ? "bg-[#ecfdf5]" : ""
                } ${V2_BTN_LIST_ITEM}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isQuote
                      ? "bg-[#d1fae5] text-emerald-700"
                      : "bg-[#f3f4f6] text-[#6b7280]"
                  }`}
                >
                  <SummaryIcon type={isQuote ? "quote" : item.icon} />
                </div>
                <div className="min-w-0 flex-1 self-center">
                  <p
                    className={`line-clamp-2 text-[13px] font-semibold leading-snug ${
                      isQuote ? "text-emerald-950" : "text-[#111827]"
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </p>
                  {isQuote && full?.motivateLine ? (
                    <p className="mt-1 line-clamp-1 text-[11px] font-medium italic text-emerald-800">
                      {full.motivateLine}
                    </p>
                  ) : null}
                  <p
                    className={`mt-1 text-[11px] leading-none ${
                      isQuote ? "text-emerald-700/70" : "text-[#9ca3af]"
                    }`}
                  >
                    {item.time}
                  </p>
                </div>
              </button>
            </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => openPanel()}
          aria-expanded={open}
          className={`group/btn mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[11px] font-bold uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10b981] ${
            open
              ? "border-[#10b981] bg-[#d1fae5] text-[#047857] shadow-md"
              : `border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] ${V2_BTN_ACTIVITY_OPEN}`
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

      {modal}
    </>
  );
});

export default ActivityHistoryWithConnector;

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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
        active
          ? "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]"
          : `border-[#e5e7eb] bg-white text-[#6b7280] ${V2_BTN_FILTER_PILL}`
      }`}
    >
      {icon ? <span>{icon}</span> : null}
      {label}
    </button>
  );
}

function KindBadge({ kind, quoteSent }: { kind: ActivityKind; quoteSent?: boolean }) {
  if (quoteSent) {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#bbf7d0] text-[10px] font-bold uppercase text-emerald-800">
        Q
      </span>
    );
  }
  const styles =
    kind === "note"
      ? "bg-[#fef3c7] text-[#d97706]"
      : kind === "call"
        ? "bg-[#fee2e2] text-[#dc2626]"
        : "bg-[#dbeafe] text-[#2563eb]";

  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase ${styles}`}
    >
      {kind === "note" ? "N" : kind === "call" ? "C" : "U"}
    </span>
  );
}

function SummaryIcon({ type }: { type: "user-plus" | "calendar" | "phone" | "quote" }) {
  if (type === "quote") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
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
