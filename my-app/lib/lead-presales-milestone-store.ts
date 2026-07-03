import type { ApiLead, CrmLeadType } from "@/lib/leads-filter";
import {
  readPresalesMilestoneFromDetail,
  type PresalesMilestoneUpdate,
} from "@/lib/lead-detail-mapper";

export const LEAD_PRESALES_MILESTONE_STORAGE_KEY = "crm-lead-presales-milestone-overrides";
export const LEAD_PRESALES_MILESTONE_EVENT = "crm-lead-presales-milestone-updated";

export type StoredPresalesMilestone = PresalesMilestoneUpdate & {
  savedAt: string;
};

type StoredMap = Record<string, StoredPresalesMilestone>;

function storageKey(leadType: CrmLeadType | string, leadId: string): string {
  return `${String(leadType).trim().toLowerCase()}:${String(leadId).trim()}`;
}

function readStoredMap(): StoredMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEAD_PRESALES_MILESTONE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as StoredMap;
  } catch {
    return {};
  }
}

function writeStoredMap(map: StoredMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEAD_PRESALES_MILESTONE_STORAGE_KEY, JSON.stringify(map));
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function presalesMilestoneMatches(
  got: PresalesMilestoneUpdate,
  expected: PresalesMilestoneUpdate,
): boolean {
  return (
    norm(got.presalesMilestoneStage) === norm(expected.presalesMilestoneStage) &&
    norm(got.presalesMilestoneCategory) === norm(expected.presalesMilestoneCategory) &&
    norm(got.presalesMilestoneSubStage) === norm(expected.presalesMilestoneSubStage)
  );
}

export function presalesMilestonePersistedInDetail(
  detail: Record<string, unknown>,
  expected: PresalesMilestoneUpdate,
): boolean {
  const got = readPresalesMilestoneFromDetail(detail);
  return presalesMilestoneMatches(
    {
      presalesMilestoneStage: got.stage,
      presalesMilestoneCategory: got.category,
      presalesMilestoneSubStage: got.subStage,
    },
    expected,
  );
}

export function getStoredPresalesMilestone(
  leadType: CrmLeadType | string,
  leadId: string,
): StoredPresalesMilestone | null {
  const hit = readStoredMap()[storageKey(leadType, leadId)];
  return hit ?? null;
}

export function setStoredPresalesMilestone(
  leadType: CrmLeadType | string,
  leadId: string,
  update: PresalesMilestoneUpdate,
): void {
  if (typeof window === "undefined") return;
  const map = readStoredMap();
  map[storageKey(leadType, leadId)] = {
    ...update,
    savedAt: new Date().toISOString(),
  };
  writeStoredMap(map);
  window.dispatchEvent(
    new CustomEvent(LEAD_PRESALES_MILESTONE_EVENT, {
      detail: { leadType, leadId, update },
    }),
  );
}

export function clearStoredPresalesMilestone(
  leadType: CrmLeadType | string,
  leadId: string,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey(leadType, leadId);
  const map = readStoredMap();
  if (!(key in map)) return;
  delete map[key];
  writeStoredMap(map);
}

/** Merge client-side presales milestone when Hub GET/filter omits persisted fields. */
export function applyStoredPresalesMilestoneToDetail(
  detail: Record<string, unknown>,
  leadType: CrmLeadType | string,
  leadId: string,
): Record<string, unknown> {
  const stored = getStoredPresalesMilestone(leadType, leadId);
  if (!stored) return detail;
  if (presalesMilestonePersistedInDetail(detail, stored)) {
    clearStoredPresalesMilestone(leadType, leadId);
    return detail;
  }
  const next = { ...detail };
  next.presalesMilestoneStage = stored.presalesMilestoneStage;
  next.presalesMilestoneCategory = stored.presalesMilestoneCategory;
  next.presalesMilestoneSubStage = stored.presalesMilestoneSubStage;
  const prevStage =
    next.stage && typeof next.stage === "object" && !Array.isArray(next.stage)
      ? (next.stage as Record<string, unknown>)
      : {};
  next.stage = {
    ...prevStage,
    presalesMilestoneStage: stored.presalesMilestoneStage,
    presalesMilestoneCategory: stored.presalesMilestoneCategory,
    presalesMilestoneSubStage: stored.presalesMilestoneSubStage,
  };
  const df = next.dynamicFields;
  const dfo =
    df && typeof df === "object" && !Array.isArray(df)
      ? { ...(df as Record<string, unknown>) }
      : {};
  dfo.presalesMilestoneStage = stored.presalesMilestoneStage;
  dfo.presalesMilestoneCategory = stored.presalesMilestoneCategory;
  dfo.presalesMilestoneSubStage = stored.presalesMilestoneSubStage;
  next.dynamicFields = dfo;
  return next;
}

export function applyStoredPresalesMilestoneToApiLead(
  lead: ApiLead,
  sourceLeadType: string,
): ApiLead {
  if (typeof window === "undefined") return lead;
  const lt = String(lead.leadType ?? sourceLeadType).trim().toLowerCase();
  if (!usesPresalesMilestoneClientOverlay(lt)) return lead;
  const id = String(lead.id ?? "");
  if (!id) return lead;
  return applyStoredPresalesMilestoneToDetail(
    lead as Record<string, unknown>,
    lt,
    id,
  ) as ApiLead;
}

/**
 * Client overlay when Hub GET/filter omits presales fields.
 * WhatsApp: disabled after Hub fix (2026-06-23) — DB is source of truth.
 * Walk-in: retained until walk-in presales PUT parity is confirmed.
 */
export function usesPresalesMilestoneClientOverlay(leadType: CrmLeadType | string): boolean {
  return String(leadType).trim().toLowerCase() === "walkinlead";
}
