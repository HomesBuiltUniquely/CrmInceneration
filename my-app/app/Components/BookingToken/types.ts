export type BookingTokenTab = "all" | "booking" | "token" | "cancel";

export type BookingListingType = "token" | "booking" | "cancel";

export type FinanceReviewStatus =
  | "NOT_READY"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type TokenStatus = "issued" | "minting" | "pending";
export type BookingStatus = "confirmed" | "in_progress" | "cancelled" | "pending_cancellation";

export type CancellationApprovalStatus = "NONE" | "PENDING" | "REJECTED";

export type KpiCard = {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  trendUrgent?: boolean;
  barTone: "green" | "orange";
  barWidth: number;
};

export type DealRow = {
  id: string;
  leadType: string;
  leadId: number;
  leadIdentifier?: string;
  initials: string;
  customer: string;
  /** Live CRM lead assignee (sales executive on the lead). */
  assign: string;
  asset: string;
  dealValue: string;
  dealValueAmount: number;
  preBooking: string;
  paidAmount: number;
  tenPercentTarget: string;
  tenPercentAmount: number;
  remaining: string;
  /** Raw remaining toward 10% (0 = full 10% paid). */
  remainingAmount: number;
  tokenStatus: TokenStatus;
  bookingStatus: BookingStatus;
  expClosing: string;
  /** ISO timestamp when deal entered Booking & Token (Booking Done handoff). */
  submittedAt: string;
  isCancelled?: boolean;
  /** Dashboard bucket: token (partial 10%), booking (full 10%), cancel */
  listingType: BookingListingType;
  /** Show Cancellation — token bucket only, within 24h (Hub + UI). */
  showCancellation?: boolean;
  /** Pay — token bucket only. */
  showPay?: boolean;
  showConvert?: boolean;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  /** Set when row came from Booking Done handoff. */
  fromBookingDone?: boolean;
  financeReviewStatus?: FinanceReviewStatus;
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
  submittedByName?: string | null;
  submittedByRole?: string | null;
  cancellationApprovalStatus?: CancellationApprovalStatus;
  cancellationRequestedByName?: string | null;
  canApproveCancellation?: boolean;
};

export type LedgerItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "success" | "warning" | "info";
};

export type UrgentTask = {
  id: string;
  title: string;
  detail: string;
  due: string;
  tone: "danger" | "warning";
};

export type PipelineBar = {
  month: string;
  value: number;
};
