/** Hub `dateField` query param — filter toolbar dates by created / follow-up / meeting / assigned. */

import { getLocalMonthRangeIsoDates } from "@/lib/presales-heatmap-helpers";

export type CrmDateField = "created" | "followUp" | "meeting" | "assigned";

/** Toolbar selection — empty until user picks which date column to filter on. */
export type CrmDateFieldSelection = Exclude<CrmDateField, "assigned"> | "";

/** Toolbar dropdown only (presales month cards still use `assigned` via `crmMonthWindow`). */
export const CRM_DATE_FIELD_TOOLBAR_OPTIONS: { value: Exclude<CrmDateField, "assigned">; label: string }[] = [
  { value: "created", label: "Lead created" },
  { value: "followUp", label: "Follow-up date" },
  { value: "meeting", label: "Meeting date" },
];

/** Presales + field roles — follow-up + created only (no meeting milestones). */
export const CRM_DATE_FIELD_NO_MEETING_TOOLBAR_OPTIONS = CRM_DATE_FIELD_TOOLBAR_OPTIONS.filter(
  (opt) => opt.value !== "meeting",
);

/** @deprecated Use `CRM_DATE_FIELD_NO_MEETING_TOOLBAR_OPTIONS` */
export const CRM_DATE_FIELD_PRESALES_TOOLBAR_OPTIONS = CRM_DATE_FIELD_NO_MEETING_TOOLBAR_OPTIONS;

function normalizeViewerRoleKey(role: string | null | undefined): string {
  return (role ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

/** Meeting date filter is for sales managers/admins on the sales pipeline only. */
export function viewerShowsMeetingDateToolbarOption(input: {
  workspace: "sales" | "presales" | string;
  role?: string | null;
}): boolean {
  const workspace = (input.workspace ?? "").trim().toLowerCase();
  if (workspace === "presales") return false;
  const role = normalizeViewerRoleKey(input.role);
  if (role === "SALES_EXECUTIVE" || role === "PRESALES_EXECUTIVE") return false;
  return true;
}

export function crmDateFieldToolbarOptionsForViewer(input: {
  workspace: "sales" | "presales" | string;
  role?: string | null;
}): typeof CRM_DATE_FIELD_TOOLBAR_OPTIONS {
  return viewerShowsMeetingDateToolbarOption(input)
    ? CRM_DATE_FIELD_TOOLBAR_OPTIONS
    : CRM_DATE_FIELD_NO_MEETING_TOOLBAR_OPTIONS;
}

/** @deprecated Use `crmDateFieldToolbarOptionsForViewer` */
export function crmDateFieldToolbarOptionsForWorkspace(
  workspace: "sales" | "presales" | string,
): typeof CRM_DATE_FIELD_TOOLBAR_OPTIONS {
  return crmDateFieldToolbarOptionsForViewer({ workspace });
}

export function sanitizeDateFieldForViewer(
  dateField: CrmDateFieldSelection,
  workspace: "sales" | "presales" | string,
  role?: string | null,
): CrmDateFieldSelection {
  const allowed = crmDateFieldToolbarOptionsForViewer({ workspace, role });
  if (dateField && !allowed.some((o) => o.value === dateField)) return "";
  return dateField;
}

/** @deprecated Use `sanitizeDateFieldForViewer` */
export function sanitizeDateFieldForWorkspace(
  dateField: CrmDateFieldSelection,
  workspace: "sales" | "presales" | string,
): CrmDateFieldSelection {
  return sanitizeDateFieldForViewer(dateField, workspace);
}

export const CRM_DATE_FIELD_OPTIONS: { value: CrmDateField; label: string }[] = [
  ...CRM_DATE_FIELD_TOOLBAR_OPTIONS,
  { value: "assigned", label: "Assigned date" },
];

export type CrmDateFilterInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  dateField?: string | null;
  crmMonthWindow?: string | null;
  /**
   * Admin pool APIs expand `crmMonthWindow=current` to explicit dateFrom/dateTo
   * (no `crmMonthWindow` param on Hub). Default: send `crmMonthWindow=current`.
   */
  expandMonthWindow?: boolean;
};

export function parseCrmDateFieldSelection(raw: string | null | undefined): CrmDateFieldSelection {
  const s = (raw ?? "").trim();
  if (s === "created") return "created";
  if (s === "followUp" || s === "followup") return "followUp";
  if (s === "meeting") return "meeting";
  return "";
}

/** Hub/API default when `dateField` omitted — legacy created-date behavior. */
export function parseCrmDateField(raw: string | null | undefined): CrmDateField {
  const s = (raw ?? "").trim();
  if (s === "followUp" || s === "followup") return "followUp";
  if (s === "meeting") return "meeting";
  if (s === "assigned") return "assigned";
  return "created";
}

export function resolveEffectiveDateField(input: CrmDateFilterInput): CrmDateField | "" {
  if ((input.crmMonthWindow ?? "").trim().toLowerCase() === "current") {
    return "assigned";
  }
  return parseCrmDateFieldSelection(input.dateField);
}

/** Toolbar date filter active only when field picked + both From/To set (matches commitDateRange). */
export function isToolbarDateFilterActive(input: CrmDateFilterInput): boolean {
  if ((input.crmMonthWindow ?? "").trim().toLowerCase() === "current") return true;
  const selection = parseCrmDateFieldSelection(input.dateField);
  const from = (input.dateFrom ?? "").trim();
  const to = (input.dateTo ?? "").trim();
  return selection !== "" && Boolean(from && to);
}

/** True when Hub already applied date filtering — BFF must not re-filter in memory. */
export function hubHandlesDateFilter(input: CrmDateFilterInput): boolean {
  return isToolbarDateFilterActive(input);
}

export function appendCrmDateFilters(
  qs: URLSearchParams,
  input: CrmDateFilterInput,
): CrmDateField | "" {
  const monthWindow = (input.crmMonthWindow ?? "").trim().toLowerCase() === "current";
  const eff = resolveEffectiveDateField(input);

  if (monthWindow) {
    if (input.expandMonthWindow) {
      qs.delete("crmMonthWindow");
      const month = getLocalMonthRangeIsoDates();
      const from = (input.dateFrom ?? "").trim() || month.from;
      const to = (input.dateTo ?? "").trim() || month.to;
      if (from) qs.set("dateFrom", from);
      else qs.delete("dateFrom");
      if (to) qs.set("dateTo", to);
      else qs.delete("dateTo");
    } else {
      qs.set("crmMonthWindow", "current");
      qs.delete("dateFrom");
      qs.delete("dateTo");
    }
    qs.set("dateField", "assigned");
    return "assigned";
  }

  qs.delete("crmMonthWindow");

  const from = (input.dateFrom ?? "").trim();
  const to = (input.dateTo ?? "").trim();

  if (!isToolbarDateFilterActive(input)) {
    qs.delete("dateFrom");
    qs.delete("dateTo");
    qs.delete("dateField");
    return "";
  }

  if (from) qs.set("dateFrom", from);
  else qs.delete("dateFrom");
  if (to) qs.set("dateTo", to);
  else qs.delete("dateTo");

  if (eff !== "created") qs.set("dateField", eff);
  else qs.delete("dateField");

  return eff;
}

export function defaultSortForDateField(dateField: CrmDateFieldSelection): string | null {
  if (dateField === "followUp") return "followUpDate,asc";
  if (dateField === "meeting") return "meetingDate,asc";
  return null;
}

export function dateFieldFilterLabel(dateField: CrmDateField | ""): string {
  if (!dateField) return "Date";
  return CRM_DATE_FIELD_OPTIONS.find((o) => o.value === dateField)?.label ?? "Lead created";
}
