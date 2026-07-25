export type BookingTokenTab = "all" | "booking" | "token" | "cancel";

export type BookingListingType = "token" | "booking" | "cancel";

export type FinanceReviewStatus =
  | "NOT_READY"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type TokenStatus = "issued" | "minting" | "pending";
export type BookingStatus = "confirmed" | "in_progress" | "cancelled" | "pending_cancellation";

export type CancellationApprovalStatus = "NONE" | "PENDING" | "REJECTED" | "APPROVED";

/** Minimum paid to convert: full 10% or 9.9% buffer threshold met. */
export type BookingApprovalMode = "FULL_10" | "BUFFER_9_9" | "PENDING";

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
  /** Designer on linked lead (from Hub deal payload). */
  designerName: string;
  /** Business booking date (`YYYY-MM-DD`). */
  bookingDate?: string | null;
  /** When Booking Done form was saved (prefer over submittedAt for display). */
  createdAt?: string | null;
  asset: string;
  dealValue: string;
  dealValueAmount: number;
  preBooking: string;
  /** Cumulative paid toward 10% target. */
  paidAmount: number;
  /** Amount above 10% target — routed to Finance (Hub). */
  extraAmountReceived?: number;
  /** Total customer paid (10% + extra). */
  totalAmountReceived?: number;
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
  /** Hub: enable Convert when FULL_10 or BUFFER_9_9 threshold met. */
  canConvertToBooking?: boolean;
  bookingApprovalMode?: BookingApprovalMode;
  bufferThresholdAmount?: number;
  bufferApplied?: boolean;
  shortfallAmount?: number;
  financeBufferNote?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  /** Who finally cancelled (after approval or direct cancel). */
  cancelledByName?: string | null;
  cancellationRequestedAt?: string | null;
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
  /** Who approved the cancellation (Hub may omit until approved). */
  cancellationApprovedByName?: string | null;
  cancellationApprovedAt?: string | null;
  cancellationRejectReason?: string | null;
  cancellationAttemptCount?: number | null;
  cancellationLastRejectAt?: string | null;
  previousListingType?: string | null;
  previousMilestoneSubstage?: string | null;
  canApproveCancellation?: boolean;
  canRestoreBookingTokenCancellation?: boolean;
  canResubmitBookingTokenCancellation?: boolean;
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
  /** Unique period key, e.g. `2026-6` for July 2026 */
  id: string;
  month: string;
  value: number;
};
