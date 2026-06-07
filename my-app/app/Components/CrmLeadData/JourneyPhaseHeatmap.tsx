"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeRole } from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { isPresalesRole } from "@/lib/crm-role-access";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { crmLeadTopLevelStage, SALES_POOL_NO_MILESTONE } from "@/lib/leads-filter";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { presalesTopLevelStage } from "@/lib/presales-milestone";
import {
  assigneeAliasNorms,
  filterLeadsForInsightMode,
  normalizeInsightCountOpts,
  type InsightTableMode,
} from "@/lib/lead-follow-up-insights";
import {
  filterLeadsCurrentMonthAssignedPool,
  isLeadVerifiedForPresales,
  leadAssignedToPresalesExecNameSet,
} from "@/lib/presales-heatmap-helpers";
import { shouldPresalesExecutiveSeeLeadInCrmPool } from "@/lib/presales-lead-visibility";
import { trustPresalesUpstreamLeadScope } from "@/lib/presales-leads-pool";
import { setEffectiveNewCrmDateRange } from "@/lib/new-crm-cutoff";
import {
  adminFilterInputFromQueryString,
  fetchAdminLeadsHeatmapData,
  milestoneCountForPhase,
  milestoneCountsFromLeads,
  presalesSummaryMetricsFromLeads,
  salesJourneySummaryFromMilestoneCounts,
  usesAdminLeadsApi,
} from "@/lib/admin-leads-api";
import { appendLeadPoolQuery, type CrmWorkspace } from "@/lib/crm-workspace";

type Phase = {
  phaseLabel: string;
  name: string;
  count: number;
  sharePct: number;
  tone: "healthy" | "warning" | "critical";
  note: { icon: "clock" | "alert" | "money" | "check"; text: string };
};

export type JourneyPhaseHeatmapProps = {
  /** Query string for `/Leads/crm-milestone-counts-filtered` (no leading `?`), e.g. `leadType=all&search=foo` */
  milestoneFilterQuery?: string;
  currentRole?: string;
  leadView?: "default" | "my" | "team";
  currentUserName?: string;
  currentUserAliases?: string[];
  currentUserId?: number;
  managerTeamNames?: string[];
  /** Optional assignee alias scope from the lead table (used for manager hierarchy filters). */
  assigneeScope?: string[];
  /** When set (e.g. Team Leads), phase counts use the same subset as the leads table insight filter. */
  insightTableMode?: InsightTableMode | null;
  /** Selected stage from heatmap card toggle. */
  activeStageFilter?: string;
  /** Toggle stage filter in parent (click same stage again to reset). */
  onPhaseFilterToggle?: (stageName: string) => void;
  /** Display names of presales executives under the current manager (for scoping + Team verified). */
  presalesTeamNames?: string[];
  /** Super-admin presales hub: restrict pool + month cards to leads assigned to these names (PM + PE). */
  aggregatePresalesAssigneeNames?: string[];
  /** Active presales summary tab filter driven by the parent toolbar. */
  presalesSummaryTab?: "total" | "verified" | "teamVerified" | null;
  /** Toggle Total / Verified / Team verified — parent applies date + verification query params. */
  onPresalesSummaryTabChange?: (tab: "total" | "verified" | "teamVerified") => void;
  /** Fast top summary totals from the lead table dataset. */
  summaryTotalsOverride?: { lead: number; opportunity: number } | null;
  /** Admin pool milestone breakdown from LeadsDataSection (one shared /counts call). */
  adminMilestoneCounts?: Record<string, number> | null;
  adminPresalesSummary?: {
    totalMonth: number;
    verifiedMonth: number;
    teamVerifiedMonth: number;
  } | null;
  /** Sales `/Leads` vs presales `/presales-leads` — drives phase labels and pool scope. */
  leadsWorkspace?: CrmWorkspace;
};

function normName(s: string) {
  return s.trim().toLowerCase();
}

function toneByCount(count: number, max: number): Phase["tone"] {
  if (max <= 0 || count <= 0) return "critical";
  const ratio = count / max;
  if (ratio >= 0.67) return "healthy";
  if (ratio >= 0.34) return "warning";
  return "critical";
}

function mergeLeadsById(leads: ApiLead[]): ApiLead[] {
  const byId = new Map<string, ApiLead>();
  for (const lead of leads) {
    const id = lead.id !== undefined && lead.id !== null ? String(lead.id) : "";
    if (!id || byId.has(id)) continue;
    byId.set(id, lead);
  }
  return [...byId.values()];
}

function mapLeadsToPhases(
  leads: ApiLead[],
  defaults: Phase[],
  getTopLevelStage: (lead: ApiLead) => string,
): Phase[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const stage = getTopLevelStage(lead).trim();
    if (!stage) continue;
    const key = normalizeStageKey(stage);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const max = Math.max(...counts.values(), 0);
  return defaults.map((phase) => {
    const count = counts.get(normalizeStageKey(phase.name)) ?? 0;
    return {
      ...phase,
      count,
      sharePct: 0,
      tone: toneByCount(count, max),
      note: {
        icon: phase.note.icon,
        text: count === 0 ? "No leads in this stage." : `${count} lead${count === 1 ? "" : "s"} in this stage.`,
      },
    };
  });
}

function phasesFromMilestoneCountMap(
  defaults: Phase[],
  counts: Record<string, number> | undefined,
  shareDenominator: number,
): Phase[] {
  const mapped = defaults.map((phase) => {
    const count = milestoneCountForPhase(counts, phase.name);
    return {
      ...phase,
      count,
      sharePct: 0,
      tone: toneByCount(count, 0),
      note: {
        icon: phase.note.icon,
        text:
          count === 0 ? "No leads in this stage." : `${count} lead${count === 1 ? "" : "s"} in this stage.`,
      },
    };
  });
  const max = Math.max(...mapped.map((p) => p.count), 0);
  const withTone = mapped.map((p) => ({ ...p, tone: toneByCount(p.count, max) }));
  return phasesWithShareDenominator(withTone, shareDenominator);
}

function phasesWithShareDenominator(phases: Phase[], denominator: number): Phase[] {
  const max = Math.max(...phases.map((p) => p.count), 0);
  const total = denominator > 0 ? denominator : phases.reduce((sum, p) => sum + p.count, 0);
  return phases.map((p) => ({
    ...p,
    sharePct: total > 0 ? Math.round((p.count / total) * 100) : 0,
    tone: toneByCount(p.count, max),
  }));
}

function pickPhase(phases: Phase[], name: string): Phase | undefined {
  const n = normName(name);
  return phases.find((p) => normName(p.name) === n);
}

function Icon({ kind }: { kind: Phase["note"]["icon"] }) {
  if (kind === "clock")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-[var(--crm-text-muted)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M12 7v5l3 2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (kind === "alert")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-[var(--crm-danger-text)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 9v4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M12 17h.01"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M10.3 3.6c.8-1.4 2.6-1.4 3.4 0l8 13.8c.8 1.4-.2 3.1-1.7 3.1H4c-1.6 0-2.5-1.7-1.7-3.1l8-13.8Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  if (kind === "money")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-[var(--crm-text-muted)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M4 7h16v10H4V7Z" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M7 10h.01M17 14h.01"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M12 10.2c1.3 0 2.3.8 2.3 1.8S13.3 13.8 12 13.8s-2.3-.8-2.3-1.8 1-1.8 2.3-1.8Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-[var(--crm-success-text)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center gap-5 text-[10px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--crm-success)]" />
        Higher count
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--crm-warning-text)]" />
        Medium count
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--crm-danger)]" />
        Lower count
      </div>
    </div>
  );
}

function PhaseCard({
  p,
  maxCount,
  active = false,
  onClick,
}: {
  p: Phase;
  maxCount: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const bar =
    p.tone === "healthy"
      ? "bg-[var(--crm-success)]"
      : p.tone === "warning"
        ? "bg-[var(--crm-warning-text)]"
        : "bg-[var(--crm-danger)]";
  const bg =
    p.tone === "healthy"
      ? "bg-[var(--crm-success-bg)]"
      : p.tone === "warning"
        ? "bg-[var(--crm-warning-bg)]"
        : "bg-[var(--crm-danger-bg)]";
  const shareText =
    p.tone === "healthy"
      ? "text-[var(--crm-success-text)]"
      : p.tone === "warning"
        ? "text-[var(--crm-warning-text)]"
        : "text-[var(--crm-danger-text)]";
  const barWidth = maxCount > 0 ? (p.count / maxCount) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full min-h-[168px] w-full flex-col rounded-2xl border px-4 py-4 text-left transition-all sm:px-5 ${
        active
          ? "border-[var(--crm-accent-ring)] ring-2 ring-[var(--crm-accent-ring)]"
          : "border-[var(--crm-border)]"
      } ${bg} ${onClick ? "cursor-pointer hover:-translate-y-px" : ""}`}
      aria-pressed={active}
    >
      <div className="text-[10px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
        {p.phaseLabel}
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-[var(--crm-text-primary)] sm:text-[17px]">
          {p.name}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[20px] font-semibold leading-none text-[var(--crm-text-primary)]">
            {p.count}
          </div>
          <div className={`mt-1 whitespace-nowrap text-[10px] font-semibold ${shareText}`}>
            {p.sharePct}% of total
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full shrink-0 rounded-full bg-[var(--crm-surface)]/70">
        <div
          className={`h-1.5 rounded-full ${bar}`}
          style={{ width: `${Math.min(100, barWidth)}%` }}
        />
      </div>
      <div className="mt-auto flex items-center gap-2 pt-3 text-[10px] font-semibold text-[var(--crm-text-muted)]">
        <Icon kind={p.note.icon} />
        <span>{p.note.text}</span>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-1.5 w-full rounded-b-2xl ${bar}`}
      />
    </button>
  );
}

function SummaryCard({ label, total }: { label: string; total: number }) {
  return (
    <div className="relative flex h-[136px] w-full flex-col justify-between rounded-2xl border border-[var(--crm-warning-text)] bg-[var(--crm-warning-bg)] px-4 py-4 sm:px-5">
      <div className="text-[10px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
        SUMMARY
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1 text-[17px] font-bold leading-snug text-[var(--crm-text-primary)] sm:text-[18px]">
          {label}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[20px] font-semibold leading-none text-[var(--crm-text-primary)]">
            {total.toLocaleString()}
          </div>
          <div className="mt-1 whitespace-nowrap text-[10px] font-semibold text-[var(--crm-warning-text)]">
            total leads
          </div>
        </div>
      </div>
    </div>
  );
}

function PresalesSummaryCard({
  label,
  total,
  subtitle,
  selected,
  onClick,
}: {
  label: string;
  total: number;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-transform hover:opacity-[0.97] active:scale-[0.99]"
      aria-pressed={selected}
    >
      <div
        className={`relative min-h-[132px] rounded-2xl border border-[var(--crm-warning-text)] bg-[var(--crm-warning-bg)] px-5 py-4 ${
          selected ? "ring-2 ring-[var(--crm-text-primary)] ring-offset-2 ring-offset-[var(--crm-surface)]" : ""
        }`}
      >
        <div className="text-[10px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
          SUMMARY
        </div>
        <div className="mt-2 flex items-start justify-between">
          <div className="max-w-[70%] text-[18px] font-bold leading-6 text-[var(--crm-text-primary)]">
            {label}
          </div>
          <div className="text-right">
            <div className="text-[20px] font-semibold text-[var(--crm-text-primary)]">{total}</div>
            <div className="text-[10px] font-semibold text-[var(--crm-warning-text)]">{subtitle}</div>
          </div>
        </div>
      </div>
    </button>
  );
}

/** Presales pipeline — `presalesMilestoneStage` on each lead. */
const PRESALES_DEFAULT_PHASES: Phase[] = [
  {
    phaseLabel: "PHASE 00",
    name: "Fresh Data",
    count: 0,
    sharePct: 0,
    tone: "healthy",
    note: { icon: "clock", text: "New intake — not yet in discovery" },
  },
  {
    phaseLabel: "PHASE 01",
    name: "Data Discovery",
    count: 0,
    sharePct: 0,
    tone: "healthy",
    note: { icon: "clock", text: "Qualifying and enriching lead data" },
  },
  {
    phaseLabel: "PHASE 02",
    name: "Data Conversion",
    count: 0,
    sharePct: 0,
    tone: "warning",
    note: { icon: "check", text: "Ready for verify / sales handoff" },
  },
];

const DEFAULT_PHASES: Phase[] = [
  {
    phaseLabel: "PHASE 00",
    name: "Fresh Lead",
    count: 0,
    sharePct: 0,
    tone: "healthy",
    note: { icon: "clock", text: "Newly created leads" },
  },
  {
    phaseLabel: "PHASE 01",
    name: "Discovery",
    count: 0,
    sharePct: 0,
    tone: "healthy",
    note: { icon: "clock", text: "Avg. 3.2 Days in Stage" },
  },
  {
    phaseLabel: "PHASE 02",
    name: "Connection",
    count: 0,
    sharePct: 0,
    tone: "warning",
    note: { icon: "clock", text: "34 Leads past SLA" },
  },
  {
    phaseLabel: "PHASE 03",
    name: "Experience & Design",
    count: 0,
    sharePct: 0,
    tone: "critical",
    note: { icon: "alert", text: "Critical Path (48h)" },
  },
  {
    phaseLabel: "PHASE 04",
    name: "Decision",
    count: 0,
    sharePct: 0,
    tone: "warning",
    note: { icon: "money", text: "$2.4M Pipeline Value" },
  },
  {
    phaseLabel: "PHASE 05",
    name: "Closed",
    count: 0,
    sharePct: 0,
    tone: "healthy",
    note: { icon: "check", text: "86% Conversion" },
  },
];

export default function JourneyPhaseHeatmap({
  milestoneFilterQuery,
  currentRole = "",
  leadView = "default",
  currentUserName = "",
  currentUserAliases = [],
  currentUserId = 0,
  managerTeamNames = [],
  assigneeScope = [],
  presalesTeamNames = [],
  aggregatePresalesAssigneeNames = [],
  insightTableMode = null,
  activeStageFilter = "",
  onPhaseFilterToggle,
  presalesSummaryTab = null,
  onPresalesSummaryTabChange,
  summaryTotalsOverride = null,
  adminMilestoneCounts = null,
  adminPresalesSummary = null,
  leadsWorkspace = "sales",
}: JourneyPhaseHeatmapProps = {}) {
  const [poolLeads, setPoolLeads] = useState<ApiLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminCountsLocal, setAdminCountsLocal] = useState<Record<string, number> | null>(
    null,
  );
  const [adminPoolTotalLocal, setAdminPoolTotalLocal] = useState<number | null>(null);
  const [adminPresalesSummaryLocal, setAdminPresalesSummaryLocal] = useState<{
    totalMonth: number;
    verifiedMonth: number;
    teamVerifiedMonth: number;
  } | null>(null);
  const adminCountsFetchKeyRef = useRef("");
  const [leadOpen, setLeadOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [presalesPhasesOpen, setPresalesPhasesOpen] = useState(false);

  const insightOpts = useMemo(
    () =>
      normalizeInsightCountOpts({
        viewerRole: normalizeRole(currentRole),
        currentUserName: currentUserName ?? "",
        managerTeamNames,
        leadView:
          leadView === "my" || leadView === "team" ? leadView : ("default" as const),
      }),
    [currentRole, currentUserName, managerTeamNames, leadView],
  );
  const assigneeScopeKey = assigneeScope
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("\0");
  const assigneeScopeSet = useMemo(
    () => new Set(assigneeScopeKey ? assigneeScopeKey.split("\0") : []),
    [assigneeScopeKey],
  );

  const filteredInsightLeads = useMemo(
    () =>
      filterLeadsForInsightMode(poolLeads, insightTableMode ?? null, insightOpts),
    [poolLeads, insightTableMode, insightOpts],
  );

  const roleKeyUi = normalizeRole(currentRole);
  const aggregateNormKey = (aggregatePresalesAssigneeNames ?? [])
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("\0");
  const aggregateNormSet = useMemo(
    () => new Set(aggregateNormKey ? aggregateNormKey.split("\0") : []),
    [aggregateNormKey],
  );
  const isAdminHeatmapViewer =
    usesAdminLeadsApi(roleKeyUi) && leadView !== "my" && leadView !== "team";
  const usePresalesSummaryUi = leadsWorkspace === "presales";
  const showPresalesManagerTeamVerifiedCard =
    leadsWorkspace === "presales" &&
    roleKeyUi === "PRESALES_MANAGER" &&
    aggregateNormSet.size === 0;

  const presalesIdentity = useMemo(() => {
    const myAliases = new Set(
      [currentUserName, ...currentUserAliases].map((v) => v.trim().toLowerCase()).filter(Boolean),
    );
    const isSelfLeadById = (lead: ApiLead) => {
      if (!Number.isFinite(currentUserId) || currentUserId <= 0) return false;
      const r = lead as Record<string, unknown>;
      const assigneeObj =
        r.assignee && typeof r.assignee === "object" && !Array.isArray(r.assignee)
          ? (r.assignee as Record<string, unknown>)
          : null;
      const salesOwnerObj =
        r.salesOwner && typeof r.salesOwner === "object" && !Array.isArray(r.salesOwner)
          ? (r.salesOwner as Record<string, unknown>)
          : null;
      const idCandidates = [
        r.assigneeId,
        r.assignedToId,
        r.salesExecutiveId,
        r.salesOwnerId,
        r.userId,
        assigneeObj?.id,
        salesOwnerObj?.id,
      ];
      return idCandidates.some((v) => Number(v ?? 0) === Number(currentUserId));
    };
    const isSelfLead = (lead: ApiLead) => {
      if (isSelfLeadById(lead)) return true;
      const aliases = assigneeAliasNorms(lead);
      for (const me of myAliases) if (aliases.has(me)) return true;
      return false;
    };
    return { isSelfLead };
  }, [currentUserName, currentUserAliases, currentUserId]);

  const presalesMonthMetrics = useMemo(() => {
    if (isAdminHeatmapViewer && adminPresalesSummaryLocal) return adminPresalesSummaryLocal;
    if (adminPresalesSummary && usesAdminLeadsApi(roleKeyUi)) return adminPresalesSummary;
    // Summary counts must reflect full presales pool, not an insight-tile drill-down subset.
    const monthPool = filterLeadsCurrentMonthAssignedPool(poolLeads);
    const totalMonth = monthPool.length;
    const verifiedMonth = monthPool.filter((l) => isLeadVerifiedForPresales(l)).length;
    const execNorms = new Set(
      presalesTeamNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
    );
    const teamVerifiedMonth =
      roleKeyUi === "PRESALES_MANAGER" && aggregateNormSet.size === 0
        ? monthPool.filter(
            (l) =>
              isLeadVerifiedForPresales(l) &&
              !presalesIdentity.isSelfLead(l) &&
              leadAssignedToPresalesExecNameSet(l, execNorms),
          ).length
        : 0;
    return { totalMonth, verifiedMonth, teamVerifiedMonth };
  }, [
    adminPresalesSummary,
    adminPresalesSummaryLocal,
    isAdminHeatmapViewer,
    aggregateNormSet.size,
    poolLeads,
    presalesTeamNames,
    roleKeyUi,
    presalesIdentity,
  ]);

  /** Presales journey phases must match Total / Verified / Team summary cards (this-month assigned pool). */
  const presalesPhaseLeads = useMemo(() => {
    if (!usePresalesSummaryUi || presalesSummaryTab === null) {
      return filteredInsightLeads;
    }
    let leads = filterLeadsCurrentMonthAssignedPool(filteredInsightLeads);
    if (presalesSummaryTab === "verified") {
      return leads.filter((l) => isLeadVerifiedForPresales(l));
    }
    if (presalesSummaryTab === "teamVerified") {
      const execNorms = new Set(
        presalesTeamNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
      );
      return leads.filter(
        (l) =>
          isLeadVerifiedForPresales(l) &&
          !presalesIdentity.isSelfLead(l) &&
          leadAssignedToPresalesExecNameSet(l, execNorms),
      );
    }
    return leads;
  }, [
    usePresalesSummaryUi,
    presalesSummaryTab,
    filteredInsightLeads,
    presalesTeamNames,
    presalesIdentity,
  ]);

  const assigneeScopedAdminCounts =
    assigneeScope.length > 0 || summaryTotalsOverride != null;
  const adminCountsEffective = useMemo(() => {
    if (!isAdminHeatmapViewer) return null;
    if (assigneeScopedAdminCounts) {
      if (adminMilestoneCounts && Object.keys(adminMilestoneCounts).length > 0) {
        return adminMilestoneCounts;
      }
      return adminCountsLocal ?? adminMilestoneCounts;
    }
    if (adminCountsLocal && Object.keys(adminCountsLocal).length > 0) return adminCountsLocal;
    if (adminMilestoneCounts && Object.keys(adminMilestoneCounts).length > 0) {
      return adminMilestoneCounts;
    }
    return adminCountsLocal ?? adminMilestoneCounts;
  }, [
    isAdminHeatmapViewer,
    assigneeScopedAdminCounts,
    adminCountsLocal,
    adminMilestoneCounts,
  ]);

  const adminSummaryFromCounts = useMemo(
    () => salesJourneySummaryFromMilestoneCounts(adminCountsEffective ?? undefined),
    [adminCountsEffective],
  );

  const phases = useMemo(() => {
    const defaults = usePresalesSummaryUi ? PRESALES_DEFAULT_PHASES : DEFAULT_PHASES;
    if (isAdminHeatmapViewer && adminCountsEffective && Object.keys(adminCountsEffective).length > 0) {
      if (usePresalesSummaryUi) {
        const mapped = mapLeadsToPhases(poolLeads, defaults, presalesTopLevelStage);
        return phasesWithShareDenominator(mapped, presalesMonthMetrics.totalMonth);
      }
      const counts = adminCountsEffective;
      const poolTotal =
        adminPoolTotalLocal ??
        Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
      const phaseDefaults =
        (counts[SALES_POOL_NO_MILESTONE] ?? 0) > 0
          ? [
              ...defaults,
              {
                phaseLabel: "—",
                name: SALES_POOL_NO_MILESTONE,
                count: 0,
                sharePct: 0,
                tone: "warning" as const,
                note: {
                  icon: "alert" as const,
                  text: "Sales assignee but milestone_stage empty (legacy)",
                },
              },
            ]
          : defaults;
      return phasesFromMilestoneCountMap(phaseDefaults, counts, poolTotal);
    }
    if (adminCountsEffective && Object.keys(adminCountsEffective).length > 0) {
      const shareDenominator = usePresalesSummaryUi
        ? presalesSummaryTab === "verified"
          ? presalesMonthMetrics.verifiedMonth
          : presalesSummaryTab === "teamVerified"
            ? presalesMonthMetrics.teamVerifiedMonth
            : presalesSummaryTab === "total"
              ? presalesMonthMetrics.totalMonth
              : Object.values(adminCountsEffective).reduce((s, n) => s + (Number(n) || 0), 0)
        : (() => {
            const combined = adminSummaryFromCounts.lead + adminSummaryFromCounts.opportunity;
            return combined > 0
              ? combined
              : Object.values(adminCountsEffective).reduce((s, n) => s + (Number(n) || 0), 0);
          })();
      return phasesFromMilestoneCountMap(defaults, adminCountsEffective, shareDenominator);
    }
    const getStage = usePresalesSummaryUi ? presalesTopLevelStage : crmLeadTopLevelStage;
    const sourceLeads = usePresalesSummaryUi ? presalesPhaseLeads : filteredInsightLeads;
    const mapped = mapLeadsToPhases(sourceLeads, defaults, getStage);
    if (!usePresalesSummaryUi) return mapped;
    const shareDenominator =
      presalesSummaryTab === "verified"
        ? presalesMonthMetrics.verifiedMonth
        : presalesSummaryTab === "teamVerified"
          ? presalesMonthMetrics.teamVerifiedMonth
          : presalesSummaryTab === "total"
            ? presalesMonthMetrics.totalMonth
            : mapped.reduce((sum, p) => sum + p.count, 0);
    return phasesWithShareDenominator(mapped, shareDenominator);
  }, [
    adminCountsEffective,
    adminPoolTotalLocal,
    adminSummaryFromCounts.lead,
    adminSummaryFromCounts.opportunity,
    isAdminHeatmapViewer,
    poolLeads,
    filteredInsightLeads,
    presalesPhaseLeads,
    usePresalesSummaryUi,
    presalesSummaryTab,
    presalesMonthMetrics.totalMonth,
    presalesMonthMetrics.verifiedMonth,
    presalesMonthMetrics.teamVerifiedMonth,
    summaryTotalsOverride?.lead,
    summaryTotalsOverride?.opportunity,
  ]);

  const freshLeadPhase = pickPhase(phases, "Fresh Lead");
  const discoveryPhase = pickPhase(phases, "Discovery");
  const connectionPhase = pickPhase(phases, "Connection");
  const expDesignPhase = pickPhase(phases, "Experience & Design");
  const decisionPhase = pickPhase(phases, "Decision");
  const closedPhase = pickPhase(phases, "Closed");
  const noMilestonePhase = pickPhase(phases, SALES_POOL_NO_MILESTONE);
  const leadPhasesRaw = [
    freshLeadPhase,
    discoveryPhase,
    connectionPhase,
    isAdminHeatmapViewer && noMilestonePhase && (noMilestonePhase.count ?? 0) > 0
      ? noMilestonePhase
      : null,
  ].filter((p): p is Phase => Boolean(p));
  const opportunityPhasesRaw = [expDesignPhase, decisionPhase, closedPhase].filter(
    (p): p is Phase => Boolean(p),
  );
  const leadTotal = leadPhasesRaw.reduce((sum, p) => sum + p.count, 0);
  const opportunityTotal = opportunityPhasesRaw.reduce((sum, p) => sum + p.count, 0);
  const adminSummaryFromCountsLocal = useMemo(
    () => salesJourneySummaryFromMilestoneCounts(adminCountsEffective ?? undefined),
    [adminCountsEffective],
  );
  const adminLeadSummaryTotal = adminSummaryFromCountsLocal.lead;
  const adminOppSummaryTotal = adminSummaryFromCountsLocal.opportunity;
  const summaryLeadTotal = isAdminHeatmapViewer
    ? usePresalesSummaryUi
      ? leadTotal
      : summaryTotalsOverride?.lead ?? adminLeadSummaryTotal
    : (summaryTotalsOverride?.lead ?? leadTotal);
  const summaryOpportunityTotal = isAdminHeatmapViewer
    ? usePresalesSummaryUi
      ? opportunityTotal
      : summaryTotalsOverride?.opportunity ?? adminOppSummaryTotal
    : (summaryTotalsOverride?.opportunity ?? opportunityTotal);
  const adminGrandTotal =
    isAdminHeatmapViewer && !usePresalesSummaryUi
      ? summaryTotalsOverride != null
        ? summaryTotalsOverride.lead + summaryTotalsOverride.opportunity
        : (adminPoolTotalLocal ?? adminLeadSummaryTotal + adminOppSummaryTotal)
      : 0;
  const shareGrandTotal =
    adminGrandTotal > 0 ? adminGrandTotal : summaryLeadTotal + summaryOpportunityTotal;
  const leadPhases = phasesWithShareDenominator(
    leadPhasesRaw,
    isAdminHeatmapViewer && !usePresalesSummaryUi ? shareGrandTotal : summaryLeadTotal,
  );
  const opportunityPhases = phasesWithShareDenominator(
    opportunityPhasesRaw,
    isAdminHeatmapViewer && !usePresalesSummaryUi ? shareGrandTotal : summaryOpportunityTotal,
  );
  const maxCount = Math.max(
    ...leadPhases.map((phase) => phase.count),
    ...opportunityPhases.map((phase) => phase.count),
    0,
  );

  /** Admin pools: one `/counts` call per filter signature (deduped in admin-leads-api). */
  useEffect(() => {
    if (!isAdminHeatmapViewer) {
      adminCountsFetchKeyRef.current = "";
      return;
    }
    if (assigneeScope.length > 0 || summaryTotalsOverride != null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const input = adminFilterInputFromQueryString(
      milestoneFilterQuery?.trim() ?? "",
      leadsWorkspace,
      presalesSummaryTab,
    );
    const fetchKey = `${leadsWorkspace}:${JSON.stringify(input)}`;
    if (adminCountsFetchKeyRef.current === fetchKey) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      setError("");
      setPoolLeads((prev) => (prev.length === 0 ? prev : []));
      try {
        const data = await fetchAdminLeadsHeatmapData(input, getCrmAuthHeaders());
        if (cancelled) return;
        adminCountsFetchKeyRef.current = fetchKey;
        setAdminCountsLocal(data.milestoneCounts);
        setAdminPoolTotalLocal(
          data.uniquePrimaryTotal ?? data.pipelineTotal ?? data.totalElements,
        );
        setPoolLeads(data.leads);
        if (leadsWorkspace === "presales") {
          setAdminPresalesSummaryLocal(
            data.leads.length > 0
              ? presalesSummaryMetricsFromLeads(data.leads)
              : {
                  totalMonth: data.totalElements,
                  verifiedMonth: data.verifiedCount,
                  teamVerifiedMonth: 0,
                },
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load admin counts.");
          setAdminCountsLocal(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAdminHeatmapViewer,
    milestoneFilterQuery,
    leadsWorkspace,
    presalesSummaryTab,
    assigneeScopeKey,
    summaryTotalsOverride?.lead,
    summaryTotalsOverride?.opportunity,
  ]);

  useEffect(() => {
    if (isAdminHeatmapViewer) return;

    let cancelled = false;

    async function loadMilestoneCounts() {
      try {
        setLoading(true);
        setError("");

        const filtered = milestoneFilterQuery?.trim();
        const query = new URLSearchParams(filtered ?? "");
        const verificationStatusFromQuery = (query.get("verificationStatus") ?? "").trim();
        // Presales month cards need full pool; sales heatmap must match verified table scope.
        if (leadsWorkspace === "presales") {
          query.delete("verificationStatus");
        }
        // Presales month cards derive "this month" from assignment timestamps in client helper.
        // Avoid server-side updatedAt month filtering here, otherwise assignment-month counts can drift.
        query.delete("crmMonthWindow");
        setEffectiveNewCrmDateRange(query, query.get("dateFrom"), query.get("dateTo"));
        query.set("mergeAll", "1");
        query.set("milestoneScope", "crm");
        appendLeadPoolQuery(query, leadsWorkspace);
        query.set("page", "0");
        query.set("size", "500");
        query.set("sort", "updatedAt,desc");
        const firstRes = await fetch(`/api/crm/leads?${query.toString()}`, {
          cache: "no-store",
          credentials: "include",
          headers: getCrmAuthHeaders(),
        });
        if (!firstRes.ok) {
          const text = await firstRes.text();
          throw new Error(text || `HTTP ${firstRes.status}`);
        }
        const firstPage = (await firstRes.json()) as SpringPage<ApiLead>;
        const allLeads: ApiLead[] = Array.isArray(firstPage.content) ? [...firstPage.content] : [];
        const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
        if (totalPages > 1) {
          const followUps = [];
          for (let p = 1; p < totalPages; p++) {
            const nextQuery = new URLSearchParams(query);
            nextQuery.set("page", String(p));
            followUps.push(
              fetch(`/api/crm/leads?${nextQuery.toString()}`, {
                cache: "no-store",
                credentials: "include",
                headers: getCrmAuthHeaders(),
              }).then(async (r) => {
                if (!r.ok) return [] as ApiLead[];
                const json = (await r.json().catch(() => ({}))) as SpringPage<ApiLead>;
                return Array.isArray(json.content) ? json.content : [];
              })
            );
          }
          const rest = await Promise.all(followUps);
          for (const chunk of rest) allLeads.push(...chunk);
        }
        const visibleLeads = mergeLeadsById(allLeads);
        const roleKey = roleKeyUi;

        const myAliases = new Set(
          [currentUserName, ...currentUserAliases].map((v) => v.trim().toLowerCase()).filter(Boolean)
        );
        const teamSet = new Set(managerTeamNames.map((v) => v.trim().toLowerCase()).filter(Boolean));
        const isSelfLeadById = (lead: ApiLead) => {
          if (!Number.isFinite(currentUserId) || currentUserId <= 0) return false;
          const r = lead as Record<string, unknown>;
          const assigneeObj =
            r.assignee && typeof r.assignee === "object" && !Array.isArray(r.assignee)
              ? (r.assignee as Record<string, unknown>)
              : null;
          const salesOwnerObj =
            r.salesOwner && typeof r.salesOwner === "object" && !Array.isArray(r.salesOwner)
              ? (r.salesOwner as Record<string, unknown>)
              : null;
          const idCandidates = [
            r.assigneeId,
            r.assignedToId,
            r.salesExecutiveId,
            r.salesOwnerId,
            r.userId,
            assigneeObj?.id,
            salesOwnerObj?.id,
          ];
          return idCandidates.some((v) => Number(v ?? 0) === Number(currentUserId));
        };
        const isSelfLead = (lead: ApiLead) => {
          if (isSelfLeadById(lead)) return true;
          const aliases = assigneeAliasNorms(lead);
          for (const me of myAliases) if (aliases.has(me)) return true;
          return false;
        };
        const isTeamLead = (lead: ApiLead) => {
          const aliases = assigneeAliasNorms(lead);
          for (const alias of aliases) if (teamSet.has(alias)) return true;
          return false;
        };
        const presalesTeamSet = new Set(
          presalesTeamNames.map((v) => v.trim().toLowerCase()).filter(Boolean),
        );
        const isPresalesTeamMemberLead = (lead: ApiLead) => {
          const aliases = assigneeAliasNorms(lead);
          for (const alias of aliases) if (presalesTeamSet.has(alias)) return true;
          return false;
        };
        const roleScopedLeads = visibleLeads.filter((lead) => {
          if (trustPresalesUpstreamLeadScope(roleKey)) return true;
          if (
            leadsWorkspace === "presales" &&
            (roleKey === "SUPER_ADMIN" || roleKey === "ADMIN" || roleKey === "SALES_ADMIN")
          ) {
            return true;
          }
          if (roleKey === "SUPER_ADMIN" && aggregateNormSet.size > 0) {
            return leadAssignedToPresalesExecNameSet(lead, aggregateNormSet);
          }
          if (roleKey === "SUPER_ADMIN" || roleKey === "ADMIN" || roleKey === "SALES_ADMIN") return true;
          if (roleKey === "SALES_EXECUTIVE") {
            return isSelfLead(lead);
          }
          if (roleKey === "PRESALES_EXECUTIVE" || roleKey === "PRE_SALES") {
            return shouldPresalesExecutiveSeeLeadInCrmPool(lead, {
              currentUserId,
              verificationStatusFilter: verificationStatusFromQuery,
              isSelfLead,
            });
          }
          if (roleKey === "PRESALES_MANAGER") {
            if (presalesTeamSet.size === 0) return isSelfLead(lead);
            return isSelfLead(lead) || isPresalesTeamMemberLead(lead);
          }
          if (roleKey === "SALES_MANAGER" || roleKey === "MANAGER") {
            if (leadView === "my") return isSelfLead(lead);
            if (leadView === "team") return teamSet.size > 0 ? isTeamLead(lead) : false;
            return isSelfLead(lead) || (teamSet.size > 0 ? isTeamLead(lead) : false);
          }
          return false;
        });
        const scopedLeads =
          assigneeScopeSet.size === 0
            ? roleScopedLeads
            : roleScopedLeads.filter((lead) => {
                const aliases = assigneeAliasNorms(lead);
                for (const alias of aliases) if (assigneeScopeSet.has(alias)) return true;
                return false;
              });
        if (!cancelled) {
          setPoolLeads(scopedLeads);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMilestoneCounts();

    return () => {
      cancelled = true;
    };
  }, [
    isAdminHeatmapViewer,
    milestoneFilterQuery,
    currentRole,
    leadView,
    currentUserName,
    currentUserAliases,
    currentUserId,
    managerTeamNames,
    assigneeScopeKey,
    presalesTeamNames,
    aggregateNormKey,
    leadsWorkspace,
    presalesSummaryTab,
  ]);

  return (
    <section className="mx-auto mt-6 max-w-[1200px] px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-[var(--crm-text-primary)]">
              Journey Phase Heatmap
            </span>
          </div>
        </div>
        <StatusLegend />
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 shadow-[var(--crm-shadow-sm)]">
        {loading || error ? (
          <div className="mb-3 text-[11px] font-medium text-[var(--crm-text-muted)]">
            {loading ? "Loading milestone counts from CRM API..." : `Could not load counts: ${error}`}
          </div>
        ) : null}
        {usePresalesSummaryUi ? (
          <div>
            <div
              className={`grid grid-cols-1 gap-4 ${showPresalesManagerTeamVerifiedCard ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              <PresalesSummaryCard
                label="Total"
                total={presalesMonthMetrics.totalMonth}
                subtitle="assigned · this month"
                selected={presalesSummaryTab === "total"}
                onClick={() => onPresalesSummaryTabChange?.("total")}
              />
              <PresalesSummaryCard
                label="Verified"
                total={presalesMonthMetrics.verifiedMonth}
                subtitle="verified · this month"
                selected={presalesSummaryTab === "verified"}
                onClick={() => onPresalesSummaryTabChange?.("verified")}
              />
              {showPresalesManagerTeamVerifiedCard ? (
                <PresalesSummaryCard
                  label="Team verified"
                  total={presalesMonthMetrics.teamVerifiedMonth}
                  subtitle="execs · this month"
                  selected={presalesSummaryTab === "teamVerified"}
                  onClick={() => onPresalesSummaryTabChange?.("teamVerified")}
                />
              ) : null}
            </div>
            <div
              className={`mt-4 rounded-2xl transition-all ${
                presalesPhasesOpen
                  ? "border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3 shadow-[var(--crm-shadow-sm)]"
                  : "border-0 bg-transparent p-0 shadow-none"
              }`}
            >
              <button
                type="button"
                onClick={() => setPresalesPhasesOpen((v) => !v)}
                className="w-full text-left"
                aria-expanded={presalesPhasesOpen}
              >
                <div className="relative flex min-h-[48px] items-center justify-between rounded-xl border border-dashed border-[var(--crm-border)] px-4 py-3">
                  <span className="text-[13px] font-semibold text-[var(--crm-text-primary)]">
                    Journey phases
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--crm-warning-text)]">
                    {presalesPhasesOpen ? "Hide" : "Open"}
                  </span>
                </div>
              </button>
              {presalesPhasesOpen ? (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {phases.map((p) => (
                    <PhaseCard
                      key={`${p.phaseLabel}-${p.name}`}
                      p={p}
                      maxCount={maxCount}
                      active={normName(activeStageFilter) === normName(p.name)}
                      onClick={() => onPhaseFilterToggle?.(p.name)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
            <div
              className={`flex h-full flex-col rounded-2xl transition-all ${
                leadOpen
                  ? "border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3 shadow-[var(--crm-shadow-sm)]"
                  : "border-0 bg-transparent p-0 shadow-none"
              }`}
            >
              <button
                type="button"
                onClick={() => setLeadOpen((v) => !v)}
                className="w-full shrink-0 text-left"
                aria-expanded={leadOpen}
              >
                <div className="relative w-full">
                  <SummaryCard label="Lead" total={summaryLeadTotal} />
                  <span className="pointer-events-none absolute right-4 top-4 text-[12px] font-semibold text-[var(--crm-warning-text)]">
                    {leadOpen ? "Hide" : "Open"}
                  </span>
                </div>
              </button>
              {leadOpen ? (
                <div className="mt-3 grid flex-1 grid-cols-1 gap-3 md:auto-rows-fr md:grid-cols-3">
                  {leadPhases.map((p) => (
                    <PhaseCard
                      key={`${p.phaseLabel}-${p.name}`}
                      p={p}
                      maxCount={maxCount}
                      active={normName(activeStageFilter) === normName(p.name)}
                      onClick={() => {
                        if (!leadOpen) setLeadOpen(true);
                        onPhaseFilterToggle?.(p.name);
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div
              className={`flex h-full flex-col rounded-2xl transition-all ${
                opportunityOpen
                  ? "border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3 shadow-[var(--crm-shadow-sm)]"
                  : "border-0 bg-transparent p-0 shadow-none"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpportunityOpen((v) => !v)}
                className="w-full shrink-0 text-left"
                aria-expanded={opportunityOpen}
              >
                <div className="relative w-full">
                  <SummaryCard label="Opportunity" total={summaryOpportunityTotal} />
                  <span className="pointer-events-none absolute right-4 top-4 text-[12px] font-semibold text-[var(--crm-warning-text)]">
                    {opportunityOpen ? "Hide" : "Open"}
                  </span>
                </div>
              </button>
              {opportunityOpen ? (
                <div className="mt-3 grid flex-1 grid-cols-1 gap-3 md:auto-rows-fr md:grid-cols-3">
                  {opportunityPhases.map((p) => (
                    <PhaseCard
                      key={`${p.phaseLabel}-${p.name}`}
                      p={p}
                      maxCount={maxCount}
                      active={normName(activeStageFilter) === normName(p.name)}
                      onClick={() => onPhaseFilterToggle?.(p.name)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
