import type { CrmLeadType } from "@/lib/leads-filter";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  isClosureCancelledAfterSubstage,
  isRefundProcessedSubstage,
} from "@/lib/milestone-substage-map";

export const PROJECT_CANCELLED_AFTER_TOKEN = "Project Cancelled After Token";
export const PROJECT_CANCELLED_AFTER_BOOKING = "Project Cancelled After Booking";
export const REFUND_PROCESSED_SUBSTAGE = "Refund Processed";

export type CancellationApprovalStatus = "NONE" | "PENDING" | "REJECTED" | "APPROVED";

/** Hub `GET .../cancellation` + deal row `bt*` fields. */
export type BookingTokenLeadCancellation = {
  btCancellationDealId?: string | null;
  btCancellationListingType?: string | null;
  btPreviousMilestoneSubstage?: string | null;
  btCancellationAttemptCount?: number | null;
  btCancellationRequestedAt?: string | null;
  btCancellationLastRejectAt?: string | null;
  btCancellationApprovalStatus?: CancellationApprovalStatus | string | null;
  btCancellationReason?: string | null;
  btCancellationRejectReason?: string | null;
  canRestoreBookingTokenCancellation?: boolean;
  canResubmitBookingTokenCancellation?: boolean;
};

export type CancellationActionVisibility = {
  showBar: boolean;
  showView: boolean;
  showRestore: boolean;
  showSendAgain: boolean;
};

function parseApiError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const msg =
      (typeof parsed.userMessage === "string" && parsed.userMessage.trim()) ||
      (typeof parsed.error === "string" && parsed.error.trim()) ||
      (typeof parsed.message === "string" && parsed.message.trim());
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return fallback;
}

function cancellationPath(leadType: CrmLeadType, leadId: string): string {
  return `/api/crm/booking-token/leads/${encodeURIComponent(leadType)}/${encodeURIComponent(leadId)}/cancellation`;
}

function restorePath(leadType: CrmLeadType, leadId: string): string {
  return `${cancellationPath(leadType, leadId)}/restore`;
}

/** Load Hub cancellation state for lead detail banner. */
export async function fetchBookingTokenLeadCancellation(
  leadType: CrmLeadType,
  leadId: string,
): Promise<BookingTokenLeadCancellation | null> {
  const res = await fetch(cancellationPath(leadType, leadId), {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to load cancellation state."));
  }
  if (!text.trim()) return null;
  return JSON.parse(text) as BookingTokenLeadCancellation;
}

/** Sales withdraw cancel — Hub restores milestone + deal bucket. */
export async function restoreBookingTokenCancellation(
  leadType: CrmLeadType,
  leadId: string,
): Promise<BookingTokenLeadCancellation> {
  const res = await fetch(restorePath(leadType, leadId), {
    method: "POST",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: "{}",
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to restore booking."));
  }
  return JSON.parse(text) as BookingTokenLeadCancellation;
}

/** Prefer Hub `canRestore*` / `canResubmit*` flags over client logic. */
export function resolveCancellationActionVisibility(
  milestoneSubStage: string,
  cancellation: BookingTokenLeadCancellation | null,
): CancellationActionVisibility {
  const substage = milestoneSubStage.trim();
  const onCancelledAfter = isClosureCancelledAfterSubstage(substage);
  const onRefund = isRefundProcessedSubstage(substage);

  if (onRefund || (!onCancelledAfter && !cancellation?.btCancellationApprovalStatus)) {
    return { showBar: false, showView: false, showRestore: false, showSendAgain: false };
  }

  const approval = (
    cancellation?.btCancellationApprovalStatus?.trim().toUpperCase() ?? "PENDING"
  ) as CancellationApprovalStatus;

  const showBar = onCancelledAfter || approval === "PENDING" || approval === "REJECTED";

  return {
    showBar,
    showView: showBar,
    showRestore: Boolean(cancellation?.canRestoreBookingTokenCancellation),
    showSendAgain: Boolean(cancellation?.canResubmitBookingTokenCancellation),
  };
}

/** Remove interim FE storage keys replaced by Hub (safe no-op if absent). */
export function clearLegacyBookingTokenStorage(leadType?: CrmLeadType, leadId?: string): void {
  if (typeof window === "undefined") return;
  const prefixes = ["crm-bt-cancellation:", "crm-bt-activity:"];
  if (leadType && leadId) {
    for (const prefix of prefixes) {
      window.localStorage.removeItem(`${prefix}${leadType}:${leadId}`);
    }
    return;
  }
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (prefixes.some((p) => key.startsWith(p))) toRemove.push(key);
  }
  for (const key of toRemove) window.localStorage.removeItem(key);
}
