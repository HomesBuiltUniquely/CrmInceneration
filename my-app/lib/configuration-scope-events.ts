export const CONFIGURATION_SCOPE_UPDATED_EVENT = "crm:configuration-scope-updated";

export const OPEN_CONFIGURATION_SCOPE_EVENT = "crm:open-configuration-scope";

export type OpenConfigurationScopeDetail = {
  leadType: string;
  leadId: string;
  /** When true, Configuration Scope highlights every missing required field. */
  highlightMissing?: boolean;
  reason?: "meeting-scheduled";
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
