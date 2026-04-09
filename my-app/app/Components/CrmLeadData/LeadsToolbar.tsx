import { useMemo, useState, type ReactNode } from "react";

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
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span>{label}</span>
      {value !== undefined ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          {value}
        </span>
      ) : null}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 5v14m0 0-3-3m3 3 3-3M17 19V5m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 text-slate-500"
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
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-slate-300">
      <span className="whitespace-nowrap text-[12px] font-semibold text-slate-600">{label}</span>
      <div className="relative min-w-0 flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-transparent pr-6 text-[12px] font-semibold text-slate-800 focus:outline-none"
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
  viewerRole?: string;
  leadType: string;
  sort: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
  milestoneStage: string;
  milestoneStageCategory: string;
  milestoneSubStage: string;
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
  milestoneStageOptions: string[];
  milestoneStageCategoryOptions: string[];
  milestoneSubStageOptions: string[];
  onLeadTypeChange: (next: string) => void;
  onSortChange: (next: string) => void;
  onAssigneeChange: (next: string) => void;
  onDateFromChange: (next: string) => void;
  onDateToChange: (next: string) => void;
  onMilestoneStageChange: (next: string) => void;
  onMilestoneStageCategoryChange: (next: string) => void;
  onMilestoneSubStageChange: (next: string) => void;
  onSalesAdminFilterChange: (next: string) => void;
  onSalesManagerFilterChange: (next: string) => void;
  onSalesExecFilterChange: (next: string) => void;
  onPresalesManagerFilterChange: (next: string) => void;
  onPresalesExecFilterChange: (next: string) => void;
};

export default function LeadsToolbar({
  totalCount,
  rangeStart,
  rangeEnd,
  loading,
  leadTypeCounts = {},
  viewerRole = "",
  leadType,
  sort,
  assignee,
  dateFrom,
  dateTo,
  milestoneStage,
  milestoneStageCategory,
  milestoneSubStage,
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
  milestoneStageOptions,
  milestoneStageCategoryOptions,
  milestoneSubStageOptions,
  onLeadTypeChange,
  onSortChange,
  onAssigneeChange,
  onDateFromChange,
  onDateToChange,
  onMilestoneStageChange,
  onMilestoneStageCategoryChange,
  onMilestoneSubStageChange,
  onSalesAdminFilterChange,
  onSalesManagerFilterChange,
  onSalesExecFilterChange,
  onPresalesManagerFilterChange,
  onPresalesExecFilterChange,
}: LeadsToolbarProps) {
  const countLabel =
    loading || totalCount === undefined ? "—" : totalCount.toLocaleString();
  const [openFilter, setOpenFilter] = useState(false);
  const [openSort, setOpenSort] = useState(false);
  const [openLeadTypes, setOpenLeadTypes] = useState(false);
  const role = viewerRole.toUpperCase();
  const isSalesManager = role === "SALES_MANAGER";
  const isSalesExecutive = role === "SALES_EXECUTIVE";
  const isPresalesManager = role === "PRESALES_MANAGER";
  const isPresalesExecutive = role === "PRESALES_EXECUTIVE";
  const isPresalesFlow = isPresalesManager || isPresalesExecutive;
  const commonLeadTypeOptions = [
    { value: "all", label: "All Types" },
    { value: "addlead", label: "Add Lead" },
    { value: "formlead", label: "Form Lead" },
    { value: "glead", label: "Google Leads" },
    { value: "mlead", label: "Meta Leads" },
    { value: "websitelead", label: "Website Lead" },
    ...(isSalesExecutive ? [{ value: "verified", label: "Verified Leads" }] : []),
  ];

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (leadType !== "all") c += 1;
    if (assignee) c += 1;
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
    return c;
  }, [
    assignee,
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
  };

  const resetSort = () => {
    onSortChange("updatedAt,desc");
  };

  return (
    <section className="mx-auto mt-4 max-w-[1200px] px-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenFilter((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                openFilter || activeFilterCount > 0
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <FilterIcon />
              <span>Filter</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                {activeFilterCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setOpenSort((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                openSort
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-[13px]">#</span>
              <span>Lead Types</span>
            </button>
            <Pill label="Total Leads" value={countLabel} active />
          </div>
        </div>

        {openLeadTypes ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold text-slate-700">Lead Types</div>
              <button
                type="button"
                onClick={() => setOpenLeadTypes(false)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {(isSalesExecutive
                ? [
                    ["My Assigned Leads", leadTypeCounts.all ?? 0],
                    ["Leads for Month", leadTypeCounts.all ?? 0],
                    ["Followup Date", leadTypeCounts.followup ?? 0],
                    ["Overdue Leads", leadTypeCounts.overdue ?? 0],
                    ["Google Leads", leadTypeCounts.glead ?? 0],
                    ["Meta Leads", leadTypeCounts.mlead ?? 0],
                    ["Verified Leads", leadTypeCounts.verified ?? 0],
                  ]
                : isSalesManager
                  ? [
                      ["My Assigned Leads", leadTypeCounts.all ?? 0],
                      ["Team Leads", leadTypeCounts.team ?? 0],
                      ["Follow Ups Today", leadTypeCounts.followups ?? 0],
                      ["External Leads", leadTypeCounts.formlead ?? 0],
                      ["Google Ads", leadTypeCounts.glead ?? 0],
                      ["Meta Ads", leadTypeCounts.mlead ?? 0],
                      ["Add Leads", leadTypeCounts.addlead ?? 0],
                      ["Website Leads", leadTypeCounts.websitelead ?? 0],
                    ]
                  : isPresalesFlow
                    ? [
                        ["My Assigned Leads", leadTypeCounts.all ?? 0],
                        ["External Leads", leadTypeCounts.formlead ?? 0],
                        ["Google Leads", leadTypeCounts.glead ?? 0],
                        ["Meta Leads", leadTypeCounts.mlead ?? 0],
                        ["Add Leads", leadTypeCounts.addlead ?? 0],
                        ["Website Leads", leadTypeCounts.websitelead ?? 0],
                      ]
                  : [
                      ["My Assigned Leads", leadTypeCounts.all ?? 0],
                      ["External Leads", leadTypeCounts.formlead ?? 0],
                      ["Google Ads", leadTypeCounts.glead ?? 0],
                      ["Meta Ads", leadTypeCounts.mlead ?? 0],
                      ["Add Leads", leadTypeCounts.addlead ?? 0],
                      ["Website Leads", leadTypeCounts.websitelead ?? 0],
                    ]).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center">
                  <div className="text-2xl font-extrabold text-blue-600">{String(value)}</div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-600">{label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {openFilter ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                <FilterIcon />
                <span>Filter</span>
              </div>
              <button
                type="button"
                onClick={resetFilter}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
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
              <SelectField label="Lead Type" value={leadType} onChange={onLeadTypeChange}>
                {commonLeadTypeOptions.map((option) => (
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
              <SelectField label="Stage" value={milestoneStage} onChange={onMilestoneStageChange}>
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
                onChange={onMilestoneStageCategoryChange}
              >
                <option value="">All</option>
                {milestoneStageCategoryOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Sub Stage" value={milestoneSubStage} onChange={onMilestoneSubStageChange}>
                <option value="">All</option>
                {milestoneSubStageOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </SelectField>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-slate-300">
                <span className="whitespace-nowrap text-[12px] font-semibold text-slate-600">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="w-full bg-transparent text-[12px] font-semibold text-slate-800 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-slate-300">
                <span className="whitespace-nowrap text-[12px] font-semibold text-slate-600">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="w-full bg-transparent text-[12px] font-semibold text-slate-800 focus:outline-none"
                />
              </label>
            </div>
          </div>
        ) : null}

        {openSort ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                <SortIcon />
                <span>Sort</span>
              </div>
              <button
                type="button"
                onClick={resetSort}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
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
