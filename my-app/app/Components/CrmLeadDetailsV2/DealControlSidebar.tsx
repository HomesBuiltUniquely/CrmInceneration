"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLeadDetailV2 } from "./LeadDetailV2Context";
import { V2_BTN_NAV } from "./lead-detail-v2-motion";

export type DealControlSectionId =
  | "deal-overview"
  | "deal-follow-ups"
  | "deal-blockers"
  | "deal-property"
  | "deal-activity";

type NavItem = {
  id: DealControlSectionId;
  label: string;
  icon: "overview" | "follow-ups" | "blockers" | "property" | "activity";
};

const navItems: NavItem[] = [
  { id: "deal-overview", label: "Overview", icon: "overview" },
  { id: "deal-follow-ups", label: "Follow-ups", icon: "follow-ups" },
  { id: "deal-blockers", label: "Blockers", icon: "blockers" },
  { id: "deal-property", label: "Property Details", icon: "property" },
  { id: "deal-activity", label: "Activity", icon: "activity" },
];

function NavIcon({ type, active }: { type: NavItem["icon"]; active: boolean }) {
  const className = `h-4 w-4 shrink-0 ${active ? "text-[#111827]" : "text-[#9ca3af]"}`;
  switch (type) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "follow-ups":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      );
    case "blockers":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
    case "property":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
          <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
        </svg>
      );
    case "activity":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}

function initialsFromName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—"
  );
}

function TeamMemberRow({
  role,
  name,
  avatar,
}: {
  role: string;
  name: string;
  avatar: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {avatar}
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{role}</p>
        <p className="truncate text-[13px] font-bold text-[#111827]">{name}</p>
      </div>
    </div>
  );
}

export default function DealControlSidebar({
  onActivityClick,
}: {
  onActivityClick?: () => void;
}) {
  const { lead } = useLeadDetailV2();
  const [activeSectionId, setActiveSectionId] = useState<DealControlSectionId>("deal-overview");

  const assigneeName = lead.assignee?.trim() || "—";
  const designerName = lead.designerName?.trim() || "—";

  const scrollToSection = useCallback(
    (sectionId: DealControlSectionId) => {
      setActiveSectionId(sectionId);
      if (sectionId === "deal-activity") {
        onActivityClick?.();
        return;
      }
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [onActivityClick],
  );

  useEffect(() => {
    const sectionElements = navItems
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!sectionElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const topEntry = visibleEntries[0];
        if (topEntry?.target.id) {
          setActiveSectionId(topEntry.target.id as DealControlSectionId);
        }
      },
      {
        rootMargin: "-10% 0px -50% 0px",
        threshold: [0.15, 0.35, 0.55],
      },
    );

    sectionElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-full flex-col self-start overflow-hidden rounded-xl border border-[#dfe5ec] bg-[#f8fafc] lg:flex">
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1ed760] text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2v20M2 12h20" />
              </svg>
            </span>
            <div>
              <p className="text-[15px] font-extrabold leading-tight text-[#101828]">Deal Control</p>
              <p className="text-[11px] font-semibold text-[#9ca3af]">Active Ops</p>
            </div>
          </div>
        </div>

        <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Deal sections">
          {navItems.map((item) => {
            const isActive = activeSectionId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                  isActive
                    ? "bg-white text-[#111827] shadow-sm"
                    : `text-[#6b7280] ${V2_BTN_NAV}`
                }`}
              >
                <NavIcon type={item.icon} active={isActive} />
                <span className={`text-[13px] ${isActive ? "font-bold" : "font-semibold"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 shrink-0 space-y-3 border-t border-[#e5e7eb] pt-4">
          <TeamMemberRow
            role="CRM"
            name={assigneeName}
            avatar={
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 to-violet-400 text-[10px] font-bold text-white">
                {initialsFromName(assigneeName)}
              </div>
            }
          />
          <TeamMemberRow
            role="Designer"
            name={designerName}
            avatar={
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-[#9ca3af]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            }
          />
        </div>
      </div>
    </aside>
  );
}
