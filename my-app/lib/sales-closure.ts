import type { Lead } from "@/lib/data";

export const SALES_CLOSURE_ORIGIN = "https://design.hubinterior.com";

/** §12 Sales Closure — external flow (opens in new tab). */
export function buildSalesClosureUrl(params: {
  leadId: string;
  leadTypeLabel: string;
  /** Current CRM URL so Hub can send the user back. */
  returnUrl?: string;
}): string {
  const u = new URL(`${SALES_CLOSURE_ORIGIN}/SalesClosure`);
  u.searchParams.set("leadId", params.leadId);
  u.searchParams.set("leadType", params.leadTypeLabel);
  if (params.returnUrl?.trim()) {
    u.searchParams.set("returnUrl", params.returnUrl.trim());
  }
  return u.toString();
}

/**
 * Show Sales Closure CTA when pipeline is **Closer** and substage indicates **Booking Done**
 * (matches legacy “booking done in closer” handoff).
 */
export function isCloserStageBookingDone(lead: Lead): boolean {
  const stage = (lead.stageBlock?.milestoneStage ?? "").toLowerCase();
  const sub = (lead.stageBlock?.milestoneSubStage ?? "").toLowerCase();
  const legacy = (lead.status ?? "").toLowerCase();
  const closer = stage.includes("closer");
  const bookingDone = /booking\s*done/.test(sub) || /booking\s*done/.test(legacy);
  return closer && bookingDone;
}
