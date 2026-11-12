import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import type { PresalesAccessFlags } from "@/lib/presales-access";

export type PresalesAccessSettingsResponse = {
  success?: boolean;
  enabled: boolean;
  key?: string;
  appliesToRoles?: string[];
  superAdminAlwaysAllowed?: boolean;
  globalSearchUnaffected?: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
  message?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function callSettings(
  init?: RequestInit,
): Promise<PresalesAccessSettingsResponse> {
  const res = await fetch("/api/crm/settings/presales-access", {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    }),
  });
  const data = asRecord(await res.json().catch(() => ({})));
  if (!res.ok || data.success === false) {
    const message =
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return {
    success: data.success !== false,
    enabled: data.enabled === true,
    key: typeof data.key === "string" ? data.key : undefined,
    appliesToRoles: Array.isArray(data.appliesToRoles)
      ? data.appliesToRoles.map(String)
      : undefined,
    superAdminAlwaysAllowed: data.superAdminAlwaysAllowed === true,
    globalSearchUnaffected: data.globalSearchUnaffected === true,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

export const presalesAccessApi = {
  get: () => callSettings({ method: "GET" }),
  setEnabled: (enabled: boolean) =>
    callSettings({
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
};

/** Super Admin UI: mirror toggle into local `/me`-style flags for this session. */
export function flagsAfterSuperAdminToggle(
  enabled: boolean,
): PresalesAccessFlags {
  return {
    presalesAccessForAdminRolesEnabled: enabled,
    canAccessPresalesLeads: true,
    canConfigurePresalesTeam: true,
    showPresalesModule: true,
  };
}
