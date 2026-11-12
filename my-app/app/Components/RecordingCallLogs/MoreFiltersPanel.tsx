"use client";

import { cn } from "@/lib/cn";
import {
  hubActiveFilterCount,
  hubFilterVisibilityForRole,
  leadTypeOptionsForRole,
  REINQUIRY_OPTIONS,
  sortOptionsForRole,
} from "@/lib/recording-call-logs/filters";
import type {
  RecordingCallLogsFilterOptions,
  SummaryFiltersState,
  SummaryHubFilters,
} from "@/lib/recording-call-logs/types";
import { EMPTY_HUB_FILTERS } from "@/lib/recording-call-logs/types";

type Props = {
  open: boolean;
  role: string;
  value: SummaryFiltersState;
  options: RecordingCallLogsFilterOptions;
  loadingOptions?: boolean;
  onChange: (next: SummaryFiltersState) => void;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
};

function FieldSelect({
  label,
  value,
  options,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  hint: string;
  onChange: (next: string) => void;
}) {
  const active = Boolean(value);
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
          active ? "text-[#1D4ED8]" : "text-[#8A94A6]",
        )}
      >
        {label}
        {active ? (
          <span className="inline-flex items-center rounded-full bg-[#DBEAFE] px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-[#1D4ED8]">
            Applied
          </span>
        ) : null}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-xl border px-3 pr-9 text-[13px] font-semibold outline-none transition focus:ring-2",
            active
              ? "border-[#93B4F5] bg-[#EFF6FF] text-[#1E3A8A] focus:border-[#2563EB] focus:ring-[#2563EB]/20"
              : "border-[#E6EAF0] bg-white text-[#14171F] focus:border-[#93B4F5] focus:ring-[#2563EB]/15",
          )}
        >
          <option value="">{hint}</option>
          {options.map((opt) => (
            <option key={`${opt.value}-${opt.label}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 right-3 flex items-center",
            active ? "text-[#1D4ED8]" : "text-[#8A94A6]",
          )}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </label>
  );
}

export default function MoreFiltersPanel({
  open,
  role,
  value,
  options,
  loadingOptions,
  onChange,
  onClose,
  onApply,
  onReset,
}: Props) {
  if (!open) return null;

  const visibility = hubFilterVisibilityForRole(role, "sales");
  const leadTypes = leadTypeOptionsForRole(role);
  const sortOptions = sortOptionsForRole(role);
  const active = hubActiveFilterCount(value.hub) + (value.leadTypeKey ? 1 : 0) +
    (value.sortKey !== "updatedAt,desc" ? 1 : 0);

  const patchHub = (patch: Partial<SummaryHubFilters>) => {
    onChange({ ...value, hub: { ...value.hub, ...patch } });
  };

  const selectedManager = options.salesManagers.find(
    (m) => m.value === value.hub.salesManager,
  );
  const execOptions = value.hub.salesManager
    ? options.salesExecutives.filter((e) => {
        if (selectedManager?.userId != null && e.managerId != null) {
          return e.managerId === selectedManager.userId;
        }
        if (e.managerName) {
          return e.managerName.toLowerCase() === value.hub.salesManager.toLowerCase();
        }
        return true;
      })
    : options.salesExecutives;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E6EAF0] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#14171F]">More filters</h2>
            <p className="mt-0.5 text-[12px] text-[#8A94A6]">
              {active > 0 ? `${active} active` : "Role-based filters"} · same as mobile Summary
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5B6778] hover:bg-[#F1F5F9]"
            aria-label="Close filters"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingOptions ? (
            <p className="py-8 text-center text-[13px] font-medium text-[#8A94A6]">
              Loading filter options…
            </p>
          ) : (
            <div className="space-y-4">
              {visibility.branch ? (
                <FieldSelect
                  label="Branch"
                  value={value.hub.branch}
                  hint="All branches"
                  options={options.branches}
                  onChange={(branch) =>
                    patchHub({
                      branch,
                      salesManager: "",
                      salesExecutive: "",
                      salesExecutiveUserId: null,
                    })
                  }
                />
              ) : null}

              {visibility.salesAdmin ? (
                <FieldSelect
                  label="Sales Admin"
                  value={value.hub.salesAdmin}
                  hint="All"
                  options={options.salesAdmins.length ? options.salesAdmins : options.salesManagers}
                  onChange={(salesAdmin) => patchHub({ salesAdmin })}
                />
              ) : null}

              {visibility.salesManager ? (
                <FieldSelect
                  label="Sales Mgr"
                  value={value.hub.salesManager}
                  hint="All"
                  options={options.salesManagers}
                  onChange={(salesManager) =>
                    patchHub({
                      salesManager,
                      salesExecutive: "",
                      salesExecutiveUserId: null,
                    })
                  }
                />
              ) : null}

              {visibility.salesExecutive ? (
                <FieldSelect
                  label={role.toUpperCase().includes("PRESALES") ? "Presales Exec" : "Sales Exec"}
                  value={value.hub.salesExecutive}
                  hint="All"
                  options={execOptions}
                  onChange={(salesExecutive) => {
                    const match = execOptions.find((o) => o.value === salesExecutive);
                    patchHub({
                      salesExecutive,
                      salesExecutiveUserId: match?.userId ?? null,
                    });
                  }}
                />
              ) : null}

              {visibility.presalesManager ? (
                <FieldSelect
                  label="Presales Mgr"
                  value={value.hub.presalesManager}
                  hint="All"
                  options={options.presalesManagers}
                  onChange={(presalesManager) =>
                    patchHub({
                      presalesManager,
                      presalesExecutive: "",
                    })
                  }
                />
              ) : null}

              {visibility.presalesExecutive ? (
                <FieldSelect
                  label="Presales Exec"
                  value={value.hub.presalesExecutive}
                  hint="All"
                  options={
                    options.presalesExecutives.length
                      ? options.presalesExecutives
                      : options.salesExecutives
                  }
                  onChange={(presalesExecutive) => patchHub({ presalesExecutive })}
                />
              ) : null}

              {visibility.assignee ? (
                <FieldSelect
                  label="Assignee"
                  value={value.hub.assignee}
                  hint="All"
                  options={options.assignees}
                  onChange={(assignee) => patchHub({ assignee })}
                />
              ) : null}

              {visibility.leadType ? (
                <FieldSelect
                  label="Lead type"
                  value={value.leadTypeKey}
                  hint="All Types"
                  options={leadTypes}
                  onChange={(leadTypeKey) => onChange({ ...value, leadTypeKey })}
                />
              ) : null}

              {visibility.reinquiry ? (
                <FieldSelect
                  label="Reinquiry"
                  value={value.hub.reinquiry}
                  hint="All"
                  options={REINQUIRY_OPTIONS.filter((o) => o.value)}
                  onChange={(reinquiry) => patchHub({ reinquiry })}
                />
              ) : null}

              {visibility.sort ? (
                <div
                  className={cn(
                    "rounded-xl border p-3",
                    value.sortKey !== "updatedAt,desc"
                      ? "border-[#93B4F5] bg-[#EFF6FF]"
                      : "border-[#E6EAF0] bg-[#F8FAFC]",
                  )}
                >
                  <label className="flex flex-col gap-1.5">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
                        value.sortKey !== "updatedAt,desc"
                          ? "text-[#1D4ED8]"
                          : "text-[#8A94A6]",
                      )}
                    >
                      Sort
                      {value.sortKey !== "updatedAt,desc" ? (
                        <span className="inline-flex items-center rounded-full bg-[#DBEAFE] px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-[#1D4ED8]">
                          Applied
                        </span>
                      ) : null}
                    </span>
                    <div className="relative">
                      <select
                        value={value.sortKey}
                        onChange={(e) =>
                          onChange({ ...value, sortKey: e.target.value })
                        }
                        className={cn(
                          "h-10 w-full appearance-none rounded-xl border px-3 pr-9 text-[13px] font-semibold outline-none transition focus:ring-2",
                          value.sortKey !== "updatedAt,desc"
                            ? "border-[#93B4F5] bg-white text-[#1E3A8A] focus:border-[#2563EB] focus:ring-[#2563EB]/20"
                            : "border-[#E6EAF0] bg-white text-[#14171F] focus:border-[#93B4F5] focus:ring-[#2563EB]/15",
                        )}
                      >
                        {sortOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-y-0 right-3 flex items-center",
                          value.sortKey !== "updatedAt,desc"
                            ? "text-[#1D4ED8]"
                            : "text-[#8A94A6]",
                        )}
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                          <path
                            d="M5 7.5L10 12.5L15 7.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[#E6EAF0] px-5 py-4">
          <button
            type="button"
            onClick={() => {
              onChange({
                ...value,
                leadTypeKey: "",
                sortKey: "updatedAt,desc",
                hub: { ...EMPTY_HUB_FILTERS },
              });
              onReset();
            }}
            className="h-10 flex-1 rounded-xl border border-[#E6EAF0] bg-white text-[13px] font-semibold text-[#5B6778] hover:bg-[#F8FAFC]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onApply}
            className={cn(
              "h-10 flex-[1.4] rounded-xl bg-[#1D4ED8] text-[13px] font-semibold text-white",
              "hover:bg-[#1E40AF]",
            )}
          >
            Apply filters
          </button>
        </div>
      </aside>
    </div>
  );
}
