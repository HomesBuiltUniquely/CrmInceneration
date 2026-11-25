import { localCalendarDateKey } from "@/lib/se-followup-motivational-quotes";

export {
  buildEveningFollowUpBrief,
  buildMorningFollowUpBrief,
  buildSnapshotFromDueTodayLeads,
  filterLeadsDueTodayAll,
  formatFollowUpTimeLabel,
  stableFollowUpLeadKey,
  type EveningFollowUpBrief,
  type FollowUpBriefRow,
  type FollowUpDaySnapshot,
  type FollowUpDaySnapshotItem,
  type MorningFollowUpBrief,
  type SeFollowUpViewerContext,
} from "@/lib/sales-executive-followup-day-brief";

export const CRM_SE_FOLLOWUP_START_EVENT = "crm:se-followup-start";

export type SeFollowUpStartScope = "todayAll" | "todayPending";

export type SeFollowUpStartDetail = {
  scope: SeFollowUpStartScope;
};

import {
  CRM_LOGIN_USERNAME_KEY,
  CRM_USER_ID_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
} from "@/lib/auth/api";

const MORNING_DISMISS_PREFIX = "crm:se-followup-morning-dismissed:";
const EVENING_DISMISS_PREFIX = "crm:se-followup-evening-dismissed:";
const EVENING_HOUR = 18;

export function readSeFollowUpViewerKey(): string {
  if (typeof window === "undefined") return "";
  const username = (window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY) ?? "").trim();
  const userId = (window.localStorage.getItem(CRM_USER_ID_STORAGE_KEY) ?? "").trim();
  const name = (window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY) ?? "").trim();
  return username || userId || name;
}

export function isMorningFollowUpDismissed(viewerKey: string, dateKey = localCalendarDateKey()): boolean {
  if (typeof window === "undefined" || !viewerKey) return true;
  try {
    return window.localStorage.getItem(`${MORNING_DISMISS_PREFIX}${viewerKey}:${dateKey}`) === "1";
  } catch {
    return false;
  }
}

export function isEveningFollowUpDismissed(viewerKey: string, dateKey = localCalendarDateKey()): boolean {
  if (typeof window === "undefined" || !viewerKey) return true;
  try {
    return window.localStorage.getItem(`${EVENING_DISMISS_PREFIX}${viewerKey}:${dateKey}`) === "1";
  } catch {
    return false;
  }
}

export function markMorningFollowUpDismissed(viewerKey: string, dateKey = localCalendarDateKey()): void {
  if (typeof window === "undefined" || !viewerKey) return;
  try {
    window.localStorage.setItem(`${MORNING_DISMISS_PREFIX}${viewerKey}:${dateKey}`, "1");
  } catch {
    /* ignore */
  }
}

export function markEveningFollowUpDismissed(viewerKey: string, dateKey = localCalendarDateKey()): void {
  if (typeof window === "undefined" || !viewerKey) return;
  try {
    window.localStorage.setItem(`${EVENING_DISMISS_PREFIX}${viewerKey}:${dateKey}`, "1");
  } catch {
    /* ignore */
  }
}

export function isLocalEveningWindow(now = new Date()): boolean {
  return now.getHours() >= EVENING_HOUR;
}

export function shouldOfferMorningPopup(viewerKey: string, now = new Date()): boolean {
  if (!viewerKey) return false;
  return !isMorningFollowUpDismissed(viewerKey, localCalendarDateKey(now));
}

export function shouldOfferEveningPopup(viewerKey: string, now = new Date()): boolean {
  if (!viewerKey) return false;
  if (!isLocalEveningWindow(now)) return false;
  return !isEveningFollowUpDismissed(viewerKey, localCalendarDateKey(now));
}

export function isCrmLeadOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(".crm-overlay-backdrop-in, .crm-overlay-panel-in"),
  );
}

export function dispatchSeFollowUpStart(scope: SeFollowUpStartScope): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SeFollowUpStartDetail>(CRM_SE_FOLLOWUP_START_EVENT, {
      detail: { scope },
    }),
  );
}