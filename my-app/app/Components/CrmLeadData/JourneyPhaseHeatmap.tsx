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
  toCanonicalSalesMilestone,
  usesAdminLeadsApi,
} from "@/lib/admin-leads-api";
import { appendLeadPoolQuery, type CrmWorkspace } from "@/lib/crm-workspace";
import {
  preferFilteredLeadInventoryOverHubCounts,
} from "@/lib/crm-date-field-filter";
import { leadMatchesAssigneeScope } from "@/lib/admin-assignee-match";
import { filterLeadsToSalesManagerBucket } from "@/lib/sales-manager-lead-scope";
import { LEADS_PAGE_CONTAINER_CLASS } from "./leads-page-layout";

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
  leadView?: "default" | "my" | "team" | "combined";
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
  /** Sales: map raw stage into 6 canonical phases (unknown/blank → Fresh Lead). */
  canonicalizeSales = false,
): Phase[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const raw = getTopLevelStage(lead).trim();
    if (!raw && !canonicalizeSales) continue;
    const stage = canonicalizeSales ? toCanonicalSalesMilestone(raw || "Fresh Lead") : raw;
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
  accent = "auto",
}: {
  p: Phase;
  maxCount: number;
  active?: boolean;
  onClick?: () => void;
  /** Presales funnel: fixed stage colors so empty cards stay readable. */
  accent?: "auto" | "fresh" | "discovery" | "conversion";
}) {
  const isEmpty = p.count <= 0;
  const toneBar =
    p.tone === "healthy"
      ? "bg-[var(--crm-success)]"
      : p.tone === "warning"
        ? "bg-[var(--crm-warning-text)]"
        : "bg-[var(--crm-danger)]";
  const toneBg =
    p.tone === "healthy"
      ? "bg-[var(--crm-success-bg)]"
      : p.tone === "warning"
        ? "bg-[var(--crm-warning-bg)]"
        : "bg-[var(--crm-danger-bg)]";
  const toneShare =
    p.tone === "healthy"
      ? "text-[var(--crm-success-text)]"
      : p.tone === "warning"
        ? "text-[var(--crm-warning-text)]"
        : "text-[var(--crm-danger-text)]";

  const accentBar =
    accent === "fresh"
      ? "bg-[var(--crm-info)]"
      : accent === "discovery"
        ? "bg-[var(--crm-warning-text)]"
        : accent === "conversion"
          ? "bg-[var(--crm-success)]"
          : toneBar;
  const accentBg =
    accent === "fresh"
      ? "bg-[var(--crm-info-bg)]"
      : accent === "discovery"
        ? "bg-[var(--crm-warning-bg)]"
        : accent === "conversion"
          ? "bg-[var(--crm-success-bg)]"
          : toneBg;
  const accentShare =
    accent === "fresh"
      ? "text-[var(--crm-info-text)]"
      : accent === "discovery"
        ? "text-[var(--crm-warning-text)]"
        : accent === "conversion"
          ? "text-[var(--crm-success-text)]"
          : toneShare;

  const bar = isEmpty && accent === "auto" ? "bg-[var(--crm-border-strong)]" : accentBar;
  const bg =
    isEmpty && accent === "auto"
      ? "bg-[var(--crm-surface)]"
      : isEmpty
        ? `${accentBg} opacity-[0.92]`
        : accentBg;
  const shareText =
    isEmpty && accent === "auto" ? "text-[var(--crm-text-muted)]" : accentShare;
  const barWidth = maxCount > 0 ? (p.count / maxCount) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-full min-h-[148px] w-full flex-col overflow-hidden rounded-2xl border px-4 py-3.5 text-left shadow-[var(--crm-shadow-sm)] transition-all duration-200 sm:min-h-[156px] sm:px-5 ${
        active
          ? "border-[var(--crm-accent)] ring-2 ring-[var(--crm-accent-ring)]"
          : "border-[var(--crm-border)] hover:border-[var(--crm-border-strong)]"
      } ${bg} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--crm-shadow-md)]" : ""}`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--crm-text-muted)]">
          {p.phaseLabel}
        </div>
        {active ? (
          <span className="rounded-full bg-[var(--crm-accent-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--crm-accent-strong)]">
            Filtered
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-[var(--crm-text-primary)] sm:text-[16px]">
          {p.name}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[26px] font-extrabold tabular-nums leading-none tracking-tight text-[var(--crm-text-primary)]">
            {p.count.toLocaleString()}
          </div>
          <div className={`mt-1 whitespace-nowrap text-[10px] font-semibold ${shareText}`}>
            {p.sharePct}% of total
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-[var(--crm-surface)]/80">
        <div
          className={`h-1.5 rounded-full transition-[width] duration-300 ${bar}`}
          style={{ width: `${isEmpty ? 0 : Math.min(100, Math.max(barWidth, 0))}%` }}
        />
      </div>
      <div className="mt-auto flex items-center gap-2 pt-3 text-[10px] font-semibold leading-snug text-[var(--crm-text-muted)]">
        <Icon kind={p.note.icon} />
        <span className="line-clamp-2">{p.note.text}</span>
      </div>
      <div className={`absolute bottom-0 left-0 h-1.5 w-full ${bar}`} />
    </button>
  );
}

function SummaryCard({
  label,
  total,
  loading = false,
}: {
  label: string;
  total: number;
  loading?: boolean;
}) {
  return (
    <div className="relative flex min-h-[152px] w-full flex-col justify-between rounded-2xl border border-[var(--crm-warning-text)] bg-[var(--crm-warning-bg)] px-5 py-5 md:min-h-[160px] md:px-6">
      <div className="text-[10px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
        SUMMARY
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 text-[22px] font-bold leading-tight text-[var(--crm-text-primary)] md:text-[24px]">
          {label}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[28px] font-semibold leading-none text-[var(--crm-text-primary)] md:text-[30px]">
            {loading && total <= 0 ? "…" : total.toLocaleString()}
          </div>
          <div className="mt-1 whitespace-nowrap text-[11px] font-semibold text-[var(--crm-warning-text)]">
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
  loading = false,
}: {
  label: string;
  total: number;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-all duration-200 hover:opacity-[0.98] active:scale-[0.995]"
      aria-pressed={selected}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border px-5 py-4 sm:px-6 sm:py-5 ${
          selected
            ? "border-[var(--crm-accent)] bg-gradient-to-r from-[var(--crm-accent-soft)] via-[var(--crm-surface)] to-[var(--crm-surface)] ring-2 ring-[var(--crm-accent-ring)]"
            : "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] hover:border-[var(--crm-border-strong)]"
        }`}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[var(--crm-accent)]"
          aria-hidden
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--crm-text-muted)]">
              Summary
            </div>
            <div className="mt-1.5 text-[22px] font-extrabold leading-none tracking-tight text-[var(--crm-text-primary)] sm:text-[26px]">
              {label}
            </div>
            <div className="mt-2 inline-flex items-center rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--crm-text-secondary)]">
              {subtitle}
            </div>
          </div>
          <div className="flex shrink-0 items-end justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
            <div className="flex items-baseline gap-2">
              <span className="text-[40px] font-extrabold tabular-nums leading-none tracking-tight text-[var(--crm-text-primary)] sm:text-[44px]">
                {loading && total <= 0 ? "…" : total.toLocaleString()}
              </span>
              <span className="pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--crm-text-muted)]">
                leads
              </span>
            </div>
            {selected ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--crm-accent-strong)]">
                Active filter
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[var(--crm-text-muted)]">
                Tap to filter table
              </span>
            )}
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
  /** Manager / Executive Total card + phases use full assigned pool (not this month only). */
  const presalesTotalAllTime = usePresalesSummaryUi && isPresalesRole(roleKeyUi);
  /**
   * Table/leads effect synced journey map (id-merge blank→Fresh).
   * SM previously; SE/presales exec must use the same path or phase cards diverge
   * from Lead/Opp/Total (mapLeadsToPhases dropped non-canonical stage labels).
   */
  const clientSyncedJourneyCounts =
    !isAdminHeatmapViewer &&
    adminMilestoneCounts != null &&
    Object.keys(adminMilestoneCounts).length > 0;

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
    // PE/PM Total card: prefer table-synced summary (no second full-pool download).
    if (
      adminPresalesSummary &&
      (usesAdminLeadsApi(roleKeyUi) || isPresalesRole(roleKeyUi))
    ) {
      return adminPresalesSummary;
    }
    // Summary counts must reflect full presales pool, not an insight-tile drill-down subset.
    const countPool = presalesTotalAllTime
      ? poolLeads
      : filterLeadsCurrentMonthAssignedPool(poolLeads);
    const totalMonth = countPool.length;
    const verifiedMonth = countPool.filter((l) => isLeadVerifiedForPresales(l)).length;
    const execNorms = new Set(
      presalesTeamNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
    );
    const teamVerifiedMonth =
      roleKeyUi === "PRESALES_MANAGER" && aggregateNormSet.size === 0
        ? countPool.filter(
            (l) =>
              isLeadVerifiedForPresales(l) &&
              !presalesIdentity.isSelfLead(l) &&
              leadAssignedToPresalesExecNameSet(l, execNorms),
          ).length
        : 0;
    // Edge: synced phase map arrived before summary — derive Total from phase histogram.
    if (totalMonth <= 0 && clientSyncedJourneyCounts && adminMilestoneCounts) {
      const fromPhases = Object.values(adminMilestoneCounts).reduce(
        (s, n) => s + (Number(n) || 0),
        0,
      );
      if (fromPhases > 0) {
        return { totalMonth: fromPhases, verifiedMonth: 0, teamVerifiedMonth: 0 };
      }
    }
    return { totalMonth, verifiedMonth, teamVerifiedMonth };
  }, [
    adminPresalesSummary,
    adminPresalesSummaryLocal,
    adminMilestoneCounts,
    clientSyncedJourneyCounts,
    isAdminHeatmapViewer,
    aggregateNormSet.size,
    poolLeads,
    presalesTeamNames,
    roleKeyUi,
    presalesIdentity,
    presalesTotalAllTime,
  ]);

  /** Presales journey phases match the Total summary card (all-time for manager/exec). */
  const presalesPhaseLeads = useMemo(() => {
    if (!usePresalesSummaryUi || presalesSummaryTab === null) {
      return filteredInsightLeads;
    }
    if (presalesTotalAllTime) return filteredInsightLeads;
    return filterLeadsCurrentMonthAssignedPool(filteredInsightLeads);
  }, [
    usePresalesSummaryUi,
    presalesSummaryTab,
    filteredInsightLeads,
    presalesTotalAllTime,
  ]);

  const assigneeScopedAdminCounts =
    assigneeScope.length > 0 || summaryTotalsOverride != null;
  const adminCountsEffective = useMemo(() => {
    if (clientSyncedJourneyCounts) {
      return adminMilestoneCounts;
    }
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
    clientSyncedJourneyCounts,
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
        ? presalesSummaryTab === "total"
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
    const mapped = mapLeadsToPhases(
      sourceLeads,
      defaults,
      getStage,
      !usePresalesSummaryUi,
    );
    if (!usePresalesSummaryUi) return mapped;
    const shareDenominator =
      presalesSummaryTab === "total"
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
  /** Prefer table-synced summary when present; else phase sums (same inventory after SM/SE sync). */
  const summaryLeadTotal = isAdminHeatmapViewer
    ? usePresalesSummaryUi
      ? leadTotal
      : summaryTotalsOverride?.lead ?? adminLeadSummaryTotal
    : clientSyncedJourneyCounts
      ? summaryTotalsOverride?.lead ?? adminLeadSummaryTotal ?? leadTotal
      : summaryTotalsOverride?.lead ?? leadTotal;
  const summaryOpportunityTotal = isAdminHeatmapViewer
    ? usePresalesSummaryUi
      ? opportunityTotal
      : summaryTotalsOverride?.opportunity ?? adminOppSummaryTotal
    : clientSyncedJourneyCounts
      ? summaryTotalsOverride?.opportunity ?? adminOppSummaryTotal ?? opportunityTotal
      : summaryTotalsOverride?.opportunity ?? opportunityTotal;
  const listFilterActive = useMemo(() => {
    const q = milestoneFilterQuery?.trim() ?? "";
    if (!q) return false;
    const p = new URLSearchParams(q);
    const aliasRaw = (p.get("assigneeAliasSet") ?? "").trim();
    return preferFilteredLeadInventoryOverHubCounts({
      dateFrom: p.get("dateFrom"),
      dateTo: p.get("dateTo"),
      dateField: p.get("dateField"),
      crmMonthWindow: p.get("crmMonthWindow"),
      assignee: p.get("assignee"),
      assigneeAliasSet: aliasRaw
        ? aliasRaw.split("\0").map((s) => s.trim()).filter(Boolean)
        : undefined,
      search: p.get("search"),
      reinquiry: p.get("reinquiry"),
      milestoneStage: p.get("milestoneStage") ?? p.get("presalesMilestoneStage"),
      milestoneStageCategory:
        p.get("milestoneStageCategory") ?? p.get("presalesMilestoneCategory"),
      milestoneSubStage: p.get("milestoneSubStage") ?? p.get("presalesMilestoneSubStage"),
      leadType: p.get("leadType"),
    });
  }, [milestoneFilterQuery]);
  const journeyCardSum =
    (summaryTotalsOverride?.lead ?? summaryLeadTotal) +
    (summaryTotalsOverride?.opportunity ?? summaryOpportunityTotal);
  const adminGrandTotal =
    isAdminHeatmapViewer && !usePresalesSummaryUi
      ? listFilterActive
        ? // List filter: Hub `/counts` stays unscoped — share % must use journey inventory.
          Math.max(journeyCardSum, summaryLeadTotal + summaryOpportunityTotal)
        : Math.max(
            // Prefer Hub `/counts.totalElements` (full CRM scope) — not Lead+Opportunity card sum.
            Number(adminPoolTotalLocal ?? 0),
            summaryTotalsOverride != null
              ? summaryTotalsOverride.lead + summaryTotalsOverride.opportunity
              : adminLeadSummaryTotal + adminOppSummaryTotal,
          )
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
      // Keep pool total aligned with list-scoped Lead/Opp when parent owns the sync.
      if (summaryTotalsOverride != null) {
        const q = milestoneFilterQuery?.trim() ?? "";
        const p = q ? new URLSearchParams(q) : null;
        const aliasRaw = (p?.get("assigneeAliasSet") ?? "").trim();
        const listOn = p
          ? preferFilteredLeadInventoryOverHubCounts({
              dateFrom: p.get("dateFrom"),
              dateTo: p.get("dateTo"),
              dateField: p.get("dateField"),
              crmMonthWindow: p.get("crmMonthWindow"),
              assignee: p.get("assignee"),
              assigneeAliasSet: aliasRaw
                ? aliasRaw.split("\0").map((s) => s.trim()).filter(Boolean)
                : undefined,
              search: p.get("search"),
              reinquiry: p.get("reinquiry"),
              milestoneStage: p.get("milestoneStage") ?? p.get("presalesMilestoneStage"),
              milestoneStageCategory:
                p.get("milestoneStageCategory") ?? p.get("presalesMilestoneCategory"),
              milestoneSubStage:
                p.get("milestoneSubStage") ?? p.get("presalesMilestoneSubStage"),
              leadType: p.get("leadType"),
            })
          : assigneeScope.length > 0;
        if (listOn || assigneeScope.length > 0) {
          setAdminPoolTotalLocal(
            summaryTotalsOverride.lead + summaryTotalsOverride.opportunity,
          );
        }
      }
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
          Math.max(
            Number(data.totalElements ?? 0),
            Number(data.uniquePrimaryTotal ?? 0),
            Number(data.pipelineTotal ?? 0),
          ) || null,
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
    // Table already synced journey milestone map — do not re-fetch and under-count.
    if (clientSyncedJourneyCounts) {
      setLoading(false);
      setError("");
      return;
    }

    /**
     * PE/PM: Hub JWT + table BFF page already owns scope/counts. A parallel size=50000
     * walk raced the table and left "Loading milestone counts…" stuck. Wait for sync;
     * soft-timeout clears spinner if table fails.
     */
    if (trustPresalesUpstreamLeadScope(roleKeyUi) && assigneeScope.length === 0) {
      setLoading(true);
      setError("");
      const timeoutId = window.setTimeout(() => {
        setLoading(false);
        setError((prev) => prev || "Counts are taking longer than usual — try refresh.");
      }, 90_000);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

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
        // Presales month cards use Hub `dateField=assigned` via crmMonthWindow in the query string.
        const hasMonthWindow = (query.get("crmMonthWindow") ?? "").trim().toLowerCase() === "current";
        if (!hasMonthWindow) {
          setEffectiveNewCrmDateRange(query, query.get("dateFrom"), query.get("dateTo"));
        }
        query.set("mergeAll", "1");
        query.set("milestoneScope", "crm");
        appendLeadPoolQuery(query, leadsWorkspace);
        query.set("page", "0");
        // One large page: BFF rebuilds full mergeAll per request — avoid N×500 round-trips.
        query.set("size", "50000");
        query.set("sort", "updatedAt,desc");

        const fetchAllPages = async (base: URLSearchParams): Promise<ApiLead[]> => {
          const firstRes = await fetch(`/api/crm/leads?${base.toString()}`, {
            cache: "no-store",
            credentials: "include",
            headers: getCrmAuthHeaders(),
          });
          if (!firstRes.ok) {
            const text = await firstRes.text();
            throw new Error(text || `HTTP ${firstRes.status}`);
          }
          const firstPage = (await firstRes.json()) as SpringPage<ApiLead>;
          const all: ApiLead[] = Array.isArray(firstPage.content) ? [...firstPage.content] : [];
          const totalElements = Number(firstPage.totalElements ?? all.length);
          const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
          if (all.length >= totalElements || totalPages <= 1) {
            return all;
          }
          const followUps = [];
          for (let p = 1; p < totalPages; p++) {
            const nextQuery = new URLSearchParams(base);
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
              }),
            );
          }
          const rest = await Promise.all(followUps);
          for (const chunk of rest) all.push(...chunk);
          return all;
        };

        const roleKey = roleKeyUi;
        const useSmCombinedEndpoints =
          (roleKey === "SALES_MANAGER" || roleKey === "MANAGER") &&
          (leadView === "combined" || leadView === "default");

        let allLeads: ApiLead[];
        if (useSmCombinedEndpoints) {
          // Same Hub membership as My Leads table (my-leads ∪ team-leads).
          const qMy = new URLSearchParams(query);
          qMy.set("roleView", "my");
          const qTeam = new URLSearchParams(query);
          qTeam.set("roleView", "team");
          const [myRows, teamRows] = await Promise.all([
            fetchAllPages(qMy),
            fetchAllPages(qTeam),
          ]);
          allLeads = [...myRows, ...teamRows];
        } else {
          if (leadView === "my" || leadView === "team") {
            query.set("roleView", leadView);
          }
          allLeads = await fetchAllPages(query);
        }
        const visibleLeads = mergeLeadsById(allLeads);

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
        /**
         * Hub my∪team is the base inventory, but must allowlist this manager's roster
         * (userId + exact aliases). Blind trust leaked other SM/SE leads (e.g. Razi).
         */
        const roleScopedLeads = useSmCombinedEndpoints
          ? filterLeadsToSalesManagerBucket(visibleLeads, {
              managerUserId: currentUserId ?? 0,
              managerAliases: [currentUserName ?? "", ...currentUserAliases],
              teamUserIds: [],
              teamAliases: managerTeamNames,
            })
          : visibleLeads.filter((lead) => {
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
          assigneeScope.length === 0
            ? roleScopedLeads
            : roleScopedLeads.filter((lead) =>
                leadMatchesAssigneeScope(lead, assigneeScope),
              );
        const journeyLeads = scopedLeads;
        if (!cancelled) {
          setPoolLeads(journeyLeads);
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
    clientSyncedJourneyCounts,
    milestoneFilterQuery,
    currentRole,
    roleKeyUi,
    leadView,
    currentUserName,
    currentUserAliases,
    currentUserId,
    managerTeamNames,
    assigneeScopeKey,
    assigneeScope.length,
    presalesTeamNames,
    aggregateNormKey,
    leadsWorkspace,
    presalesSummaryTab,
  ]);

  return (
    <section className={`${LEADS_PAGE_CONTAINER_CLASS} mt-2`}>
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

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[var(--crm-shadow-sm)]">
        {loading || error ? (
          <div className="flex items-center gap-2 border-b border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-4 py-2.5 md:px-5">
            {loading ? (
              <>
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--crm-accent)]"
                  aria-hidden
                />
                <span className="text-[11px] font-medium text-[var(--crm-text-muted)]">
                  Loading milestone counts from CRM API…
                </span>
              </>
            ) : (
              <span className="text-[11px] font-medium text-[var(--crm-danger-text)]">
                Could not load counts: {error}
              </span>
            )}
          </div>
        ) : null}
        {usePresalesSummaryUi ? (
          <div className="space-y-4 p-4 md:p-5">
            <PresalesSummaryCard
              label="Total"
              total={presalesMonthMetrics.totalMonth}
              subtitle={
                presalesTotalAllTime ? "assigned · all time" : "assigned · this month"
              }
              selected={presalesSummaryTab === "total" || presalesSummaryTab === null}
              onClick={() => onPresalesSummaryTabChange?.("total")}
              loading={loading && presalesMonthMetrics.totalMonth <= 0}
            />
            <div
              className={`rounded-2xl transition-all ${
                presalesPhasesOpen
                  ? "border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3 sm:p-4"
                  : "border-0 bg-transparent p-0"
              }`}
            >
              <button
                type="button"
                onClick={() => setPresalesPhasesOpen((v) => !v)}
                className="w-full text-left"
                aria-expanded={presalesPhasesOpen}
              >
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 sm:px-4 ${
                    presalesPhasesOpen
                      ? "bg-[var(--crm-surface)] shadow-[var(--crm-shadow-sm)]"
                      : "border border-dashed border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[var(--crm-text-primary)]">
                      Journey phases
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-[var(--crm-text-muted)]">
                      Fresh → Discovery → Conversion
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-1 text-[11px] font-bold text-[var(--crm-accent-strong)]">
                    {presalesPhasesOpen ? "Hide" : "Open"}
                  </span>
                </div>
              </button>
              {presalesPhasesOpen ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
                  {phases.map((p, index) => {
                    const accent =
                      index === 0
                        ? "fresh"
                        : index === 1
                          ? "discovery"
                          : "conversion";
                    return (
                      <PhaseCard
                        key={`${p.phaseLabel}-${p.name}`}
                        p={p}
                        maxCount={maxCount}
                        accent={accent}
                        active={normName(activeStageFilter) === normName(p.name)}
                        onClick={() => onPhaseFilterToggle?.(p.name)}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-4 p-4 md:grid-cols-2 md:p-5">
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
                  <SummaryCard
                    label="Lead"
                    total={summaryLeadTotal}
                    loading={loading && summaryLeadTotal <= 0}
                  />
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
                  <SummaryCard
                    label="Opportunity"
                    total={summaryOpportunityTotal}
                    loading={loading && summaryOpportunityTotal <= 0}
                  />
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
