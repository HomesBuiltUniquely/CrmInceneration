/** Frontend-only Configuration Scope fields (no Hub API yet). */

export type ClosureProbability = "hot" | "warm" | "cold";
export type FinancialSensitivity = "low" | "moderate" | "high";
export type FinancingPreference = "self_funded" | "looking_for_emi";

export type ConfigurationScopeFrontendPrefs = {
  wfhSetup: boolean;
  petFriendly: boolean;
  closureProbability: ClosureProbability | null;
  financialSensitivity: FinancialSensitivity;
  financingPreference: FinancingPreference;
  familyContactRelationship: string | null;
  decisionMaker: string | null;
};

export const DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS: ConfigurationScopeFrontendPrefs =
  {
    wfhSetup: false,
    petFriendly: false,
    closureProbability: null,
    financialSensitivity: "moderate",
    financingPreference: "self_funded",
    familyContactRelationship: null,
    decisionMaker: null,
  };

export const DECISION_MAKER_SELF_VALUE = "__self__";

export type DecisionMakerOption = {
  value: string;
  label: string;
};

export function buildDecisionMakerOptions(
  leadName: string,
  familyContactName: string,
  familyRelationship: string,
): DecisionMakerOption[] {
  const options: DecisionMakerOption[] = [];
  const name = leadName.trim();
  options.push({
    value: DECISION_MAKER_SELF_VALUE,
    label: name ? `${name} (Self)` : "Self",
  });

  const family = familyContactName.trim();
  if (family) {
    const relationship = familyRelationship.trim();
    options.push({
      value: family,
      label: relationship ? `${family} (${relationship})` : family,
    });
  }

  return options;
}

export function labelForDecisionMakerValue(
  value: string,
  options: DecisionMakerOption[],
): string {
  const match = options.find((option) => option.value === value);
  return match?.label ?? "—";
}

const STORAGE_PREFIX = "crm-config-scope-frontend-prefs";

function storageKey(leadType: string, leadId: string): string {
  return `${STORAGE_PREFIX}:${leadType.trim()}:${leadId.trim()}`;
}

function isClosureProbability(value: unknown): value is ClosureProbability {
  return value === "hot" || value === "warm" || value === "cold";
}

function isFinancialSensitivity(value: unknown): value is FinancialSensitivity {
  return value === "low" || value === "moderate" || value === "high";
}

function isFinancingPreference(value: unknown): value is FinancingPreference {
  return value === "self_funded" || value === "looking_for_emi";
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
      financialSensitivity: isFinancialSensitivity(parsed.financialSensitivity)
        ? parsed.financialSensitivity
        : "moderate",
      financingPreference: isFinancingPreference(parsed.financingPreference)
        ? parsed.financingPreference
        : "self_funded",
      familyContactRelationship:
        typeof parsed.familyContactRelationship === "string" &&
        parsed.familyContactRelationship.trim()
          ? parsed.familyContactRelationship.trim()
          : null,
      decisionMaker:
        typeof parsed.decisionMaker === "string" && parsed.decisionMaker.trim()
          ? parsed.decisionMaker.trim()
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
