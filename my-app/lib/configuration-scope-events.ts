export const CONFIGURATION_SCOPE_UPDATED_EVENT = "crm:configuration-scope-updated";

export const OPEN_CONFIGURATION_SCOPE_EVENT = "crm:open-configuration-scope";

export const CONFIGURATION_SCOPE_FINALIZED_EVENT = "crm:configuration-scope-finalized";

export type OpenConfigurationScopeDetail = {
  leadType: string;
  leadId: string;
  /** When true, Configuration Scope highlights every missing required field. */
  highlightMissing?: boolean;
  reason?: "meeting-scheduled";
};

export type ConfigurationScopeFinalizedDetail = {
  leadType: string;
  leadId: string;
  /** Re-open Complete Task and schedule Hub meeting after a successful finalize. */
  continueMeetingSchedule?: boolean;
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

/** After successful Finalize — parent can reopen Complete Task / Schedule Meeting. */
export function notifyConfigurationScopeFinalized(
  detail: ConfigurationScopeFinalizedDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ConfigurationScopeFinalizedDetail>(CONFIGURATION_SCOPE_FINALIZED_EVENT, {
      detail,
    }),
  );
}
