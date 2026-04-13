import type { Lead } from "@/lib/data";

/**
 * Hub lead entity persists LOST / closure reason text on **`resone`** (legacy spelling in DB/DTO).
 * Same field as `CreateLeadClient` uses: `payload.resone = form.reason.trim()` when feedback is LOST.
 *
 * `PUT /v1/{FormLead|Home1|...}/details/{id}` JSON body must include `resone` for the value to be stored.
 */
export const LOST_REASON_API_FIELD = "resone" as const;

/** Read LOST text from GET details JSON (any key the backend might return). */
export function readLostReasonFromDetail(detail: Record<string, unknown>): string {
  const a = detail.resone;
  const b = detail.reason;
  const c = detail.lostReason;
  for (const v of [a, b, c]) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Write LOST / closure reason onto the outgoing PUT body (DB field `resone`). */
export function applyLostReasonToDetailPayload(
  target: Record<string, unknown>,
  lostReason: Lead["lostReason"]
): void {
  const t = typeof lostReason === "string" ? lostReason.trim() : "";
  if (!t) return;
  target[LOST_REASON_API_FIELD] = t;
}
