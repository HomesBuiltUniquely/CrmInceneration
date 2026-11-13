import { normalizeRole } from "@/lib/auth/api";

/** Global toggle value from `/me` (`true` = Admin/Sales Admin may use Presales). */
export const CRM_PRESALES_ACCESS_FOR_ADMIN_ROLES_KEY =
  "crm_presales_access_for_admin_roles";
/** Whether this user may open Presales leads (list/detail). */
export const CRM_CAN_ACCESS_PRESALES_LEADS_KEY = "crm_can_access_presales_leads";
/** Whether this user may create/list Presales roles. */
export const CRM_CAN_CONFIGURE_PRESALES_TEAM_KEY =
  "crm_can_configure_presales_team";
/** Hide Presales nav / module when false (same as canAccessPresalesLeads for FE). */
export const CRM_SHOW_PRESALES_MODULE_KEY = "crm_show_presales_module";

/** Fired on `window` after flags are written so ModuleSwitcher / sidebar refresh. */
export const CRM_PRESALES_ACCESS_CHANGED_EVENT = "crm-presales-access-changed";

export const PRESALES_ACCESS_DISABLED_CODE = "PRESALES_ACCESS_DISABLED";

export type PresalesAccessFlags = {
  /** Global Super Admin toggle. Default true when unknown. */
  presalesAccessForAdminRolesEnabled: boolean;
  canAccessPresalesLeads: boolean;
  canConfigurePresalesTeam: boolean;
  showPresalesModule: boolean;
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return fallback;
}

function readStoredBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return fallback;
  return asBool(raw, fallback);
}

/** Default ON so older `/me` payloads keep current Admin/Sales Admin behaviour. */
export function defaultPresalesAccessFlags(): PresalesAccessFlags {
  return {
    presalesAccessForAdminRolesEnabled: true,
    canAccessPresalesLeads: true,
    canConfigurePresalesTeam: true,
    showPresalesModule: true,
  };
}

export function extractPresalesAccessFlags(
  user: Record<string, unknown> | null | undefined,
): PresalesAccessFlags {
  const defaults = defaultPresalesAccessFlags();
  if (!user) return defaults;
  return {
    presalesAccessForAdminRolesEnabled: asBool(
      user.presalesAccessForAdminRolesEnabled,
      defaults.presalesAccessForAdminRolesEnabled,
    ),
    canAccessPresalesLeads: asBool(
      user.canAccessPresalesLeads,
      defaults.canAccessPresalesLeads,
    ),
    canConfigurePresalesTeam: asBool(
      user.canConfigurePresalesTeam,
      defaults.canConfigurePresalesTeam,
    ),
    showPresalesModule: asBool(
      user.showPresalesModule ?? user.canAccessPresalesLeads,
      defaults.showPresalesModule,
    ),
  };
}

export function persistPresalesAccessFlags(flags: PresalesAccessFlags): void {
  if (typeof window === "undefined") return;
  const write = (key: string, value: boolean) => {
    window.localStorage.setItem(key, value ? "true" : "false");
  };
  write(
    CRM_PRESALES_ACCESS_FOR_ADMIN_ROLES_KEY,
    flags.presalesAccessForAdminRolesEnabled,
  );
  write(CRM_CAN_ACCESS_PRESALES_LEADS_KEY, flags.canAccessPresalesLeads);
  write(CRM_CAN_CONFIGURE_PRESALES_TEAM_KEY, flags.canConfigurePresalesTeam);
  write(CRM_SHOW_PRESALES_MODULE_KEY, flags.showPresalesModule);
  window.dispatchEvent(new Event(CRM_PRESALES_ACCESS_CHANGED_EVENT));
}

export function persistPresalesAccessFlagsFromUser(
  user: Record<string, unknown> | null | undefined,
): PresalesAccessFlags {
  const flags = extractPresalesAccessFlags(user);
  persistPresalesAccessFlags(flags);
  return flags;
}

export function readPresalesAccessFlags(): PresalesAccessFlags {
  return {
    presalesAccessForAdminRolesEnabled: readStoredBool(
      CRM_PRESALES_ACCESS_FOR_ADMIN_ROLES_KEY,
      true,
    ),
    canAccessPresalesLeads: readStoredBool(CRM_CAN_ACCESS_PRESALES_LEADS_KEY, true),
    canConfigurePresalesTeam: readStoredBool(
      CRM_CAN_CONFIGURE_PRESALES_TEAM_KEY,
      true,
    ),
    showPresalesModule: readStoredBool(CRM_SHOW_PRESALES_MODULE_KEY, true),
  };
}

export function readShowPresalesModule(): boolean {
  return readPresalesAccessFlags().showPresalesModule;
}

export function readCanConfigurePresalesTeam(): boolean {
  return readPresalesAccessFlags().canConfigurePresalesTeam;
}

/**
 * Whether ADMIN / SALES_ADMIN should see Presales module in nav.
 * Super Admin / Presales roles always see it (their RBAC is unchanged).
 */
export function roleMaySeePresalesModule(roleRaw: string): boolean {
  const role = normalizeRole(roleRaw);
  if (role === "SUPER_ADMIN") return true;
  if (role === "PRESALES_MANAGER" || role === "PRESALES_EXECUTIVE") return true;
  if (role === "ADMIN" || role === "SALES_ADMIN") {
    return readShowPresalesModule();
  }
  return false;
}

export function roleMayConfigurePresalesTeam(roleRaw: string): boolean {
  const role = normalizeRole(roleRaw);
  if (role === "SUPER_ADMIN") return true;
  if (role === "PRESALES_MANAGER") return true;
  if (role === "ADMIN" || role === "SALES_ADMIN") {
    return readCanConfigurePresalesTeam();
  }
  return false;
}

export function isPresalesAccessDisabledError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === PRESALES_ACCESS_DISABLED_CODE;
}

export function presalesAccessDisabledMessage(error?: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim();
    if (/presales/i.test(msg)) return msg;
  }
  return "Presales access is turned off. Contact Super Admin.";
}
