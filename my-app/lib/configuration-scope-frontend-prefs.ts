/** Frontend-only Configuration Scope fields (no Hub API yet). */

export type ClosureProbability = "hot" | "warm" | "cold";

export type ConfigurationScopeFrontendPrefs = {
  wfhSetup: boolean;
  petFriendly: boolean;
  closureProbability: ClosureProbability | null;
};

export const DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS: ConfigurationScopeFrontendPrefs =
  {
    wfhSetup: false,
    petFriendly: false,
    closureProbability: null,
  };

const STORAGE_PREFIX = "crm-config-scope-frontend-prefs";

function storageKey(leadType: string, leadId: string): string {
  return `${STORAGE_PREFIX}:${leadType.trim()}:${leadId.trim()}`;
}

function isClosureProbability(value: unknown): value is ClosureProbability {
  return value === "hot" || value === "warm" || value === "cold";
}

export function readConfigurationScopeFrontendPrefs(
  leadType: string,
  leadId: string,
): ConfigurationScopeFrontendPrefs {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS };
  }
  if (!leadType.trim() || !leadId.trim()) {
    return { ...DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(leadType, leadId));
    if (!raw) return { ...DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS };
    const parsed = JSON.parse(raw) as Partial<ConfigurationScopeFrontendPrefs>;
    return {
      wfhSetup: Boolean(parsed.wfhSetup),
      petFriendly: Boolean(parsed.petFriendly),
      closureProbability: isClosureProbability(parsed.closureProbability)
        ? parsed.closureProbability
        : null,
    };
  } catch {
    return { ...DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS };
  }
}

export function writeConfigurationScopeFrontendPrefs(
  leadType: string,
  leadId: string,
  prefs: ConfigurationScopeFrontendPrefs,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey(leadType, leadId);
  if (!leadType.trim() || !leadId.trim()) return;
  window.localStorage.setItem(key, JSON.stringify(prefs));
}

export function patchConfigurationScopeFrontendPrefs(
  leadType: string,
  leadId: string,
  patch: Partial<ConfigurationScopeFrontendPrefs>,
): ConfigurationScopeFrontendPrefs {
  const next: ConfigurationScopeFrontendPrefs = {
    ...readConfigurationScopeFrontendPrefs(leadType, leadId),
    ...patch,
  };
  writeConfigurationScopeFrontendPrefs(leadType, leadId, next);
  return next;
}
