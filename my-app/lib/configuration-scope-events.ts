export const CONFIGURATION_SCOPE_UPDATED_EVENT = "crm:configuration-scope-updated";

/** Notify lead detail UI (e.g. data completeness meter) after scope requirements change. */
export function notifyConfigurationScopeUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONFIGURATION_SCOPE_UPDATED_EVENT));
}
