"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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

export default function NewLeadDetailPage({ leadType, leadId }: Props) {
  return (
    <main className="min-h-screen bg-[#eef1f5] px-3 py-4 md:px-4">
      <div className="mx-auto max-w-[1365px]">
        <section className="rounded-xl border border-[#e1e6ed] bg-[#f3f5f8] p-3">
          <div className="py-4 lg:py-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_440px] lg:items-end">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#f4a525]">
                  Priority Lead
                </p>
                <p className="text-[11px] font-semibold text-[#95a0b0]">Updated 2h ago</p>
              </div>
              <h1 className="mt-1 text-[52px] font-black leading-[0.92] tracking-[-0.025em] text-[#0f1729]">
                Lead Information
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <InfoPill title="Stage" value="Experience" />
                <InfoPill title="Sub-Stage" value="Meeting Scheduled" wide />
              </div>

              <div className="mt-3 max-w-[560px]">
                <div className="flex items-end justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a96a8]">
                    Data Completeness
                  </p>
                  <p className="text-[48px] font-black leading-none text-[#1acb5a]">64%</p>
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
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[#1dde63] text-[12px] font-black uppercase tracking-wide text-[#05220f]"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#0f9d3d] text-[10px] leading-none text-[#0f9d3d]">
                    ✓
                  </span>
                  Mark As Won
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#d6dce6] bg-white text-[12px] font-black uppercase tracking-wide text-[#111827]"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#7d8998] text-[10px] leading-none text-[#7d8998]">
                    ⊙
                  </span>
                  Complete Task
                </button>
              </div>
            </div>
          </div>
          </div>

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
                        <h2 className="text-[22px] font-black leading-none tracking-[-0.015em] text-[#101828]">
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
            </section>
          </div>
        </section>
      </div>
    </main>
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
          <p className="mt-0.5 text-[13px] font-semibold text-[#10b981]">Enterprise Lead</p>
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
      <span className="absolute -top-3 left-4 rounded-full bg-[#2ee06a] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#0f1729]">
        Current Phase
      </span>

      <div className="mb-5 flex items-center gap-2.5">
        <span className="inline-block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-[#d4f5e2]" />
        <h2 className="text-[22px] font-black leading-none tracking-[-0.015em] text-[#101828]">
          2. Experience Phase
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-4">
          <div>
            <PhaseFieldLabel>Floor Plan</PhaseFieldLabel>
            <button
              type="button"
              className="flex h-[88px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#c8d0db] bg-white text-[12px] font-bold uppercase tracking-wide text-[#8a96a8]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
              Upload Floor Plan
            </button>
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
          <PhaseFieldLabel>Scope of Work</PhaseFieldLabel>
          <Link
            href={`/Leads/new/${leadType}/${leadId}/configuration-scope`}
            className="flex h-[148px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#c8d0db] bg-white text-[12px] font-bold uppercase tracking-wide text-[#8a96a8]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
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
            Configure Scope
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
          <PhaseFieldLabel>Property Status</PhaseFieldLabel>
          <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold italic text-[#e84c4c]">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#e84c4c] text-[10px] not-italic">
              i
            </span>
            Action required: Site visit not scheduled
          </p>
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
            <ValuePill>Split Level</ValuePill>
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
    </div>
  );
}

function PhaseFieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8b97a8]">
      {children}
    </p>
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
      className={`rounded-[6px] border border-[#dce2ea] bg-[#f8fafc] px-3 py-2 ${
        wide ? "min-w-[156px]" : "min-w-[92px]"
      }`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-[#8f9bad]">{title}</p>
      <p
        className={`mt-1 font-black uppercase tracking-[-0.01em] text-[#121926] ${
          wide ? "text-[21px] leading-[0.92]" : "text-[25px] leading-none"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
