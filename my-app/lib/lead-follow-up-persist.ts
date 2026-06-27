import { isLostCategory } from "@/lib/crm-pipeline";
import {
  normalizeHubScheduleDateString,
  FOLLOW_UP_DATE_CLEAR_SENTINEL,
} from "@/lib/lead-schedule-payload";
import { putHubScheduleDates } from "@/lib/lead-details-client";
import {
  isStaleLegacyOneHourAutoFollowUp,
  isStaleMidnightAutoFollowUp,
  parseFollowUpTimestampMs,
  resolveEffectiveFollowUpDateRaw,
} from "@/lib/follow-up-date";
import {
  readFollowUpDateRaw,
  readLeadCreatedAtRaw,
} from "@/lib/lead-follow-up-insights";
import { asCrmLeadType, readLeadUpdatedAtRaw, type ApiLead, type CrmLeadType } from "@/lib/leads-filter";
import { isCrmLeadReinquiry } from "@/lib/lead-source-utils";

const persistedKeys = new Set<string>();

function isApiLeadFollowUpAutoPersistSkipped(lead: ApiLead): boolean {
  const st = lead.stage;
  const category = String(
    st?.milestoneStageCategory ?? lead.presalesMilestoneCategory ?? "",
  ).trim();
  return isLostCategory(category);
}

/** Hub value to write when list/detail shows an auto-derived follow-up. */
export function computeAutoFollowUpDateToPersist(lead: ApiLead): string | null {
  if (isApiLeadFollowUpAutoPersistSkipped(lead)) return null;

  const storedRaw = readFollowUpDateRaw(lead);
  const storedNorm = normalizeHubScheduleDateString(storedRaw);
  if (storedNorm === FOLLOW_UP_DATE_CLEAR_SENTINEL) return null;

  const isReinquiry = isCrmLeadReinquiry(lead);
  const effective = resolveEffectiveFollowUpDateRaw(storedRaw, readLeadCreatedAtRaw(lead), {
    isReinquiry,
    updatedRaw: readLeadUpdatedAtRaw(lead),
  });
  if (!effective) return null;

  const effectiveNorm = normalizeHubScheduleDateString(effective);
  if (!effectiveNorm || effectiveNorm === FOLLOW_UP_DATE_CLEAR_SENTINEL) return null;

  if (!storedNorm) return effectiveNorm;

  if (effectiveNorm !== storedNorm) {
    if (isStaleMidnightAutoFollowUp(storedRaw, readLeadCreatedAtRaw(lead))) {
      return effectiveNorm;
    }
    if (isStaleLegacyOneHourAutoFollowUp(storedRaw, readLeadCreatedAtRaw(lead))) {
      return effectiveNorm;
    }
    if (isReinquiry) {
      const storedMs = parseFollowUpTimestampMs(storedNorm);
      const effectiveMs = parseFollowUpTimestampMs(effectiveNorm);
      if (effectiveMs !== null && storedMs !== null && effectiveMs > storedMs) {
        return effectiveNorm;
      }
    }
  }

  return null;
}

/**
 * Save auto follow-up via existing lead PUT (`/api/crm/lead/{type}/{id}`) with
 * `{ followUpDate }` only — same contract as Complete Task schedule save.
 */
export async function tryPersistAutoFollowUpDateForLead(
  lead: ApiLead,
  leadTypeFallback: CrmLeadType,
): Promise<boolean> {
  const followUpDate = computeAutoFollowUpDateToPersist(lead);
  if (!followUpDate) return false;

  const id = String(lead.id ?? "").trim();
  if (!id) return false;

  const leadType = asCrmLeadType(lead.leadType, leadTypeFallback);
  const key = `${leadType}:${id}:${followUpDate}`;
  if (persistedKeys.has(key)) return false;

  try {
    await putHubScheduleDates(leadType, id, { followUpDate });
    persistedKeys.add(key);
    return true;
  } catch (error) {
    console.warn("[lead:follow-up-autosave] PUT failed", { leadType, id, followUpDate }, error);
    return false;
  }
}

export async function persistAutoFollowUpDatesForLeads(
  leads: ApiLead[],
  leadTypeFallback: CrmLeadType,
): Promise<number> {
  let saved = 0;
  for (const lead of leads) {
    const ok = await tryPersistAutoFollowUpDateForLead(lead, leadTypeFallback);
    if (ok) saved += 1;
  }
  return saved;
}
