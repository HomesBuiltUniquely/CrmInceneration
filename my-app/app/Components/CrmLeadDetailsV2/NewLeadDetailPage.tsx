"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, FieldLabel, Input } from "@/app/Components/CrmLeadDetails/ui";
import FloorPlanUpload from "@/app/Components/CrmLeadDetails/FloorPlanUpload";
import ActivityHistoryWithConnector from "./ActivityHistoryWithConnector";

type Props = {
  leadType: string;
  leadId: string;
};

type PhaseItem = {
  id: string;
  title: string;
  badge?: string;
  muted?: boolean;
};

const phaseItems: PhaseItem[] = [
  { id: "connection", title: "1. Connection Phase" },
  { id: "experience", title: "2. Experience Phase", badge: "Current Phase" },
  { id: "decision", title: "3. Decision Phase", muted: true },
];

const mockLeadHeader = {
  leadSource: "LinkedIn Referral",
  additionalLeadSources: ["Website"],
  createdAt: "Oct 12, 2024, 09:15 AM",
  updatedAgo: "Updated 2h ago",
  assignee: "Sarah Jenkins",
  timelineOptions: [
    {
      value: "lead-3",
      label: "Today it came on 17 Jun 2026 in formlead as Julian Montgomery",
      fullLabel:
        "Today it came on 17 Jun 2026 in formlead as Julian Montgomery (current)",
    },
    {
      value: "lead-2",
      label: "12 Oct 2024 it came on 12 Oct 2024 in walkin as Julian Montgomery",
      fullLabel:
        "12 Oct 2024 it came on 12 Oct 2024 in walkin as Julian Montgomery — duplicate",
    },
    {
      value: "lead-1",
      label: "05 Sep 2024 it came on 05 Sep 2024 in website as Julian M.",
      fullLabel: "05 Sep 2024 it came on 05 Sep 2024 in website as Julian M.",
    },
  ],
};

const mockScheduleLinks = {
  quoteLink: "https://hubinterior.com/quote/LID-82934-proposal",
  designQaLink: "https://design.hubinterior.com/DesignQA?id=LID-82934&v=1",
};

export default function NewLeadDetailPage({ leadType, leadId }: Props) {
  return (
    <main className="min-h-screen bg-[#eef1f5] px-3 py-4 font-sans md:px-4">
      <div className="mx-auto max-w-[1365px]">
        <section className="rounded-xl border border-[#e1e6ed] bg-[#f3f5f8] p-3">
          <LeadDetailHeader />
          <div className="mt-3 grid gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <LeadProfileCard />
              <FamilyContactCard />
              <ActivityHistoryWithConnector />
            </aside>

            <section className="space-y-3">
              {phaseItems.map((phase) => {
                if (phase.id === "experience") {
                  return <ExperiencePhaseCard key={phase.id} leadType={leadType} leadId={leadId} />;
                }
                if (phase.id === "decision") {
                  return <DecisionPhaseCard key={phase.id} />;
                }
                return (
                  <article
                    key={phase.id}
                    className="rounded-lg border border-[#e4e8ef] bg-white p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-[#d4f5e2]" />
                        <h2 className="text-[22px] font-bold leading-none tracking-[-0.015em] text-[#101828]">
                          {phase.title}
                        </h2>
                      </div>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1ed760] text-[12px] font-bold text-white">
                        ✓
                      </span>
                    </div>
                    <ConnectionPhaseContent />
                  </article>
                );
              })}
              <MeetingScheduleSection />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function LeadDetailHeader() {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineValue, setTimelineValue] = useState(mockLeadHeader.timelineOptions[0]?.value ?? "");
  const [quoteFetching, setQuoteFetching] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const timelineWrapRef = useRef<HTMLDivElement | null>(null);

  const selectedTimeline = useMemo(
    () => mockLeadHeader.timelineOptions.find((x) => x.value === timelineValue) ?? null,
    [timelineValue]
  );
  const leadComeCount = mockLeadHeader.timelineOptions.length;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!timelineWrapRef.current?.contains(event.target as Node)) {
        setTimelineOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleGetQuote = () => {
    setQuoteFetching(true);
    window.setTimeout(() => setQuoteFetching(false), 1200);
  };

  return (
    <>
      <div className="py-4 lg:py-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_440px] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-[4px] border border-[#f4a525] bg-[#fff9ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#f4a525]">
                Priority Lead
              </span>
              <LeadSourceBadge
                primary={mockLeadHeader.leadSource}
                extras={mockLeadHeader.additionalLeadSources}
              />
              <p className="text-[11px] font-semibold text-[#95a0b0]">{mockLeadHeader.updatedAgo}</p>
            </div>

            <p className="mt-1 text-[40px] font-bold leading-tight tracking-[-0.01em] text-[#0f1729]">
              Lead Information
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CreatedMetaChip createdAt={mockLeadHeader.createdAt} />
              <span className="inline-flex items-center rounded-full border border-[#e2e8f0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
                Lead came {leadComeCount} times
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <InfoPill title="Stage" value="Experience" />
              <InfoPill title="Sub-Stage" value="Meeting Scheduled" wide />
            </div>

            <div className="mt-3 max-w-[560px]">
              <div className="flex items-end justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a96a8]">
                  Data Completeness
                </p>
                <p className="text-[30px] font-bold leading-none text-[#1acb5a]">64%</p>
              </div>
              <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#d6dbe3]">
                <div className="h-full w-[64%] rounded-full bg-[#1ed760]" />
              </div>
              <p className="mt-2 text-[13px] font-semibold text-[#ee5454]">
                △ Missing: Floor Plan, Scope of work
              </p>
            </div>
          </div>

          <div className="w-full lg:mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <AssigneeBadge name={mockLeadHeader.assignee} />
              <button
                type="button"
                onClick={handleGetQuote}
                disabled={quoteFetching}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#c4b5fd] bg-[#f5f3ff] px-3.5 text-[12px] font-bold uppercase tracking-wide text-[#5b21b6] transition hover:bg-[#ede9fe] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden>🔎</span>
                {quoteFetching ? "Getting Quote..." : "Get Quote"}
              </button>
              <button
                type="button"
                onClick={() => setRollbackOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#fcd34d] bg-[#fffbeb] px-3.5 text-[12px] font-bold uppercase tracking-wide text-[#92400e] transition hover:bg-[#fef3c7]"
              >
                <span aria-hidden>↩</span>
                Stage Rollback
              </button>
            </div>

            <div className="w-full rounded-[8px] border border-[#dde3ec] bg-[#f4f7fb] px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#9aa7bb]">Next Follow Up</p>
              <div className="relative mt-2 flex h-[42px] w-full items-center rounded-[6px] border border-[#d8dfeb] bg-[#fdfefe] px-4">
                <span className="relative z-10 inline-flex items-center gap-2 text-[17px] font-extrabold leading-none tracking-[-0.01em] text-[#1f2a3c]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[14px] w-[14px] text-[#35d977]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Dec 28, 2024
                </span>

                <div
                  className="absolute top-1/2 left-1/2 h-[22px] w-px -translate-x-1/2 -translate-y-1/2 bg-[#dfe5ee]"
                  aria-hidden="true"
                />

                <div className="absolute top-1/2 left-1/2 flex -translate-y-1/2 items-center gap-7 pl-6">
                  <button
                    type="button"
                    aria-label="Call"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#f1f4f8] text-[#6f7d90]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-[16px] w-[16px]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.8.62 2.66a2 2 0 0 1-.45 2.11L8 9.92a16 16 0 0 0 6.08 6.08l1.43-1.28a2 2 0 0 1 2.11-.45c.86.29 1.76.5 2.66.62A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Message"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#f1f4f8] text-[#6f7d90]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-[16px] w-[16px]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Schedule"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#f1f4f8] text-[#6f7d90]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-[16px] w-[16px]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[#1dde63] text-[12px] font-bold uppercase tracking-wide text-[#05220f]"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#0f9d3d] text-[10px] leading-none text-[#0f9d3d]">
                  ✓
                </span>
                Mark As Won
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#d6dce6] bg-white text-[12px] font-bold uppercase tracking-wide text-[#111827]"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#7d8998] text-[10px] leading-none text-[#7d8998]">
                  ⊙
                </span>
                Complete Task
              </button>
            </div>

            <div className="mt-2.5 w-full" ref={timelineWrapRef}>
              <button
                type="button"
                className="inline-flex w-full items-center justify-between gap-2 rounded-[8px] border border-[#d6dce6] bg-[#f8fafc] px-3 py-2 text-left text-[12px] font-semibold text-[#334155] outline-none transition hover:border-[#c5ced9] hover:bg-[#f1f5f9] focus:border-[#94a3b8] focus:ring-2 focus:ring-[#e2e8f0]"
                aria-haspopup="listbox"
                aria-expanded={timelineOpen}
                aria-label="Lead come history"
                title={selectedTimeline?.fullLabel}
                onClick={() => setTimelineOpen((v) => !v)}
              >
                <span className="truncate">
                  {selectedTimeline?.label ?? "Lead created timeline"}
                </span>
                <span aria-hidden className="shrink-0 text-[10px] text-[#94a3b8]">
                  {timelineOpen ? "▲" : "▼"}
                </span>
              </button>
              {timelineOpen ? (
                <div
                  role="listbox"
                  className="mt-1 max-h-56 w-full overflow-y-auto rounded-[8px] border border-[#e2e8f0] bg-white p-1 shadow-lg"
                >
                  {mockLeadHeader.timelineOptions.map((item) => {
                    const isSelected = item.value === timelineValue;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`block w-full rounded-[6px] px-2.5 py-2 text-left text-[12px] ${
                          isSelected
                            ? "bg-[#e8fbf0] font-semibold text-[#0f8f3d]"
                            : "text-[#475569] hover:bg-[#f8fafc]"
                        }`}
                        title={item.fullLabel}
                        onClick={() => {
                          setTimelineValue(item.value);
                          setTimelineOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {rollbackOpen ? (
        <StageRollbackModal onClose={() => setRollbackOpen(false)} />
      ) : null}
    </>
  );
}

function LeadSourceBadge({ primary, extras }: { primary: string; extras?: string[] }) {
  const label = primary || extras?.[0] || "External Lead";
  return (
    <span className="inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#1d4ed8]">
      {label}
    </span>
  );
}

function CreatedMetaChip({ createdAt }: { createdAt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bae6fd] bg-[#f0f9ff] px-2.5 py-1 text-[11px] font-semibold text-[#0369a1]">
      <span aria-hidden>🕐</span>
      <span>Created {createdAt}</span>
    </span>
  );
}

function AssigneeBadge({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("") || "—";

  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#dde3ec] bg-white px-3 text-[13px] font-semibold text-[#1f2937]">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#60a5fa] to-[#a78bfa] text-[10px] font-bold text-white">
        {initials}
      </div>
      {name}
    </div>
  );
}

function StageRollbackModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-rollback-title"
      >
        <h2 id="stage-rollback-title" className="text-[18px] font-bold text-[#0f172a]">
          Stage Rollback
        </h2>
        <p className="mt-1 text-[13px] text-[#64748b]">
          UI preview only — API wiring will be added later.
        </p>

        <label className="mt-4 block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
            Roll back to stage
          </span>
          <select className="mt-1 w-full rounded-[6px] border border-[#d6dce6] bg-[#f8fafc] px-3 py-2 text-[14px] text-[#1e293b]">
            <option>Connection Phase</option>
            <option>Experience Phase</option>
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
            Reason
          </span>
          <textarea
            rows={3}
            className="mt-1 w-full resize-none rounded-[6px] border border-[#d6dce6] bg-[#f8fafc] px-3 py-2 text-[14px] text-[#1e293b]"
            placeholder="Why are you rolling back this stage?"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-[6px] border border-[#d6dce6] bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-[#475569]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-[6px] border border-[#fcd34d] bg-[#fffbeb] px-4 text-[12px] font-bold uppercase tracking-wide text-[#92400e]"
          >
            Confirm Rollback
          </button>
        </div>
      </div>
    </div>
  );
}

function FamilyContactCard() {
  return (
    <article className="rounded-xl border border-[#e0e5ec] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Family Contact</p>

      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f3f4f6] text-[#9ca3af]">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <p className="text-[15px] font-bold text-[#111827]">Ananya Sharma</p>
          <p className="text-[12px] text-[#9ca3af]">Spouse</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Phone</p>
        <p className="mt-1 inline-flex items-center gap-2 text-[14px] font-medium text-[#374151]">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 text-[#6b7280]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.8.62 2.66a2 2 0 0 1-.45 2.11L8 9.92a16 16 0 0 0 6.08 6.08l1.43-1.28a2 2 0 0 1 2.11-.45c.86.29 1.76.5 2.66.62A2 2 0 0 1 22 16.92z" />
          </svg>
          +91 98765 43210
        </p>
      </div>
    </article>
  );
}

function DecisionPhaseCard() {
  return (
    <article className="rounded-xl border border-[#e6ebf1] bg-[#f5f7fa] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-[#e8ecf1] text-[#9ca3af]">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m14.5 4.5-9 9" />
              <path d="m3 21 5.5-5.5" />
              <path d="m16 3 5 5" />
              <path d="m12 7 5 5" />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold leading-none text-[#9ca3af]">3. Decision Phase</h2>
        </div>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-[#c4cad4]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <LockedField label="Final Budget" />
        <LockedField label="Decision Maker" />
        <LockedField label="Timeline" />
      </div>
    </article>
  );
}

function MeetingScheduleSection() {
  const [quoteSending, setQuoteSending] = useState(false);
  const [copiedDesignQa, setCopiedDesignQa] = useState(false);

  const calendarIcon = (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  return (
    <article className="rounded-lg border border-[#e4e8ef] bg-white p-4">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-[#ede9fe] text-[#7c3aed]">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
        <h2 className="text-[22px] font-bold leading-none tracking-[-0.015em] text-[#101828]">Schedule</h2>
      </div>
      <p className="mb-4 text-[12px] text-[#8a96a8]">
        Read-only — updated from Complete Task (meeting milestones) and CRM follow-up.
      </p>

      <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
        <div>
          <PhaseFieldLabel>Meeting Date</PhaseFieldLabel>
          <ValuePill icon={calendarIcon}>Dec 28, 2024, 10:30 AM</ValuePill>
        </div>
        <div>
          <PhaseFieldLabel>Follow-up Date</PhaseFieldLabel>
          <ValuePill icon={calendarIcon}>Dec 28, 2024</ValuePill>
        </div>
        <div>
          <PhaseFieldLabel>Meeting Type</PhaseFieldLabel>
          <ValuePill
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          >
            Showroom Visit
          </ValuePill>
        </div>
        <div>
          <PhaseFieldLabel>Booking Type</PhaseFieldLabel>
          <ValuePill
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            }
          >
            Apartment
          </ValuePill>
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--crm-border)] pt-4">
        <FieldLabel>Quote link</FieldLabel>
        <div className="mt-1.5 flex gap-2">
          <Input
            placeholder="https://… (PDF or proposal URL)"
            value={mockScheduleLinks.quoteLink}
            readOnly
            className="flex-1"
          />
          <Button
            type="button"
            variant="primary"
            disabled={quoteSending}
            onClick={() => {
              setQuoteSending(true);
              window.setTimeout(() => setQuoteSending(false), 1200);
            }}
          >
            {quoteSending ? "Sending…" : "Send"}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
          Auto-mapped quote link (read-only). Use Send to email quote.
        </p>
      </div>

      <div className="mt-3.5">
        <FieldLabel>
          Design QA Link
          <span className="ml-1.5 font-normal normal-case text-[var(--crm-text-muted)]">
            (read-only, from CRM)
          </span>
        </FieldLabel>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            value={mockScheduleLinks.designQaLink}
            readOnly
            className="h-[34px] min-w-0 flex-1 px-2.5 text-[11px]"
          />
          <button
            type="button"
            aria-label="Copy Design QA Link"
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-primary)] transition hover:bg-[var(--crm-surface)]"
            onClick={() => {
              void navigator.clipboard.writeText(mockScheduleLinks.designQaLink).then(() => {
                setCopiedDesignQa(true);
                window.setTimeout(() => setCopiedDesignQa(false), 2000);
              });
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 fill-none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <rect x="4" y="4" width="11" height="11" rx="2" />
            </svg>
          </button>
        </div>
        {copiedDesignQa ? (
          <p className="mt-1 text-[11px] font-medium text-[#059669]">Design QA Link copied</p>
        ) : null}
      </div>
    </article>
  );
}

function LockedField({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#b0b8c4]">{label}</p>
      <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-[#c4cad4]">Locked</p>
    </div>
  );
}

function LeadProfileCard() {
  return (
    <article className="rounded-xl border border-[#e0e5ec] bg-white p-4">
      <div className="relative mb-4 flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#d9e0ea]" />
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-[20px] font-extrabold leading-tight text-[#111827]">Julian Montgomery</p>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">ID: #LID-82934</p>
        </div>
        <button
          type="button"
          aria-label="Edit lead profile"
          className="absolute right-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-[#f3f4f6]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <ProfileField label="Phone" value="+1 (555) 012-3456" />
        <ProfileField label="Email" value="j.montgomery@architects.io" />
        <ProfileField label="Location" value="Austin, Texas, US" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Lead Source</p>
          <span className="mt-1 inline-flex rounded-full bg-[#f3f4f6] px-3 py-1 text-[13px] font-semibold text-[#374151]">
            LinkedIn Referral
          </span>
        </div>
      </div>

      <div className="my-4 border-t border-[#e5e7eb]" />

      <div className="space-y-3">
        <RelatedContact
          label="CRM"
          name="Sarah Jenkins"
          avatar={
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#d9e0ea]" />
          }
        />
        <RelatedContact
          label="Designer"
          name="Arjun Sharma"
          avatar={
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          }
        />
      </div>
    </article>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{label}</p>
      <p className="mt-0.5 text-[14px] font-medium text-[#1f2937]">{value}</p>
    </div>
  );
}

function RelatedContact({
  label,
  name,
  avatar,
}: {
  label: string;
  name: string;
  avatar: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{label}</p>
        <p className="mt-0.5 text-[14px] font-bold text-[#111827]">{name}</p>
      </div>
    </div>
  );
}

function ExperiencePhaseCard({ leadType, leadId }: { leadType: string; leadId: string }) {
  return (
    <article className="relative rounded-xl border-2 border-[#2ee06a] bg-white px-4 pb-4 pt-7">
      <span className="absolute -top-3 left-4 rounded-full bg-[#2ee06a] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0f1729]">
        Current Phase
      </span>

      <div className="mb-5 flex items-center gap-2.5">
        <span className="inline-block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-[#d4f5e2]" />
        <h2 className="text-[22px] font-bold leading-none tracking-[-0.015em] text-[#101828]">
          2. Experience Phase
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex h-5 items-center justify-between gap-2">
              <PhaseFieldLabel className="mb-0">Floor Plan</PhaseFieldLabel>
              <div className="flex flex-wrap gap-1">
                <FloorPlanFileTypeBadge label="PDF" />
                <FloorPlanFileTypeBadge label="JPG" />
                <FloorPlanFileTypeBadge label="PNG" />
              </div>
            </div>
            <FloorPlanUpload
              hasFloorPlan={false}
              viewHref=""
              openHref=""
              canUpload
              compact
              hideHeader
              uploading={false}
              onFileSelect={() => {}}
            />
          </div>

          <div>
            <PhaseFieldLabel>Design Preferences</PhaseFieldLabel>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d5dbe5] bg-white px-3 py-1.5 text-[13px] font-medium text-[#8a96a8]"
            >
              <span className="text-[15px] leading-none">+</span>
              Add preference
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex h-5 items-center">
            <PhaseFieldLabel className="mb-0">Scope of Work</PhaseFieldLabel>
          </div>
          <Link
            href={`/Leads/new/${leadType}/${leadId}/configuration-scope`}
            className="group flex h-[148px] w-full flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-[#c8d0db] bg-white text-[12px] font-bold uppercase tracking-wide text-[#8a96a8] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2ee06a] hover:bg-[#f0fdf4] hover:text-[#059669] hover:shadow-[0_8px_24px_rgba(46,224,106,0.15)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10b981]"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] text-[#8a96a8] transition-all duration-200 group-hover:border-[#bbf7d0] group-hover:bg-[#ecfdf5] group-hover:text-[#059669]">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </span>
            <span className="inline-flex items-center gap-1.5">
              Configure Scope
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
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
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function ConnectionPhaseContent() {
  return (
    <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
      <div className="space-y-5">
        <div>
          <PhaseFieldLabel>Property Name</PhaseFieldLabel>
          <ValuePill
            icon={
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
              </svg>
            }
          >
            Westlake Villa
          </ValuePill>
        </div>

        <div>
          <PhaseFieldLabel>Budget Range</PhaseFieldLabel>
          <div className="flex items-center gap-2">
            <ValuePill variant="green">$450k - $600k</ValuePill>
            <button
              type="button"
              aria-label="Add budget"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#d5dbe5] bg-white text-[14px] font-medium text-[#8a96a8]"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <PhaseFieldLabel>Language Preferred</PhaseFieldLabel>
          <ValuePill
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            }
          >
            English
          </ValuePill>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <PhaseFieldLabel>Property Pincode</PhaseFieldLabel>
          <ValuePill
            icon={
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            }
          >
            78701
          </ValuePill>
        </div>

        <div>
          <PhaseFieldLabel>Configuration</PhaseFieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <ValuePill>4 Bedroom</ValuePill>
          </div>
        </div>

        <div>
          <PhaseFieldLabel>Possession Date</PhaseFieldLabel>
          <ValuePill
            icon={
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
          >
            Dec 2024
          </ValuePill>
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-5 lg:col-span-2 lg:grid-cols-2">
        <div>
          <PhaseFieldLabel>Property Status</PhaseFieldLabel>
          <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold italic text-[#e84c4c]">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#e84c4c] text-[10px] not-italic">
              i
            </span>
            Action required: Site visit not scheduled
          </p>
        </div>

        <div>
          <PhaseFieldLabel>Property Notes</PhaseFieldLabel>
          <ValuePill
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
          >
            Modern interior with practical storage in every room
          </ValuePill>
        </div>
      </div>
    </div>
  );
}

function PhaseFieldLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const margin = className.includes("mb-") ? "" : "mb-1.5";
  return (
    <p
      className={`${margin} text-[10px] font-bold uppercase tracking-[0.1em] text-[#8b97a8] ${className}`.trim()}
    >
      {children}
    </p>
  );
}

function FloorPlanFileTypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-[#dce2ea] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b97a8]">
      {label}
    </span>
  );
}

function ValuePill({
  children,
  icon,
  variant = "default",
}: {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "green";
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-bold text-[#1a2432] ${
        variant === "green"
          ? "bg-[#e8fbf0] text-[#0f8f3d]"
          : "bg-[#f0f3f7]"
      }`}
    >
      {icon ? <span className="text-[#4a5568]">{icon}</span> : null}
      {children}
    </span>
  );
}

function InfoPill({
  title,
  value,
  wide = false,
}: {
  title: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-[8px] border border-[#dce2ea] bg-[#f8fafc] px-3 py-1.5 ${
        wide ? "min-w-[180px]" : "min-w-[108px]"
      }`}
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#8f9bad]">{title}</p>
      <p className="mt-1 text-[17px] font-semibold uppercase leading-tight tracking-[-0.01em] text-[#121926]">
        {value}
      </p>
    </div>
  );
}
