export type BookingSubmittedByRole =
  | ""
  | "SALES_EXECUTIVE"
  | "SALES_MANAGER"
  | "SALES_ADMIN";

export type BookingDealFilterState = {
  submittedByRole: BookingSubmittedByRole;
  assignee: string;
  /** When true, sends cancellationStatus=PENDING for approval queue */
  pendingCancellationsOnly: boolean;
};

export const DEFAULT_BOOKING_DEAL_FILTERS: BookingDealFilterState = {
  submittedByRole: "",
  assignee: "",
  pendingCancellationsOnly: false,
};

export const BOOKING_SUBMITTED_BY_ROLE_OPTIONS: {
  value: BookingSubmittedByRole;
  label: string;
}[] = [
  { value: "", label: "All roles" },
  { value: "SALES_EXECUTIVE", label: "Sales Executive" },
  { value: "SALES_MANAGER", label: "Sales Manager" },
  { value: "SALES_ADMIN", label: "Sales Admin" },
];

export function isBookingDealFilterActive(filter: BookingDealFilterState): boolean {
  return (
    Boolean(filter.submittedByRole) ||
    Boolean(filter.assignee.trim()) ||
    filter.pendingCancellationsOnly
  );
}

export function bookingDealFilterSummary(filter: BookingDealFilterState): string {
  const parts: string[] = [];
  if (filter.submittedByRole) {
    const roleLabel =
      BOOKING_SUBMITTED_BY_ROLE_OPTIONS.find((o) => o.value === filter.submittedByRole)?.label ??
      filter.submittedByRole;
    parts.push(roleLabel);
  }
  if (filter.assignee.trim()) {
    parts.push(`Assignee: ${filter.assignee.trim()}`);
  }
  if (filter.pendingCancellationsOnly) {
    parts.push("Pending cancel");
  }
  return parts.length > 0 ? parts.join(" · ") : "All deals";
}

export type BookingDealFilterQueryParams = {
  submittedByRole?: string;
  assignee?: string;
  cancellationStatus?: string;
};

export function bookingDealFilterQueryParams(
  filter: BookingDealFilterState,
): BookingDealFilterQueryParams {
  const params: BookingDealFilterQueryParams = {};
  if (filter.submittedByRole) {
    params.submittedByRole = filter.submittedByRole;
  }
  const assignee = filter.assignee.trim();
  if (assignee) {
    params.assignee = assignee;
  }
  if (filter.pendingCancellationsOnly) {
    params.cancellationStatus = "PENDING";
  }
  return params;
}
