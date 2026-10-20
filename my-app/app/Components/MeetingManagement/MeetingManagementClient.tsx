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
import { updateAppointment } from "@/lib/appointment-client";
import { loadMeetingBoard } from "@/lib/meeting-management-api";
import { meetingIso, startOfMeetingBoardToday, type MeetingRecord } from "@/lib/meeting-management-data";
import ScheduleHubMeetingModal, { type ScheduleHubMeetingConfirmPayload } from "../CrmLeadDetails/ScheduleHubMeetingModal";
import MeetingCalendarView from "./MeetingCalendarView";
import { MeetingDetailsModal } from "./MeetingDetailsModal";
import { MeetingDialog } from "./MeetingDialog";
import { MeetingsPage } from "./MeetingsPage";
import { EASE, focusRing, hoverLift } from "./motion";

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
  const [confirmTarget, setConfirmTarget] = useState<MeetingRecord | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<MeetingRecord | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  const [celebrateName, setCelebrateName] = useState("");
  const [board, setBoard] = useState<"table" | "calendar">("table");
  const [viewDir, setViewDir] = useState(1);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!celebrateName) return;
    const timer = window.setTimeout(() => setCelebrateName(""), 2800);
    return () => window.clearTimeout(timer);
  }, [celebrateName]);

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
      sp.delete("meetingSuccessful");
      sp.delete("quoteDelayed");
      sp.delete("page");
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (board !== "table") {
      setViewDir(-1);
      setBoard("table");
    }
  };

  const showQuoteDelayed = () => {
    const sp = new URLSearchParams(window.location.search);
    const on = sp.get("quoteDelayed") === "1";
    if (board === "table" && on) sp.delete("quoteDelayed");
    else {
      sp.set("quoteDelayed", "1");
      sp.delete("tab");
      sp.delete("quoteSent");
      sp.delete("meetingSuccessful");
      sp.delete("page");
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (board !== "table") {
      setViewDir(-1);
      setBoard("table");
    }
  };

  const showMeetingSuccessful = () => {
    const sp = new URLSearchParams(window.location.search);
    const on = sp.get("meetingSuccessful") === "1";
    if (board === "table" && on) sp.delete("meetingSuccessful");
    else {
      sp.set("meetingSuccessful", "1");
      sp.delete("tab");
      sp.delete("quoteSent");
      sp.delete("quoteDelayed");
      sp.delete("page");
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

  const beginReschedule = (row: MeetingRecord) => {
    setScheduleError("");
    setConfirmTarget(row);
  };

  const saveReschedule = async (payload: ScheduleHubMeetingConfirmPayload) => {
    const target = scheduleTarget;
    if (!target || saving) return;
    if (!target.appointmentId || !target.leadId || !target.leadTypeCode) {
      throw new Error("This meeting is not linked to a server appointment, so it was left unchanged.");
    }
    setSaving(true);
    setScheduleError("");
    try {
      await updateAppointment(
        target.appointmentId,
        {
          designerName: payload.designerName,
          ...(payload.designerEmail ? { designerEmail: payload.designerEmail } : {}),
          description: `Meeting with ${target.customer} - Lead ID: ${target.leadId}`,
          leadType: target.leadTypeCode,
          leadId: target.leadId,
          ...(target.sourceCode ? { source: target.sourceCode } : {}),
          ...(target.meetingLabel ? { meetingLabel: target.meetingLabel } : {}),
          meetingType: payload.meetingType,
          startTime: payload.startTime,
          endTime: payload.endTime,
        },
        { rescheduleReason: payload.notes.trim() || "Client requested a new slot" },
      );
      const name = target.customer;
      setScheduleTarget(null);
      setCelebrateName(name);
      await refreshMeetings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reschedule this meeting.";
      setScheduleError(message);
      throw error instanceof Error ? error : new Error(message);
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
                      loading={loading}
                      loadError={loadError}
                      onReload={() => void refreshMeetings()}
                      quoteSentMeetings={quoteSentMeetings}
                      onShowTable={showTable}
                      onShowQuoteSent={showQuoteSent}
                      onShowQuoteDelayed={showQuoteDelayed}
                      onShowMeetingSuccessful={showMeetingSuccessful}
                      onRescheduleMeeting={(meetingId) => {
                        const row = meetings.find((item) => String(item.id) === meetingId);
                        if (row) beginReschedule(row);
                      }}
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
                        onShowQuoteDelayed={showQuoteDelayed}
                        onShowMeetingSuccessful={showMeetingSuccessful}
                        onView={setDetail}
                        onReschedule={beginReschedule}
                        onRetry={() => void refreshMeetings()}
                  />
                    </Suspense>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-[#5B6778]">
              {ready ? "Meeting Management is available to sales and admin roles." : "Loading…"}
            </div>
          )}
        </SlimScrollArea>
      </div>

      <MeetingDetailsModal row={detail} onClose={() => setDetail(null)} />

      <MeetingDialog open={Boolean(confirmTarget)} title="Reschedule this meeting?" onClose={() => setConfirmTarget(null)}>
        {confirmTarget ? (
          <div>
            <p className="text-[13px] leading-snug text-[#5B6778]">This time is already booked. Reschedule only if the customer wants a new slot.</p>
            <motion.div
              className="mt-3 rounded-xl border border-[#E6EAF0] bg-[#F8FAFC] px-3 py-2.5"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <p className="truncate text-[15px] font-bold leading-tight text-[#14171F]">{confirmTarget.customer}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex h-6 items-center rounded-full bg-white px-2 text-[11px] font-semibold text-[#334155] ring-1 ring-[#E6EAF0]">
                  {confirmTarget.meetingType || "Meeting"}
                </span>
                <span className="inline-flex h-6 items-center rounded-full bg-[#E7F8EE] px-2 text-[11px] font-semibold text-[#047857]">
                  {confirmTarget.whenLabel}
                </span>
                {confirmTarget.assignee ? (
                  <span className="inline-flex h-6 max-w-full items-center truncate rounded-full bg-white px-2 text-[11px] font-semibold text-[#5B6778] ring-1 ring-[#E6EAF0]">
                    {confirmTarget.assignee}
                  </span>
                ) : null}
              </div>
            </motion.div>
            <div className="mt-3 flex justify-end gap-2">
              <motion.button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className={`inline-flex h-9 items-center rounded-lg border border-[#E6EAF0] bg-white px-3 text-[13px] font-semibold text-[#334155] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] ${focusRing}`}
                {...hoverLift(reduce)}
              >
                Keep this time
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  const next = confirmTarget;
                  setConfirmTarget(null);
                  setScheduleError("");
                  setScheduleTarget(next);
                }}
                className={`inline-flex h-9 items-center rounded-lg bg-[#22C55E] px-3 text-[13px] font-bold text-[#052E16] transition-colors hover:bg-[#16A34A] ${focusRing}`}
                {...hoverLift(reduce)}
              >
                Yes, reschedule
              </motion.button>
            </div>
          </div>
        ) : null}
      </MeetingDialog>

      <ScheduleHubMeetingModal
        open={Boolean(scheduleTarget)}
        onClose={() => {
          setScheduleTarget(null);
          setScheduleError("");
        }}
        onConfirm={saveReschedule}
        busy={saving}
        error={scheduleError}
        leadCustomerName={scheduleTarget?.customer ?? ""}
        leadDisplayId={scheduleTarget?.leadId ? String(scheduleTarget.leadId) : scheduleTarget?.quoteNo || ""}
        status="Scheduled"
        path="Meetings"
        feedback="Reschedule"
        hubMeetingPanelTitle={scheduleTarget ? `Reschedule ${scheduleTarget.customer}` : "Reschedule meeting"}
        initialNote="Client requested a new slot"
        minDate={meetingIso(startOfMeetingBoardToday())}
        scheduleInstruction={<p>Pick the new date and time. This updates the meeting that is already booked.</p>}
      />

      <RescheduleCelebration name={celebrateName} />

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

function RescheduleCelebration({ name }: { name: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {name ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0F172A]/45 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
        >
          {!reduce
            ? ["#22C55E", "#FACC15", "#38BDF8", "#F472B6", "#A78BFA", "#FB923C"].map((color, index) => (
                <motion.span
                  key={color}
                  className="absolute h-2.5 w-2.5 rounded-full"
                  style={{ background: color, left: `${18 + index * 12}%`, top: "42%" }}
                  initial={{ y: 0, opacity: 1, scale: 0.6 }}
                  animate={{ y: -140 - index * 12, x: (index % 2 === 0 ? -1 : 1) * (24 + index * 8), opacity: 0, scale: 1 }}
                  transition={{ duration: 1.1, ease: "easeOut", delay: index * 0.04 }}
                />
              ))
            : null}
          <motion.div
            className="relative w-[min(420px,calc(100vw-32px))] rounded-[22px] bg-white px-6 py-7 text-center shadow-[0_20px_50px_rgba(15,23,42,0.2)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <motion.span
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]"
              initial={reduce ? undefined : { scale: 0.4, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
                <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
            <p className="mt-4 text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Rescheduled successfully</p>
            <p className="mt-1 text-[15px] font-semibold text-[#047857]">{name}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
