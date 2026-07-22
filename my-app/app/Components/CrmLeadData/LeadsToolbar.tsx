import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getLeadTypeFilterOptions,
  isPresalesRole,
  toRoleKey,
} from "@/lib/crm-role-access";
import {
  milestoneCategoryOptionsForStage,
  milestoneStageOptionsFromNested,
  milestoneSubStageOptionsForCategory,
} from "@/lib/milestone-filter-tree";
import { PRESALES_PIPELINE_STAGE_ORDER } from "@/lib/presales-milestone";
import type { CrmNestedStage } from "@/types/crm-pipeline";
import type { InsightTableMode } from "@/lib/lead-follow-up-insights";
import { LOST_SEGMENT_TILES } from "@/lib/lead-lost-segment";
import { LEADS_PAGE_CONTAINER_CLASS } from "./leads-page-layout";
import type { LeadSourceCounts } from "@/lib/leads-filter";
import {
  ADMIN_SOURCE_LEAD_TYPE_TILES,
  defaultLeadTypeCountPool,
  leadSourceCountsForPool,
  leadTypeTileClickFiltersTable,
  type CrossPoolLeadTypeCounts,
  type LeadTypeCountPool,
} from "@/lib/lead-type-tile-pool";
import { normalizeRole } from "@/lib/auth/api";
import { isSalesPoolNoMilestoneFilter, type CrmWorkspace } from "@/lib/crm-workspace";
import { SALES_POOL_NO_MILESTONE } from "@/lib/leads-filter";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { canUsePresalesHierarchyFilters, isAdminRole } from "@/lib/roleUtils";
import {
  crmDateFieldToolbarOptionsForViewer,
  isToolbarDateFilterActive,
  parseCrmDateFieldSelection,
  viewerShowsMeetingDateToolbarOption,
  type CrmDateFieldSelection,
} from "@/lib/crm-date-field-filter";

function meetingQuoteLeadTypeTiles(
  counts: Record<string, number>,
): Array<[string, number]> {
  return [
    ["Meeting Scheduled", counts.meetingScheduled ?? 0],
    ["Meeting Rescheduled", counts.meetingRescheduled ?? 0],
    ["Meeting Cancelled", counts.meetingCancelled ?? 0],
    ["Quote Sent", counts.quoteSent ?? 0],
    ["Quote Due", counts.quoteDue ?? 0],
  ];
}

function insightKeyForLeadTypeLabel(
  label: string,
): Exclude<InsightTableMode, null> | null {
  if (label === "Today's Lead Followup") return "followUpActive";
  if (label === "First Call Delayed") return "callDelayed";
  if (label === "Total Calls") return "totalCalls";
  if (label === "Today's Opportunity Followup") return "followUpClosure";
  if (label === "Lead Overdue") return "overdueActive";
  if (label === "Opportunity Overdue") return "overdueClosure";
  if (label === "Team Leads") return "teamLeads";
  if (label === "Meeting Scheduled") return "meetingScheduled";
  if (label === "Meeting Rescheduled") return "meetingRescheduled";
  if (label === "Meeting Cancelled") return "meetingCancelled";
  if (label === "Quote Sent") return "quoteSent";
  if (label === "Quote Due") return "quoteDue";
  if (label === "Discovery Lost") return "lostDiscovery";
  if (label === "Connection Lost") return "lostConnection";
  if (label === "Experience & Design Lost") return "lostExperienceDesign";
  if (label === "Decision Lost") return "lostDecision";
  if (label === "Closed Lost") return "lostClosed";
  return null;
}

function Pill({
  label,
  value,
  secondaryValue,
  secondaryTitle = "All rows (with duplicates)",
  active,
}: {
  label: string;
  value?: number | string;
  /** Shown to the right of `value` (e.g. all rows with duplicates). */
  secondaryValue?: number | string;
  secondaryTitle?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold ${
        active
          ? "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]"
          : "text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
      }`}
    >
      <span>{label}</span>
      {value !== undefined ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-[var(--crm-accent)] text-white" : "bg-[var(--crm-surface-subtle)] text-[var(--crm-text-muted)]"}`}
        >
          {value}
        </span>
      ) : null}
      {secondaryValue !== undefined ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            active
              ? "bg-[var(--crm-surface)] text-[var(--crm-text-secondary)] ring-1 ring-[var(--crm-border)]"
              : "bg-[var(--crm-surface-subtle)] text-[var(--crm-text-muted)]"
          }`}
          title={secondaryTitle}
        >
          {secondaryValue}
        </span>
      ) : null}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--crm-text-secondary)]" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--crm-text-secondary)]" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 5v14m0 0-3-3m3 3 3-3M17 19V5m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 text-[var(--crm-text-muted)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterSelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`group flex min-h-[52px] flex-col justify-center gap-0.5 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-2 py-1.5 transition-all ${
        disabled
          ? "cursor-not-allowed opacity-55"
          : "hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface)] focus-within:border-[var(--crm-accent-ring)] focus-within:ring-2 focus-within:ring-[var(--crm-accent-soft)]"
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--crm-text-muted)]">
        {label}
      </span>
      <div className="relative min-w-0">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-[11px] font-semibold text-[var(--crm-text-primary)] focus:outline-none disabled:cursor-not-allowed"
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-[var(--crm-text-muted)]">
          <Chevron />
        </div>
      </div>
    </label>
  );
}

function FilterDateField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <label
      className={`group flex min-h-[52px] flex-col justify-center gap-0.5 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-2 py-1.5 transition-all ${
        disabled
          ? "cursor-not-allowed opacity-55"
          : "hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface)] focus-within:border-[var(--crm-accent-ring)] focus-within:ring-2 focus-within:ring-[var(--crm-accent-soft)]"
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--crm-text-muted)]">
        {label}
      </span>
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[11px] font-semibold text-[var(--crm-text-primary)] focus:outline-none disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`group flex items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 transition-colors hover:border-[var(--crm-border-strong)] ${disabled ? "opacity-60" : ""}`}
    >
      <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--crm-text-secondary)]">{label}</span>
      <div className="relative min-w-0 flex-1">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-[12px] font-semibold text-[var(--crm-text-primary)] focus:outline-none disabled:cursor-not-allowed"
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
          <Chevron />
        </div>
      </div>
    </label>
  );
}

type LeadsToolbarProps = {
  totalCount?: number;
  rangeStart?: number;
  rangeEnd?: number;
  loading?: boolean;
  leadTypeCounts?: Record<string, number>;
  /** Admin: primary-source unique per lead type (Lead Types tiles). */
  leadTypeCountsPrimary?: LeadSourceCounts;
  /** Admin: all Hub rows per lead type (duplicates). */
  leadTypeCountsAllRows?: LeadSourceCounts;
  /** Temporary override for right badge on Total Leads pill. */
  totalLeadsSecondaryOverride?: number;
  totalLeadsSecondaryTitle?: string;
  /** SALES_ADMIN / SUPER_ADMIN: "X (Y rows)" on Total Leads pill. */
  adminTotalLeadsDisplay?: { uniquePrimary: number; totalRows: number };
  /** SUPER_ADMIN search only: separate Sales / Presales pool match counts. */
  superAdminSearchPoolTotals?: { sales: number; presales: number };
  /** SUPER_ADMIN only: sales + presales per-source counts for pool toggle. */
  crossPoolLeadTypeCounts?: CrossPoolLeadTypeCounts;
  /** True while SUPER_ADMIN has active cross-pool search (show Sales/Presales pills). */
  superAdminCrossPoolSearchActive?: boolean;
  /** When set (e.g. from `Header`), used for badge / role checks on first paint so exec assignee scoping is not counted as a filter. */
  authRole?: string;
  viewerRole?: string;
  leadType: string;
  sort: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
  dateField: CrmDateFieldSelection;
  milestoneStage: string;
  milestoneStageCategory: string;
  milestoneSubStage: string;
  reinquiry: string;
  salesAdminFilter: string;
  salesManagerFilter: string;
  salesExecFilter: string;
  presalesManagerFilter: string;
  presalesExecFilter: string;
  salesAdminOptions: string[];
  salesManagerOptions: string[];
  salesExecOptions: string[];
  presalesManagerOptions: string[];
  presalesExecOptions: string[];
  assigneeOptions: string[];
  pipelineNested: CrmNestedStage[];
  onLeadTypeChange: (next: string) => void;
  onSortChange: (next: string) => void;
  onAssigneeChange: (next: string) => void;
  onDateFromChange: (next: string) => void;
  onDateToChange: (next: string) => void;
  onDateFieldChange: (next: CrmDateFieldSelection) => void;
  onMilestoneStageChange: (next: string) => void;
  onMilestoneStageCategoryChange: (next: string) => void;
  onMilestoneSubStageChange: (next: string) => void;
  onReinquiryChange: (next: string) => void;
  onSalesAdminFilterChange: (next: string) => void;
  onSalesManagerFilterChange: (next: string) => void;
  onSalesExecFilterChange: (next: string) => void;
  onPresalesManagerFilterChange: (next: string) => void;
  onPresalesExecFilterChange: (next: string) => void;
  showDeleteAllButton?: boolean;
  deleteAllLabel?: string;
  deleteAllDisabled?: boolean;
  onDeleteAllClick?: () => void;
  insightActive?: InsightTableMode;
  onInsightNavigate?: (mode: Exclude<InsightTableMode, null>) => void;
  /** Presales heatmap uses Total / Verified cards — hide duplicate total pill. */
  hideTotalLeadsPill?: boolean;
  /** Clear presales month summary when user resets filters from the toolbar. */
  onResetPresalesSummary?: () => void;
  onResetAll?: () => void;
  leadsWorkspace?: CrmWorkspace;
};

export default function LeadsToolbar({
  totalCount,
  rangeStart,
  rangeEnd,
  loading,
  leadTypeCounts = {},
  leadTypeCountsPrimary,
  leadTypeCountsAllRows,
  totalLeadsSecondaryOverride,
  totalLeadsSecondaryTitle,
  adminTotalLeadsDisplay,
  superAdminSearchPoolTotals,
  crossPoolLeadTypeCounts,
  superAdminCrossPoolSearchActive = false,
  authRole = "",
  viewerRole = "",
  leadType,
  sort,
  assignee,
  dateFrom,
  dateTo,
  dateField,
  milestoneStage,
  milestoneStageCategory,
  milestoneSubStage,
  reinquiry,
  salesAdminFilter,
  salesManagerFilter,
  salesExecFilter,
  presalesManagerFilter,
  presalesExecFilter,
  salesAdminOptions,
  salesManagerOptions,
  salesExecOptions,
  presalesManagerOptions,
  presalesExecOptions,
  assigneeOptions,
  pipelineNested,
  onLeadTypeChange,
  onSortChange,
  onAssigneeChange,
  onDateFromChange,
  onDateToChange,
  onDateFieldChange,
  onMilestoneStageChange,
  onMilestoneStageCategoryChange,
  onMilestoneSubStageChange,
  onReinquiryChange,
  onSalesAdminFilterChange,
  onSalesManagerFilterChange,
  onSalesExecFilterChange,
  onPresalesManagerFilterChange,
  onPresalesExecFilterChange,
  showDeleteAllButton = false,
  deleteAllLabel = "Delete All",
  deleteAllDisabled = false,
  onDeleteAllClick,
  insightActive = null,
  onInsightNavigate,
  hideTotalLeadsPill = false,
  onResetPresalesSummary,
  onResetAll,
  leadsWorkspace = "sales",
}: LeadsToolbarProps) {
  const [openFilter, setOpenFilter] = useState(false);
  const [openSort, setOpenSort] = useState(false);
  const [openLeadTypes, setOpenLeadTypes] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(dateTo);
  const [draftDateField, setDraftDateField] = useState(dateField);
  const [callsTileMode, setCallsTileMode] = useState<"totalCalls" | "callDelayed">(() =>
    insightActive === "callDelayed" ? "callDelayed" : "totalCalls",
  );
  const [leadTypeCountPool, setLeadTypeCountPool] = useState<LeadTypeCountPool>(() =>
    defaultLeadTypeCountPool(leadsWorkspace),
  );
  const activeCallsTileMode =
    insightActive === "callDelayed" || insightActive === "totalCalls"
      ? insightActive
      : callsTileMode;
  const callsTileLabel =
    activeCallsTileMode === "totalCalls" ? "Total Calls" : "First Call Delayed";
  const callsTileValue =
    activeCallsTileMode === "totalCalls"
      ? leadTypeCounts.totalCalls ?? 0
      : leadTypeCounts.callDelayed ?? 0;
  const role = normalizeRole(authRole || viewerRole);
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSalesManager = role === "SALES_MANAGER";
  const isSalesAdmin = role === "SALES_ADMIN";
  const isAdminPoolViewer = isAdminRole(role) || isSalesAdmin;
  /** SUPER_ADMIN only: primary + all-rows totals side by side. */
  const showAdminPoolDualTotals =
    isSuperAdmin &&
    isAdminPoolViewer &&
    leadTypeCountsPrimary !== undefined &&
    leadTypeCountsAllRows !== undefined &&
    (leadTypeCountsPrimary.all > 0 || leadTypeCountsAllRows.all > 0);
  /** Admin pool (and other roles): milestone/source tiles use primary-source dedupe when available. */
  const adminPoolUsesPrimaryCounts =
    isAdminPoolViewer &&
    leadTypeCountsPrimary !== undefined &&
    leadTypeCountsPrimary.all > 0;
  const fallbackSourceCounts: LeadSourceCounts = useMemo(() => {
    if (adminPoolUsesPrimaryCounts && leadTypeCountsPrimary) {
      return leadTypeCountsPrimary;
    }
    return {
      all: Number(leadTypeCounts.all ?? 0),
      formlead: Number(leadTypeCounts.formlead ?? 0),
      glead: Number(leadTypeCounts.glead ?? 0),
      mlead: Number(leadTypeCounts.mlead ?? 0),
      addlead: Number(leadTypeCounts.addlead ?? 0),
      websitelead: Number(leadTypeCounts.websitelead ?? 0),
      walkinlead: Number(leadTypeCounts.walkinlead ?? 0),
      whatsapplead: Number(leadTypeCounts.whatsapplead ?? 0),
    };
  }, [adminPoolUsesPrimaryCounts, leadTypeCounts, leadTypeCountsPrimary]);
  const showLeadTypePoolToggle = isSuperAdmin && Boolean(crossPoolLeadTypeCounts);
  const pooledSourceCounts = useMemo(
    () =>
      leadSourceCountsForPool(leadTypeCountPool, crossPoolLeadTypeCounts, fallbackSourceCounts),
    [leadTypeCountPool, crossPoolLeadTypeCounts, fallbackSourceCounts],
  );
  const sourceTileClickFilters = leadTypeTileClickFiltersTable(
    leadTypeCountPool,
    leadsWorkspace,
  );
  useEffect(() => {
    setLeadTypeCountPool(defaultLeadTypeCountPool(leadsWorkspace));
  }, [leadsWorkspace]);
  const adminSourceLeadTypeTiles = useMemo(
    () =>
      ADMIN_SOURCE_LEAD_TYPE_TILES.map((tile) => ({
        ...tile,
        value:
          tile.leadTypeKey === "ivr_call"
            ? Number(leadTypeCounts.ivr_call ?? 0)
            : Number(
                pooledSourceCounts[tile.leadTypeKey as keyof typeof pooledSourceCounts] ?? 0,
              ),
      })),
    [pooledSourceCounts, leadTypeCounts.ivr_call],
  );
  const adminPoolAllCount = pooledSourceCounts.all ?? 0;
  const adminPoolPrimaryTotal =
    adminPoolUsesPrimaryCounts && leadTypeCountsPrimary
      ? leadTypeCountsPrimary.all
      : showLeadTypePoolToggle
        ? adminPoolAllCount
        : undefined;
  const sourceTileLeadTypeByLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const tile of ADMIN_SOURCE_LEAD_TYPE_TILES) {
      map.set(tile.label, tile.leadTypeKey);
    }
    return map;
  }, []);
  const adminSourceLeadTypeRows = useMemo(
    () => adminSourceLeadTypeTiles.map((tile) => [tile.label, tile.value] as [string, number]),
    [adminSourceLeadTypeTiles],
  );
  const adminPoolAllRowsTotal =
    showAdminPoolDualTotals && leadTypeCountsAllRows ? leadTypeCountsAllRows.all : undefined;
  const totalLeadsPillPrimary =
    adminPoolPrimaryTotal !== undefined ? adminPoolPrimaryTotal : totalCount;
  const totalLeadsPillSecondary =
    totalLeadsSecondaryOverride !== undefined
      ? totalLeadsSecondaryOverride
      : adminPoolAllRowsTotal !== undefined &&
          adminPoolPrimaryTotal !== undefined &&
          adminPoolAllRowsTotal !== adminPoolPrimaryTotal
        ? adminPoolAllRowsTotal
        : undefined;
  const showAdminCustomersRowsPill =
    (isSuperAdmin || isSalesAdmin) && adminTotalLeadsDisplay !== undefined;
  const totalLeadsPillLabel = showAdminCustomersRowsPill
    ? `${adminTotalLeadsDisplay.uniquePrimary.toLocaleString()} (${adminTotalLeadsDisplay.totalRows.toLocaleString()} rows)`
    : undefined;
  const isSalesExecutive = role === "SALES_EXECUTIVE";
  const isPresalesManager = role === "PRESALES_MANAGER";
  const isPresalesExecutive = toRoleKey(role) === "PRESALES_EXECUTIVE";
  const isPresalesFlow = isPresalesManager || isPresalesExecutive;
  const showPresalesHierarchyFilters = canUsePresalesHierarchyFilters(role);
  const isSalesWorkspace = leadsWorkspace === "sales";
  const isPresalesWorkspace = leadsWorkspace === "presales";
  const dateFieldToolbarOptions = useMemo(
    () => crmDateFieldToolbarOptionsForViewer({ workspace: leadsWorkspace, role }),
    [leadsWorkspace, role],
  );
  const showMeetingDateToolbar = viewerShowsMeetingDateToolbarOption({
    workspace: leadsWorkspace,
    role,
  });
  const showMeetingQuoteTiles = isSalesManager || isSalesExecutive || isSalesAdmin;
  const meetingQuoteTiles = showMeetingQuoteTiles
    ? meetingQuoteLeadTypeTiles(leadTypeCounts)
    : [];
  const leadTypeOptions = getLeadTypeFilterOptions(role, isSalesExecutive);

  const milestoneStageOptions = useMemo(() => {
    if (isPresalesWorkspace) {
      return [...PRESALES_PIPELINE_STAGE_ORDER];
    }
    const base = milestoneStageOptionsFromNested(pipelineNested);
    return base.filter(
      (s) => normalizeStageKey(s) !== normalizeStageKey(SALES_POOL_NO_MILESTONE),
    );
  }, [isPresalesWorkspace, pipelineNested]);
  const milestoneStageCategoryOptions = useMemo(
    () => milestoneCategoryOptionsForStage(pipelineNested, milestoneStage),
    [pipelineNested, milestoneStage],
  );
  const milestoneSubStageOptions = useMemo(
    () =>
      milestoneSubStageOptionsForCategory(
        pipelineNested,
        milestoneStage,
        milestoneStageCategory,
      ),
    [pipelineNested, milestoneStage, milestoneStageCategory],
  );
  const salesNoMilestoneFilterActive = isSalesPoolNoMilestoneFilter(milestoneStage);

  useEffect(() => {
    setDraftDateFrom(dateFrom);
  }, [dateFrom]);

  useEffect(() => {
    setDraftDateTo(dateTo);
  }, [dateTo]);

  useEffect(() => {
    setDraftDateField(dateField);
  }, [dateField]);

  const clearAppliedDateFilter = () => {
    if (dateField || dateFrom || dateTo) {
      onDateFieldChange("");
      onDateFromChange("");
      onDateToChange("");
    }
  };

  const applyDateFilterToParent = (
    field: CrmDateFieldSelection,
    from: string,
    to: string,
  ) => {
    if (!field || !from || !to) return;
    if (field !== dateField) onDateFieldChange(field);
    if (from !== dateFrom) onDateFromChange(from);
    if (to !== dateTo) onDateToChange(to);
  };

  const handleDraftDateFieldChange = (raw: string) => {
    const next = parseCrmDateFieldSelection(raw);
    setDraftDateField(next);
    if (!next) {
      setDraftDateFrom("");
      setDraftDateTo("");
      clearAppliedDateFilter();
      return;
    }
    clearAppliedDateFilter();
    if (draftDateFrom && draftDateTo) {
      applyDateFilterToParent(next, draftDateFrom, draftDateTo);
    }
  };

  const commitDateRange = (nextFrom: string, nextTo: string) => {
    setDraftDateFrom(nextFrom);
    setDraftDateTo(nextTo);
    const bothEmpty = !nextFrom && !nextTo;
    const bothFilled = Boolean(nextFrom && nextTo);
    if (!bothEmpty && !bothFilled) return;

    if (bothEmpty) {
      clearAppliedDateFilter();
      return;
    }

    if (!draftDateField) return;
    applyDateFilterToParent(draftDateField, nextFrom, nextTo);
  };

  const dateFilterEnabled = Boolean(draftDateField);
  const dateFilterActive = isToolbarDateFilterActive({ dateField, dateFrom, dateTo });
  const dateFilterDraftPending =
    Boolean(draftDateField) && !dateFilterActive && Boolean(draftDateFrom || draftDateTo);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    const isDefaultLeadType = leadType === "all";
    if (!isDefaultLeadType) c += 1;
    /** Exec roles get assignee forced to self in the parent for API scoping; not a user-applied filter (Assignee UI is hidden). */
    const assigneeIsUserFilter =
      assignee.trim().length > 0 && !isSalesExecutive && !isPresalesExecutive;
    if (assigneeIsUserFilter) c += 1;
    if (milestoneStage) c += 1;
    if (milestoneStageCategory) c += 1;
    if (milestoneSubStage) c += 1;
    if (salesAdminFilter) c += 1;
    if (salesManagerFilter) c += 1;
    if (salesExecFilter) c += 1;
    if (isPresalesWorkspace && showPresalesHierarchyFilters && presalesManagerFilter) c += 1;
    if (isPresalesWorkspace && showPresalesHierarchyFilters && presalesExecFilter) c += 1;
    if (dateFilterActive) c += 1;
    if (isPresalesWorkspace && reinquiry) c += 1;
    return c;
  }, [
    assignee,
    authRole,
    dateFrom,
    dateTo,
    dateFilterActive,
    leadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    presalesExecFilter,
    presalesManagerFilter,
    isPresalesWorkspace,
    isSalesWorkspace,
    salesAdminFilter,
    salesExecFilter,
    salesManagerFilter,
    reinquiry,
    viewerRole,
  ]);

  const resetFilter = () => {
    if (onResetAll) {
      onResetAll();
      return;
    }
    setDraftDateFrom("");
    setDraftDateTo("");
    setDraftDateField("");
    onLeadTypeChange("all");
    onAssigneeChange("");
    onMilestoneStageChange("");
    onMilestoneStageCategoryChange("");
    onMilestoneSubStageChange("");
    onSalesAdminFilterChange("");
    onSalesManagerFilterChange("");
    onSalesExecFilterChange("");
    onPresalesManagerFilterChange("");
    onPresalesExecFilterChange("");
    onDateFromChange("");
    onDateToChange("");
    onDateFieldChange("");
    onReinquiryChange("");
    onResetPresalesSummary?.();
  };

  const resetSort = () => {
    if (onResetAll) {
      onResetAll();
      return;
    }
    onSortChange("updatedAt,desc");
  };

  const resetLeadTypesPanel = () => {
    resetFilter();
    setLeadTypeCountPool(defaultLeadTypeCountPool(leadsWorkspace));
  };

  /** Same reset as reload / Reset, then apply the clicked source tile. */
  const applyLeadTypeTileFilter = (leadTypeFilterKey: string) => {
    resetFilter();
    onLeadTypeChange(leadTypeFilterKey);
  };

  return (
    <section className={`${LEADS_PAGE_CONTAINER_CLASS} mt-4`}>
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3 shadow-[var(--crm-shadow-sm)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenFilter((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                openFilter || activeFilterCount > 0
                  ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]"
                  : "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
              }`}
            >
              <FilterIcon />
              <span>Filter</span>
              <span className="rounded-full bg-[var(--crm-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--crm-text-secondary)] ring-1 ring-[var(--crm-border)]">
                {activeFilterCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setOpenSort((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                openSort
                  ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]"
                  : "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
              }`}
            >
              <SortIcon />
              <span>Sort</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenLeadTypes((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                openLeadTypes
                  ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]"
                  : "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
              }`}
            >
              <span className="text-[13px]">#</span>
              <span>Lead Types</span>
            </button>
            {hideTotalLeadsPill ? null : isSuperAdmin &&
            (superAdminCrossPoolSearchActive || superAdminSearchPoolTotals) ? (
              <>
                <Pill
                  label="Sales"
                  value={
                    loading || !superAdminSearchPoolTotals
                      ? "—"
                      : superAdminSearchPoolTotals.sales.toLocaleString()
                  }
                  active
                />
                <Pill
                  label="Presales"
                  value={
                    loading || !superAdminSearchPoolTotals
                      ? "—"
                      : superAdminSearchPoolTotals.presales.toLocaleString()
                  }
                  active
                />
              </>
            ) : (
              <Pill
                label="Total Leads"
                value={
                  loading
                    ? "—"
                    : totalLeadsPillLabel ??
                      (totalLeadsPillPrimary === undefined
                        ? "—"
                        : totalLeadsPillPrimary.toLocaleString())
                }
                secondaryValue={
                  showAdminCustomersRowsPill || loading || totalLeadsPillSecondary === undefined
                    ? undefined
                    : totalLeadsPillSecondary.toLocaleString()
                }
                secondaryTitle={totalLeadsSecondaryTitle}
                active
              />
            )}
            {showDeleteAllButton ? (
              <button
                type="button"
                disabled={deleteAllDisabled}
                onClick={onDeleteAllClick}
                className="inline-flex items-center rounded-full bg-[#dc2626] px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b91c1c] hover:shadow-[0_8px_16px_rgba(220,38,38,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteAllLabel}
              </button>
            ) : null}
          </div>
        </div>

        {openLeadTypes ? (
          <div className="mt-3 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--crm-text-primary)]">Lead Types</div>
                  {isSalesAdmin ? (
                    <p className="mt-0.5 text-[11px] font-normal text-[var(--crm-text-muted)]">
                      Follow-up and overdue tiles count unique customers (one per phone), not the sum of each
                      sales manager&apos;s team.
                    </p>
                  ) : null}
                </div>
                {showLeadTypePoolToggle ? (
                  <div
                    className="inline-flex shrink-0 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-0.5"
                    role="group"
                    aria-label="Lead type count pool"
                  >
                    {(
                      [
                        ["sales", "Sales"],
                        ["presales", "Presales"],
                        ["total", "Total"],
                      ] as const
                    ).map(([pool, label]) => (
                      <button
                        key={pool}
                        type="button"
                        onClick={() => setLeadTypeCountPool(pool)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          leadTypeCountPool === pool
                            ? "bg-[var(--crm-surface)] text-[var(--crm-accent)] shadow-sm ring-1 ring-[var(--crm-accent-ring)]"
                            : "text-[var(--crm-text-secondary)] hover:text-[var(--crm-text-primary)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={resetLeadTypesPanel}
                  className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--crm-text-secondary)] transition-colors hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface-subtle)]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setOpenLeadTypes(false)}
                  className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {(isSalesExecutive
                ? [
                    ["My Assigned Leads", leadTypeCounts.all ?? 0],
                    ["Leads for Month", leadTypeCounts.all ?? 0],
                    [callsTileLabel, callsTileValue],
                    ["Today's Lead Followup", leadTypeCounts.followupsActive ?? 0],
                    ["Today's Opportunity Followup", leadTypeCounts.followupsClosure ?? 0],
                    ["Lead Overdue", leadTypeCounts.overdueActive ?? 0],
                    ["Opportunity Overdue", leadTypeCounts.overdueClosure ?? 0],
                    ...meetingQuoteTiles,
                    ["Google Leads", leadTypeCounts.glead ?? 0],
                    ["Meta Leads", leadTypeCounts.mlead ?? 0],
                    ["Walk-in Leads", leadTypeCounts.walkinlead ?? 0],
                    ["WhatsApp Leads", leadTypeCounts.whatsapplead ?? 0],
                  ]
                : isSalesManager
                  ? [
                      [
                        "My Assigned Leads",
                        leadTypeCounts.managerMine ?? leadTypeCounts.all ?? 0,
                      ],
                      ["Team Leads", leadTypeCounts.team ?? 0],
                      [callsTileLabel, callsTileValue],
                      ["Today's Lead Followup", leadTypeCounts.followupsActive ?? 0],
                      ["Today's Opportunity Followup", leadTypeCounts.followupsClosure ?? 0],
                      ["Lead Overdue", leadTypeCounts.overdueActive ?? 0],
                      ["Opportunity Overdue", leadTypeCounts.overdueClosure ?? 0],
                      ...meetingQuoteTiles,
                      ...adminSourceLeadTypeRows,
                    ]
                  : isSalesAdmin
                    ? [
                        [callsTileLabel, callsTileValue],
                        ["Today's Lead Followup", leadTypeCounts.followupsActive ?? 0],
                        ["Today's Opportunity Followup", leadTypeCounts.followupsClosure ?? 0],
                        ["Lead Overdue", leadTypeCounts.overdueActive ?? 0],
                        ["Opportunity Overdue", leadTypeCounts.overdueClosure ?? 0],
                        ...meetingQuoteTiles,
                        ...adminSourceLeadTypeRows,
                      ]
                  : isPresalesRole(role)
                    ? [...adminSourceLeadTypeRows]
                  : [
                      [
                        isAdminPoolViewer ? "Sales pool (all assignees)" : "My Assigned Leads",
                        showLeadTypePoolToggle
                          ? adminPoolAllCount
                          : adminPoolUsesPrimaryCounts && leadTypeCountsPrimary
                            ? leadTypeCountsPrimary.all
                            : (leadTypeCounts.all ?? 0),
                      ],
                      ...adminSourceLeadTypeRows,
                    ]).map(([label, value]) => {
                const tileLabel = String(label);
                const insightKey = insightKeyForLeadTypeLabel(tileLabel);
                const isSalesPoolTile = tileLabel === "Sales pool (all assignees)";
                const sourceLeadTypeKey = sourceTileLeadTypeByLabel.get(tileLabel);
                const leadTypeFilterKey = isSalesPoolTile ? "all" : sourceLeadTypeKey;
                const leadTypeTileInteractive =
                  sourceTileClickFilters &&
                  Boolean(leadTypeFilterKey) &&
                  isAdminPoolViewer &&
                  Boolean(onLeadTypeChange);
                const interactive = Boolean(
                  (insightKey && onInsightNavigate) || leadTypeTileInteractive,
                );
                const isActive = Boolean(
                  (insightKey &&
                    (insightActive === insightKey ||
                      (insightKey === "quoteSent" && insightActive === "lostQuoteSent"))) ||
                    (leadTypeTileInteractive && leadType === leadTypeFilterKey),
                );
                const tileClass = `rounded-xl border px-3 py-4 text-center transition-colors ${
                  isActive
                    ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] ring-1 ring-[var(--crm-accent-ring)]"
                    : "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]"
                } ${interactive ? "cursor-pointer hover:bg-[var(--crm-surface)] w-full" : ""}`;
                const quoteSentTotal = Number(leadTypeCounts.quoteSent ?? value ?? 0);
                const quoteSentLost = Number(leadTypeCounts.lostQuoteSent ?? 0);
                const quoteSentWon = Math.max(0, quoteSentTotal - quoteSentLost);
                const inner =
                  tileLabel === "Quote Sent" && isActive ? (
                    <>
                      <div className="text-2xl font-extrabold leading-none text-[var(--crm-accent)]">
                        {quoteSentTotal}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[10px] font-semibold leading-tight">
                        <div className="text-emerald-700">Won {quoteSentWon}</div>
                        <div className="text-red-600">Lost {quoteSentLost}</div>
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-[var(--crm-text-secondary)]">
                        Quote Sent
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-extrabold text-[var(--crm-accent)]">{String(value)}</div>
                      <div className="mt-1 text-[12px] font-semibold text-[var(--crm-text-secondary)]">{tileLabel}</div>
                    </>
                  );
                if (interactive && insightKey) {
                  return (
                    <button
                      key={tileLabel}
                      type="button"
                      onClick={() => onInsightNavigate?.(insightKey)}
                      onDoubleClick={() => {
                        if (tileLabel === "Total Calls" || tileLabel === "First Call Delayed") {
                          const nextMode =
                            activeCallsTileMode === "totalCalls" ? "callDelayed" : "totalCalls";
                          setCallsTileMode(nextMode);
                          onInsightNavigate?.(nextMode);
                        }
                      }}
                      className={tileClass}
                    >
                      {inner}
                    </button>
                  );
                }
                if (leadTypeTileInteractive && leadTypeFilterKey) {
                  return (
                    <button
                      key={tileLabel}
                      type="button"
                      onClick={() => applyLeadTypeTileFilter(leadTypeFilterKey)}
                      className={tileClass}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div key={tileLabel} className={tileClass}>
                    {inner}
                  </div>
                );
              })}
            </div>

            {!isPresalesRole(role) ? (
              <div className="mt-4 border-t border-[var(--crm-border)] pt-4">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
                  Lost Segment
                </div>
                <p className="mb-3 text-[11px] text-[var(--crm-text-muted)]">
                  Leads on a lost path by stage. These are excluded from Lead Overdue and
                  Opportunity Overdue.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {LOST_SEGMENT_TILES.map(({ mode, label }) => {
                    const tileLabel = label;
                    const value = leadTypeCounts[mode] ?? 0;
                    const insightKey = mode;
                    const interactive = Boolean(onInsightNavigate);
                    const isActive = insightActive === insightKey;
                    const tileClass = `rounded-xl border px-3 py-4 text-center transition-colors ${
                      isActive
                        ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] ring-1 ring-[var(--crm-accent-ring)]"
                        : "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]"
                    } ${interactive ? "cursor-pointer hover:bg-[var(--crm-surface)] w-full" : ""}`;
                    const inner = (
                      <>
                        <div className="text-2xl font-extrabold text-[var(--crm-accent)]">
                          {String(value)}
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-[var(--crm-text-secondary)]">
                          {tileLabel}
                        </div>
                      </>
                    );
                    if (interactive) {
                      return (
                        <button
                          key={tileLabel}
                          type="button"
                          onClick={() => onInsightNavigate?.(insightKey)}
                          className={tileClass}
                        >
                          {inner}
                        </button>
                      );
                    }
                    return (
                      <div key={tileLabel} className={tileClass}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {openFilter ? (
          <div className="mt-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-2.5 shadow-[var(--crm-shadow-sm)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--crm-text-primary)]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]">
                  <FilterIcon />
                </span>
                <span>Filters</span>
                {dateFilterActive ? (
                  <span className="rounded-full bg-[var(--crm-accent-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--crm-accent)]">
                    Date on
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={resetFilter}
                className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--crm-text-secondary)] transition-colors hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface-subtle)]"
              >
                Reset
              </button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {isSalesWorkspace && (viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN") && (
                <FilterSelectField label="Sales Admin" value={salesAdminFilter} onChange={onSalesAdminFilterChange}>
                  <option value="">All</option>
                  {salesAdminOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FilterSelectField>
              )}
              {isSalesWorkspace && !isSalesExecutive && !isPresalesFlow ? (
                <FilterSelectField label="Sales Exec" value={salesExecFilter} onChange={onSalesExecFilterChange}>
                  <option value="">All</option>
                  {salesExecOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FilterSelectField>
              ) : null}
              {isSalesWorkspace && !isSalesManager && !isSalesExecutive && !isPresalesFlow ? (
                <>
                  <FilterSelectField label="Sales Mgr" value={salesManagerFilter} onChange={onSalesManagerFilterChange}>
                    <option value="">All</option>
                    {salesManagerOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                </>
              ) : null}
              {isPresalesWorkspace && showPresalesHierarchyFilters ? (
                <>
                  <FilterSelectField
                    label="Presales Mgr"
                    value={presalesManagerFilter}
                    onChange={(next) => {
                      onPresalesManagerFilterChange(next);
                      if (next) onPresalesExecFilterChange("");
                    }}
                  >
                    <option value="">All</option>
                    {presalesManagerOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                  <FilterSelectField
                    label="Presales Exec"
                    value={presalesExecFilter}
                    onChange={onPresalesExecFilterChange}
                  >
                    <option value="">All</option>
                    {presalesExecOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                </>
              ) : null}
              <FilterSelectField label="Lead Type" value={leadType} onChange={onLeadTypeChange}>
                {leadTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelectField>
              {isSalesWorkspace && !isSalesManager && !isSalesExecutive && !isPresalesFlow ? (
                <FilterSelectField label="Assignee" value={assignee} onChange={onAssigneeChange}>
                  <option value="">All</option>
                  {assigneeOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FilterSelectField>
              ) : null}
              {isPresalesFlow ? (
                <>
                  <FilterSelectField
                    label="Presales Stage"
                    value={milestoneStage}
                    onChange={(v) => {
                      onMilestoneStageChange(v);
                      onMilestoneStageCategoryChange("");
                      onMilestoneSubStageChange("");
                    }}
                  >
                    <option value="">All</option>
                    {milestoneStageOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                  <FilterSelectField
                    label="Presales Category"
                    value={milestoneStageCategory}
                    onChange={(v) => {
                      onMilestoneStageCategoryChange(v);
                      onMilestoneSubStageChange("");
                    }}
                    disabled={!milestoneStage.trim()}
                  >
                    <option value="">
                      {milestoneStage.trim() ? "All" : "Select stage first"}
                    </option>
                    {milestoneStageCategoryOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                  <FilterSelectField
                    label="Presales Substage"
                    value={milestoneSubStage}
                    onChange={onMilestoneSubStageChange}
                    disabled={!milestoneStage.trim() || !milestoneStageCategory.trim()}
                  >
                    <option value="">
                      {milestoneStage.trim() && milestoneStageCategory.trim()
                        ? "All"
                        : milestoneStage.trim()
                          ? "Select category first"
                          : "Select stage first"}
                    </option>
                    {milestoneSubStageOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                </>
              ) : (
                <>
                  <FilterSelectField
                    label="Stage"
                    value={milestoneStage}
                    onChange={(v) => {
                      onMilestoneStageChange(v);
                      onMilestoneStageCategoryChange("");
                      onMilestoneSubStageChange("");
                    }}
                  >
                    <option value="">All</option>
                    {milestoneStageOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                  <FilterSelectField
                    label="Category"
                    value={milestoneStageCategory}
                    onChange={(v) => {
                      onMilestoneStageCategoryChange(v);
                      onMilestoneSubStageChange("");
                    }}
                    disabled={!milestoneStage.trim() || salesNoMilestoneFilterActive}
                  >
                    <option value="">
                      {salesNoMilestoneFilterActive
                        ? "N/A for No milestone"
                        : milestoneStage.trim()
                          ? "All"
                          : "Select stage first"}
                    </option>
                    {milestoneStageCategoryOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                  <FilterSelectField
                    label="Sub Stage"
                    value={milestoneSubStage}
                    onChange={onMilestoneSubStageChange}
                    disabled={
                      salesNoMilestoneFilterActive ||
                      !milestoneStage.trim() ||
                      !milestoneStageCategory.trim()
                    }
                  >
                    <option value="">
                      {salesNoMilestoneFilterActive
                        ? "N/A for No milestone"
                        : milestoneStage.trim() && milestoneStageCategory.trim()
                          ? "All"
                          : milestoneStage.trim()
                            ? "Select category first"
                            : "Select stage first"}
                    </option>
                    {milestoneSubStageOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelectField>
                </>
              )}
              {isPresalesWorkspace ? (
                <FilterSelectField label="Reinquiry" value={reinquiry} onChange={onReinquiryChange}>
                  <option value="">All</option>
                  <option value="true">Reinquiry only</option>
                  <option value="false">Non-reinquiry only</option>
                </FilterSelectField>
              ) : null}
            </div>
            <div className="mt-2 border-t border-[var(--crm-border)] pt-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--crm-text-muted)]">
                  Date range
                </span>
                {dateFilterDraftPending ? (
                  <span className="text-[9px] font-medium text-[var(--crm-warning-text)]">
                    Set From &amp; To to apply
                  </span>
                ) : !dateFilterEnabled ? (
                  <span className="text-[9px] font-medium text-[var(--crm-text-muted)]">
                    Pick field first
                  </span>
                ) : null}
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3">
              <FilterSelectField
                label="Filter by"
                value={draftDateField}
                onChange={handleDraftDateFieldChange}
              >
                <option value="">Select date field</option>
                {dateFieldToolbarOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FilterSelectField>
              <FilterDateField
                label="From"
                value={draftDateFrom}
                disabled={!dateFilterEnabled}
                onChange={(next) => {
                  setDraftDateFrom(next);
                  commitDateRange(next, draftDateTo);
                }}
              />
              <FilterDateField
                label="To"
                value={draftDateTo}
                disabled={!dateFilterEnabled}
                onChange={(next) => {
                  setDraftDateTo(next);
                  commitDateRange(draftDateFrom, next);
                }}
              />
              </div>
            </div>
          </div>
        ) : null}

        {openSort ? (
          <div className="mt-3 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--crm-text-primary)]">
                <SortIcon />
                <span>Sort</span>
              </div>
              <button
                type="button"
                onClick={resetSort}
                className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
              >
                Reset
              </button>
            </div>
            <SelectField label="Order" value={sort} onChange={onSortChange}>
              <option value="updatedAt,desc">Updated: Newest</option>
              <option value="updatedAt,asc">Updated: Oldest</option>
              <option value="createdAt,desc">Created: Newest</option>
              <option value="createdAt,asc">Created: Oldest</option>
              <option value="followUpDate,asc">Follow-up: Soonest</option>
              <option value="followUpDate,desc">Follow-up: Latest</option>
              {!showMeetingDateToolbar ? null : (
                <>
                  <option value="meetingDate,asc">Meeting: Soonest</option>
                  <option value="meetingDate,desc">Meeting: Latest</option>
                </>
              )}
            </SelectField>
          </div>
        ) : null}
      </div>
    </section>
  );
}
