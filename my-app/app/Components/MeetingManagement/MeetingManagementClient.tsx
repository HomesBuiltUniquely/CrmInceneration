"use client";

import { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import AppTopBar from "../Shared/AppTopBar";
import SlimScrollArea from "@/app/Components/Shared/SlimScrollArea";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { canAccessMeetingManagement } from "@/lib/roleUtils";
import { deleteAppointment, updateAppointment } from "@/lib/appointment-client";
import { buildHubMeetingDateTimeIso } from "@/lib/hub-meeting-schedule";
import { loadMeetingBoard } from "@/lib/meeting-management-api";
import { formatMeetingValue, formatMeetingWhen, meetingOffset, type MeetingRecord } from "@/lib/meeting-management-data";
import MeetingCalendarView from "./MeetingCalendarView";
import { MeetingDialog } from "./MeetingDialog";
import { MeetingsPage } from "./MeetingsPage";
import { focusRing } from "./motion";

type Toast = { id: number; message: string; tone: "ok" | "error" };

const viewSwitch = {
  enter: (dir: number) => ({ opacity: 0, y: dir * 28, scale: 0.985 }),
  center: { opacity: 1, y: 0, scale: 1 },
  exit: (dir: number) => ({ opacity: 0, y: dir * -22, scale: 0.992 }),
};

const fadeOnly = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function MeetingManagementClient() {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [role, setRole] = useState("");
  const [ready, setReady] = useState(false);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [quoteSentMeetings, setQuoteSentMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<MeetingRecord | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MeetingRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [cancelTarget, setCancelTarget] = useState<MeetingRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [board, setBoard] = useState<"table" | "calendar">("table");
  const [viewDir, setViewDir] = useState(1);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const next = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    setRole(next);
    setReady(true);
    if (!canAccessMeetingManagement(next)) router.replace("/");
  }, [router]);

  useEffect(() => {
    const reset = () => {
      const el = document.getElementById("meeting-page-scroll");
      if (el) el.scrollTop = 0;
    };
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [board]);

  const showCalendar = () => {
    setViewDir(1);
    setBoard("calendar");
  };
  const showTable = () => {
    setViewDir(-1);
    setBoard("table");
  };

  const showQuoteSent = () => {
    const sp = new URLSearchParams(window.location.search);
    const on = sp.get("quoteSent") === "1";
    if (board === "table" && on) sp.delete("quoteSent");
    else {
      sp.set("quoteSent", "1");
      sp.delete("tab");
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (board !== "table") {
      setViewDir(-1);
      setBoard("table");
    }
  };

  const refreshMeetings = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const boardData = await loadMeetingBoard();
      setMeetings(boardData.meetings);
      setQuoteSentMeetings(boardData.quoteSentMeetings);
    } catch (error) {
      setMeetings([]);
      setQuoteSentMeetings([]);
      const message = error instanceof Error ? error.message : "Could not load meetings from the server.";
      setLoadError(message);
      setToast({ id: Date.now(), message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !canAccessMeetingManagement(role)) return;
    void refreshMeetings();
  }, [ready, role]);

  const notify = (message: string, tone: Toast["tone"]) => setToast({ id: Date.now(), message, tone });

  const saveReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime || saving) return;
    if (!rescheduleTarget.appointmentId || !rescheduleTarget.leadId || !rescheduleTarget.leadTypeCode) {
      notify("This row is not linked to a server appointment, so it was left unchanged.", "error");
      return;
    }
    const [year, month, day] = rescheduleDate.split("-").map(Number);
    const [hourRaw, minute] = rescheduleTime.split(":");
    const hour = Number(hourRaw);
    const dateIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const startMin = hour * 60 + Number(minute);
    const duration = rescheduleTarget.durationMin ?? 90;
    setSaving(true);
    try {
      await updateAppointment(
        rescheduleTarget.appointmentId,
        {
          designerName: rescheduleTarget.assignee,
          ...(rescheduleTarget.designerEmail ? { designerEmail: rescheduleTarget.designerEmail } : {}),
          description: `Meeting with ${rescheduleTarget.customer} - Lead ID: ${rescheduleTarget.leadId}`,
          leadType: rescheduleTarget.leadTypeCode,
          leadId: rescheduleTarget.leadId,
          ...(rescheduleTarget.sourceCode ? { source: rescheduleTarget.sourceCode } : {}),
          ...(rescheduleTarget.meetingLabel ? { meetingLabel: rescheduleTarget.meetingLabel } : {}),
          ...(rescheduleTarget.meetingTypeCode ? { meetingType: rescheduleTarget.meetingTypeCode } : {}),
          startTime: buildHubMeetingDateTimeIso(dateIso, startMin),
          endTime: buildHubMeetingDateTimeIso(dateIso, startMin + duration),
        },
        { rescheduleReason: rescheduleNote.trim() || "Client requested a new slot" },
      );
      setRescheduleTarget(null);
      notify(`Meeting rescheduled to ${formatMeetingWhen(meetingOffset(dateIso), startMin)}.`, "ok");
      await refreshMeetings();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not reschedule this meeting.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || saving) return;
    if (!cancelTarget.appointmentId) {
      notify("This row is not linked to a server appointment, so it was left unchanged.", "error");
      return;
    }
    setSaving(true);
    try {
      await deleteAppointment(cancelTarget.appointmentId);
      const reason = cancelReason.trim();
      setCancelTarget(null);
      setDetail(null);
      notify(reason ? `Meeting cancelled. ${reason}` : "Meeting cancelled.", "ok");
      await refreshMeetings();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not cancel this meeting.", "error");
    } finally {
      setSaving(false);
    }
  };

  const allowed = ready && canAccessMeetingManagement(role);

  return (
    <div className="min-h-screen min-h-dvh overflow-x-clip bg-[#F4F6F8] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={roleLabel(role) || "Super Admin"}
            profileRole={role || "USER"}
            profileInitials="AD"
          />
        </div>
        <SlimScrollArea className="bg-[#F4F6F8] xl:h-screen" contentClassName="overflow-x-clip" contentId="meeting-page-scroll">
          <AppTopBar />
          {allowed ? (
            <main className="px-4 py-5 md:px-6 md:py-6">
              <AnimatePresence mode="wait" initial={false} custom={viewDir}>
                {board === "calendar" ? (
                  <motion.div
                    key="calendar"
                    custom={viewDir}
                    variants={reduce ? fadeOnly : viewSwitch}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={reduce ? { duration: 0.16 } : { duration: 0.46, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <MeetingCalendarView
                      meetings={meetings}
                      quoteSentCount={quoteSentMeetings.length}
                      loading={loading}
                      loadError={loadError}
                      onReload={() => void refreshMeetings()}
                      onShowTable={showTable}
                      onShowQuoteSent={showQuoteSent}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    custom={viewDir}
                    variants={reduce ? fadeOnly : viewSwitch}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={reduce ? { duration: 0.16 } : { duration: 0.46, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <Suspense fallback={<p className="text-[14px] font-semibold text-[#5B6778]">Loading meetings…</p>}>
                      <MeetingsPage
                        meetings={meetings}
                        quoteSentMeetings={quoteSentMeetings}
                        loading={loading}
                        loadError={loadError}
                        onShowCalendar={showCalendar}
                        onShowQuoteSent={showQuoteSent}
                        onView={setDetail}
                    onReschedule={(row) => {
                      setRescheduleTarget(row);
                      setRescheduleDate(row.date);
                      setRescheduleTime(minutesToTime(row.startMin));
                      setRescheduleNote("Client requested a new slot");
                    }}
                    onCancel={(row) => {
                      setCancelTarget(row);
                      setCancelReason("");
                    }}
                    onRetry={() => void refreshMeetings()}
                  />
                    </Suspense>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-[#5B6778]">
              {ready ? "Meeting Management is available to Super Admin only." : "Loading…"}
            </div>
          )}
        </SlimScrollArea>
      </div>

      <MeetingDialog open={Boolean(detail)} title="Meeting details" onClose={() => setDetail(null)}>
        {detail ? <DetailBody row={detail} /> : null}
      </MeetingDialog>

      <MeetingDialog open={Boolean(rescheduleTarget)} title={rescheduleTarget ? `Reschedule ${rescheduleTarget.customer}` : "Reschedule"} onClose={() => setRescheduleTarget(null)}>
        <div className="grid gap-3">
          <label className="text-[13px] font-semibold text-[#334155]">
            Date
            <input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className={`mt-1 h-11 w-full rounded-xl border border-[#E3E8EE] px-3 text-[14px] font-semibold ${focusRing}`} />
          </label>
          <label className="text-[13px] font-semibold text-[#334155]">
            Time
            <input type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} className={`mt-1 h-11 w-full rounded-xl border border-[#E3E8EE] px-3 text-[14px] font-semibold ${focusRing}`} />
          </label>
          <label className="text-[13px] font-semibold text-[#334155]">
            Note
            <input value={rescheduleNote} onChange={(event) => setRescheduleNote(event.target.value)} className={`mt-1 h-11 w-full rounded-xl border border-[#E3E8EE] px-3 text-[14px] font-semibold ${focusRing}`} />
          </label>
          <button type="button" disabled={!rescheduleDate || !rescheduleTime || saving} onClick={() => void saveReschedule()} className={`mt-1 h-[52px] rounded-xl bg-[#22C55E] text-[15px] font-bold text-[#052E16] disabled:opacity-40 ${focusRing}`}>
            {saving ? "Saving…" : "Save reschedule"}
          </button>
        </div>
      </MeetingDialog>

      <MeetingDialog open={Boolean(cancelTarget)} title="Cancel this meeting?" onClose={() => setCancelTarget(null)}>
        <p className="text-[14px] font-normal text-[#334155]">
          {cancelTarget ? `${cancelTarget.customer} · ${cancelTarget.meetingType} · ${cancelTarget.whenLabel}` : ""}
        </p>
        <label className="mt-3 block text-[13px] font-semibold text-[#334155]">
          Reason (optional)
          <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} className={`mt-1 w-full rounded-xl border border-[#E3E8EE] px-3 py-2 text-[14px] font-normal ${focusRing}`} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setCancelTarget(null)} className={`inline-flex h-11 items-center rounded-xl border border-[#E3E8EE] px-4 text-[14px] font-semibold text-[#334155] ${focusRing}`}>
            Keep meeting
          </button>
          <button type="button" disabled={saving} onClick={() => void confirmCancel()} className={`inline-flex h-11 items-center rounded-xl bg-[#FEF3F2] px-4 text-[14px] font-bold text-[#B42318] disabled:opacity-40 ${focusRing}`}>
            Cancel meeting
          </button>
        </div>
      </MeetingDialog>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            role="status"
            className="fixed right-4 top-4 z-[100] w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border border-[#E3E8EE] bg-white px-4 py-3 text-[14px] font-semibold text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
            transition={{ duration: 0.22 }}
          >
            {toast.message}
            <motion.span
              className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${toast.tone === "error" ? "bg-[#B42318]" : "bg-[#22C55E]"}`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4, ease: "linear" }}
              onAnimationComplete={() => setToast(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function minutesToTime(startMin: number) {
  const hour = Math.floor(startMin / 60);
  const minute = startMin % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function DetailBody({ row }: { row: MeetingRecord }) {
  return (
    <dl className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto text-sm sm:grid-cols-2">
      <Detail label="Client" value={row.customer} />
      <Detail label="Customer email" value={row.customerEmail || "—"} />
      <Detail label="Phone" value={row.phone || "—"} />
      <Detail label="Lead type" value={row.leadType || "—"} />
      <Detail label="Source" value={row.appointmentSource || "CRM"} />
      <Detail label="Meeting type" value={row.meetingType} />
      <Detail label="Meeting level" value={row.meetingLevel || "—"} />
      <Detail label="Sales" value={row.salesName || "—"} />
      <Detail label="Sales email" value={row.salesEmail || "—"} />
      <Detail label="Designer" value={row.assignee || "—"} />
      <Detail label="Designer email" value={row.designerEmail || "—"} />
      <div className="sm:col-span-2">
        <Detail label="Scheduled by" value={row.scheduledBy || "—"} />
      </div>
      <Detail label="Scheduled on" value={row.scheduledAt || "—"} />
      <Detail label="When" value={row.whenLabel} />
      <Detail label="Status" value={row.status} />
      <Detail label="Milestone" value={row.milestoneStage || "—"} />
      <Detail label="Substage" value={row.milestoneSubStage || "—"} />
      <Detail label="Google sync" value={row.googleSyncStatus || "—"} />
      <Detail label="Sync note" value={row.googleSyncMessage || "—"} />
      <Detail label="Quote" value={row.quoteSent ? "Quote sent" : "Quote not sent"} />
      <Detail label="Lead budget" value={formatMeetingValue(row.budget)} />
      <Detail label="Lead quote" value={formatMeetingValue(row.quoteValue)} />
      {row.needsOutcome ? (
        <div className="rounded-xl bg-[#FEF3C7] px-3 py-2 text-[12px] font-semibold text-[#92400E] sm:col-span-2">
          Meeting time has passed. This lead is still Meeting Scheduled in Experience & Design, not Meeting Successful.
        </div>
      ) : null}
      {row.googleHtmlLink ? (
        <a href={row.googleHtmlLink} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-[#1D4ED8] sm:col-span-2">
          Open Google Calendar event
        </a>
      ) : null}
    </dl>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-[#5B6778]">{label}</dt>
      <dd className="mt-0.5 font-semibold text-[#0F172A]">{value}</dd>
    </div>
  );
}
