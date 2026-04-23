import { useMemo, useState, type ReactNode } from "react";
import { getLeadTypeFilterOptions, isPresalesRole } from "@/lib/crm-role-access";
import {
  milestoneCategoryOptionsForStage,
  milestoneStageOptionsFromNested,
  milestoneSubStageOptionsForCategory,
} from "@/lib/milestone-filter-tree";
import type { CrmNestedStage } from "@/types/crm-pipeline";
import type { InsightTableMode } from "@/lib/lead-follow-up-insights";
import { normalizeRole } from "@/lib/auth/api";

function Pill({
  label,
  value,
  active,
}: {
  label: string;
  value?: number | string;
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
  /** When set (e.g. from `Header`), used for badge / role checks on first paint so exec assignee scoping is not counted as a filter. */
  authRole?: string;
  viewerRole?: string;
  leadType: string;
  sort: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
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
};

export default function LeadsToolbar({
  totalCount,
  rangeStart,
  rangeEnd,
  loading,
  leadTypeCounts = {},
  authRole = "",
  viewerRole = "",
  leadType,
  sort,
  assignee,
  dateFrom,
  dateTo,
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
}: LeadsToolbarProps) {
  const countLabel =
    loading || totalCount === undefined ? "—" : totalCount.toLocaleString();
  const [openFilter, setOpenFilter] = useState(false);
  const [openSort, setOpenSort] = useState(false);
  const [openLeadTypes, setOpenLeadTypes] = useState(false);
  const role = normalizeRole(authRole || viewerRole);
  const isSalesManager = role === "SALES_MANAGER";
  const isSalesExecutive = role === "SALES_EXECUTIVE";
  const isPresalesManager = role === "PRESALES_MANAGER";
  const isPresalesExecutive = role === "PRESALES_EXECUTIVE" || role === "PRE_SALES";
  const isPresalesFlow = isPresalesManager || isPresalesExecutive;
  const leadTypeOptions = getLeadTypeFilterOptions(role, isSalesExecutive);

  const milestoneStageOptions = useMemo(
    () => milestoneStageOptionsFromNested(pipelineNested),
    [pipelineNested],
  );
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
    if (presalesManagerFilter) c += 1;
    if (presalesExecFilter) c += 1;
    if (dateFrom) c += 1;
    if (dateTo) c += 1;
    if (reinquiry) c += 1;
    return c;
  }, [
    assignee,
    authRole,
    dateFrom,
    dateTo,
    leadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    presalesExecFilter,
    presalesManagerFilter,
    salesAdminFilter,
    salesExecFilter,
    salesManagerFilter,
    reinquiry,
    viewerRole,
  ]);

  const resetFilter = () => {
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
    onReinquiryChange("");
  };

  const resetSort = () => {
    onSortChange("updatedAt,desc");
  };

  return (
    <section className="mx-auto mt-4 max-w-[1200px] px-6">
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
            <Pill label="Total Leads" value={countLabel} active />
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
              <div className="text-[13px] font-semibold text-[var(--crm-text-primary)]">Lead Types</div>
              <button
                type="button"
                onClick={() => setOpenLeadTypes(false)}
                className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
              >
                Close
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {(isSalesExecutive
                ? [
                    ["My Assigned Leads", leadTypeCounts.all ?? 0],
                    ["Leads for Month", leadTypeCounts.all ?? 0],
                    ["Today's Lead", leadTypeCounts.followupsActive ?? 0],
                    ["Today's Opportunity", leadTypeCounts.followupsClosure ?? 0],
                    ["Lead Overdue", leadTypeCounts.overdueActive ?? 0],
                    ["Opportunity Overdue", leadTypeCounts.overdueClosure ?? 0],
                    ["Google Leads", leadTypeCounts.glead ?? 0],
                    ["Meta Leads", leadTypeCounts.mlead ?? 0],
                  ]
                : isSalesManager
                  ? [
                      [
                        "My Assigned Leads",
                        leadTypeCounts.managerMine ?? leadTypeCounts.all ?? 0,
                      ],
                      ["Team Leads", leadTypeCounts.team ?? 0],
                      ["Today's Lead", leadTypeCounts.followupsActive ?? 0],
                      ["Today's Opportunity", leadTypeCounts.followupsClosure ?? 0],
                      ["Lead Overdue", leadTypeCounts.overdueActive ?? 0],
                      ["Opportunity Overdue", leadTypeCounts.overdueClosure ?? 0],
                      ["External Lead", leadTypeCounts.formlead ?? 0],
                      ["Google Ads", leadTypeCounts.glead ?? 0],
                      ["Meta Ads", leadTypeCounts.mlead ?? 0],
                      ["Add Lead", leadTypeCounts.addlead ?? 0],
                      ["Website Lead", leadTypeCounts.websitelead ?? 0],
                    ]
                  : isPresalesRole(role)
                    ? [
                        ["External Lead", leadTypeCounts.formlead ?? 0],
                        ["Add Lead", leadTypeCounts.addlead ?? 0],
                        ["Website Lead", leadTypeCounts.websitelead ?? 0],
                      ]
                  : [
                      ["My Assigned Leads", leadTypeCounts.all ?? 0],
                      ["External Lead", leadTypeCounts.formlead ?? 0],
                      ["Google Ads", leadTypeCounts.glead ?? 0],
                      ["Meta Ads", leadTypeCounts.mlead ?? 0],
                      ["Add Lead", leadTypeCounts.addlead ?? 0],
                      ["Website Lead", leadTypeCounts.websitelead ?? 0],
                    ]).map(([label, value]) => {
                const insightKey: Exclude<InsightTableMode, null> | null =
                  label === "Today's Lead"
                    ? "followUpActive"
                    : label === "Today's Opportunity"
                      ? "followUpClosure"
                      : label === "Lead Overdue"
                        ? "overdueActive"
                        : label === "Opportunity Overdue"
                          ? "overdueClosure"
                        : label === "Team Leads"
                          ? "teamLeads"
                          : null;
                const interactive = Boolean(insightKey && onInsightNavigate);
                const isActive = Boolean(insightKey && insightActive === insightKey);
                const tileClass = `rounded-xl border px-3 py-4 text-center transition-colors ${
                  isActive
                    ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] ring-1 ring-[var(--crm-accent-ring)]"
                    : "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]"
                } ${interactive ? "cursor-pointer hover:bg-[var(--crm-surface)] w-full" : ""}`;
                const inner = (
                  <>
                    <div className="text-2xl font-extrabold text-[var(--crm-accent)]">{String(value)}</div>
                    <div className="mt-1 text-[12px] font-semibold text-[var(--crm-text-secondary)]">{label}</div>
                  </>
                );
                if (interactive && insightKey) {
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onInsightNavigate?.(insightKey)}
                      className={tileClass}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div key={label} className={tileClass}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {openFilter ? (
          <div className="mt-3 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--crm-text-primary)]">
                <FilterIcon />
                <span>Filter</span>
              </div>
              <button
                type="button"
                onClick={resetFilter}
                className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
              >
                Reset
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN") && (
                <SelectField label="Sales Admin" value={salesAdminFilter} onChange={onSalesAdminFilterChange}>
                  <option value="">All</option>
                  {salesAdminOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </SelectField>
              )}
              {!isSalesExecutive && !isPresalesFlow ? (
                <SelectField label="Sales Exec" value={salesExecFilter} onChange={onSalesExecFilterChange}>
                  <option value="">All</option>
                  {salesExecOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              {!isSalesManager && !isSalesExecutive && !isPresalesFlow ? (
                <>
                  <SelectField label="Sales Mgr" value={salesManagerFilter} onChange={onSalesManagerFilterChange}>
                    <option value="">All</option>
                    {salesManagerOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Presales Mgr"
                    value={presalesManagerFilter}
                    onChange={onPresalesManagerFilterChange}
                  >
                    <option value="">All</option>
                    {presalesManagerOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
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
                  </SelectField>
                </>
              ) : null}
              {isPresalesManager ? (
                <SelectField
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
                </SelectField>
              ) : null}
              <SelectField label="Lead Type" value={leadType} onChange={onLeadTypeChange}>
                {leadTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              {!isSalesManager && !isSalesExecutive && !isPresalesFlow ? (
                <SelectField label="Assignee" value={assignee} onChange={onAssigneeChange}>
                  <option value="">All</option>
                  {assigneeOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              <SelectField
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
              </SelectField>
              <SelectField
                label="Category"
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
              </SelectField>
              <SelectField
                label="Sub Stage"
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
              </SelectField>
              <SelectField label="Reinquiry" value={reinquiry} onChange={onReinquiryChange}>
                <option value="">All</option>
                <option value="true">Reinquiry only</option>
                <option value="false">Non-reinquiry only</option>
              </SelectField>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 transition-colors hover:border-[var(--crm-border-strong)]">
                <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--crm-text-secondary)]">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="w-full bg-transparent text-[12px] font-semibold text-[var(--crm-text-primary)] focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 transition-colors hover:border-[var(--crm-border-strong)]">
                <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--crm-text-secondary)]">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="w-full bg-transparent text-[12px] font-semibold text-[var(--crm-text-primary)] focus:outline-none"
                />
              </label>
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
            </SelectField>
          </div>
        ) : null}
      </div>
    </section>
  );
}
