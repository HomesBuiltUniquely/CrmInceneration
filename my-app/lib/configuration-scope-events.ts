export const CONFIGURATION_SCOPE_UPDATED_EVENT = "crm:configuration-scope-updated";

export const OPEN_CONFIGURATION_SCOPE_EVENT = "crm:open-configuration-scope";

export const RESUME_MEETING_SCHEDULE_EVENT = "crm:resume-meeting-schedule";

export type OpenConfigurationScopeDetail = {
  leadType: string;
  leadId: string;
  /** When true, Configuration Scope highlights every missing required field. */
  highlightMissing?: boolean;
  reason?: "meeting-scheduled";
  /** Meeting substage to restore when returning to Schedule Hub Meeting. */
  meetingFeedback?: string;
};

export type ResumeMeetingScheduleDetail = {
  leadType: string;
  leadId: string;
  meetingFeedback?: string;
};

/** Notify lead detail UI (e.g. data completeness meter) after scope requirements change. */
export function notifyConfigurationScopeUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONFIGURATION_SCOPE_UPDATED_EVENT));
}

/** Open Configuration Scope from Complete Task (or elsewhere) and optionally highlight gaps. */
export function notifyOpenConfigurationScope(detail: OpenConfigurationScopeDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenConfigurationScopeDetail>(OPEN_CONFIGURATION_SCOPE_EVENT, {
      detail,
    }),
  );
}

/** After Configuration Scope is filled from a meeting gate, reopen Schedule Hub Meeting. */
export function notifyResumeMeetingSchedule(detail: ResumeMeetingScheduleDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ResumeMeetingScheduleDetail>(RESUME_MEETING_SCHEDULE_EVENT, {
      detail,
    }),
  );
}
