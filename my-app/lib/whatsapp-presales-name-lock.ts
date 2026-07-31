import { isWhatsappLeadTypeKey } from "@/lib/crm-whatsapp-leads";
import { isIvrCallLeadSource } from "@/lib/ivr-lead-source";
import { canViewBothMilestonePipelines, isPresalesRole } from "@/lib/roleUtils";
export const WHATSAPP_PRESALES_NAME_USED_STORAGE_KEY =
  "crm-whatsapp-presales-name-used";

type StoredNameUsedMap = Record<string, true>;

function storageKeyForLead(
  leadType: string,
  leadId: string,
  leadSource?: string,
): string {
  const id = leadId.trim();
  if (isWhatsappLeadTypeKey(leadType)) return `whatsapplead:${id}`;
  if (leadType.trim().toLowerCase() === "addlead" && isIvrCallLeadSource(leadSource)) {
    return `addlead:ivrcall:${id}`;
  }
  return `${leadType.trim().toLowerCase()}:${id}`;
}

export function isPresalesOneTimeNameEditLead(
  leadType: string,
  leadSource?: string,
): boolean {
  if (isWhatsappLeadTypeKey(leadType)) return true;
  return leadType.trim().toLowerCase() === "addlead" && isIvrCallLeadSource(leadSource);
}

function readStoredNameUsedMap(): StoredNameUsedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WHATSAPP_PRESALES_NAME_USED_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<StoredNameUsedMap>((acc, [key, value]) => {
      if (value === true) acc[key] = true;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function writeStoredNameUsedMap(map: StoredNameUsedMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    WHATSAPP_PRESALES_NAME_USED_STORAGE_KEY,
    JSON.stringify(map),
  );
}

/** Hub default inbound label, e.g. "WhatsApp 9008275361". */
export function isDefaultWhatsappPlaceholderName(
  name: string,
  phone?: string,
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;

  const normalized = trimmed.replace(/\s+/g, " ");
  if (/^whatsapp\s+\d+$/i.test(normalized)) return true;

  const phoneDigits = (phone ?? "").replace(/\D/g, "");
  const nameDigits = trimmed.replace(/\D/g, "");
  if (phoneDigits.length >= 10 && nameDigits === phoneDigits) {
    const withoutLabel = trimmed.replace(/whatsapp/gi, "").replace(/\s/g, "");
    if (withoutLabel.replace(/\D/g, "") === phoneDigits) return true;
  }

  return false;
}

/** Hub default IVR inbound label, e.g. "IVR Call 9008275361". */
export function isDefaultIvrCallPlaceholderName(
  name: string,
  phone?: string,
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;

  const normalized = trimmed.replace(/\s+/g, " ");
  if (/^ivr(\s+call)?\s+\d+$/i.test(normalized)) return true;

  const phoneDigits = (phone ?? "").replace(/\D/g, "");
  const nameDigits = trimmed.replace(/\D/g, "");
  if (phoneDigits.length >= 10 && nameDigits === phoneDigits) {
    const withoutLabel = trimmed
      .replace(/ivr(\s+call)?/gi, "")
      .replace(/\s/g, "");
    if (withoutLabel.replace(/\D/g, "") === phoneDigits) return true;
  }

  return false;
}

export function isDefaultInboundPlaceholderName(
  leadType: string,
  leadSource: string | undefined,
  name: string,
  phone?: string,
): boolean {
  if (isWhatsappLeadTypeKey(leadType)) {
    return isDefaultWhatsappPlaceholderName(name, phone);
  }
  if (leadType.trim().toLowerCase() === "addlead" && isIvrCallLeadSource(leadSource)) {
    return isDefaultIvrCallPlaceholderName(name, phone);
  }
  return !name.trim();
}

export function hasWhatsappPresalesNameUpdateBeenUsed(
  leadId: string,
  leadType?: string,
  leadSource?: string,
): boolean {
  const id = leadId.trim();
  if (!id) return false;
  const key = storageKeyForLead(leadType ?? "whatsapplead", id, leadSource);
  return Boolean(readStoredNameUsedMap()[key]);
}

export function markWhatsappPresalesNameUpdateBeenUsed(
  leadId: string,
  leadType?: string,
  leadSource?: string,
): void {
  const id = leadId.trim();
  if (!id) return;
  const map = readStoredNameUsedMap();
  map[storageKeyForLead(leadType ?? "whatsapplead", id, leadSource)] = true;
  writeStoredNameUsedMap(map);
}

export function clearWhatsappPresalesNameUpdateUsed(
  leadId: string,
  leadType?: string,
  leadSource?: string,
): void {
  const id = leadId.trim();
  if (!id) return;
  const map = readStoredNameUsedMap();
  delete map[storageKeyForLead(leadType ?? "whatsapplead", id, leadSource)];
  writeStoredNameUsedMap(map);
}

export type WhatsappPresalesNameLockInput = {
  leadType: string;
  leadId: string;
  leadSource?: string;
  phone?: string;
  /** True when lead is verified or assigned to sales. */
  handedOffToSales: boolean;
  viewerRoleKey: string;
  /** API-loaded name was already a real name (not inbound placeholder). */
  nameLockedFromServer?: boolean;
  /** Non-inbound leads: lock when name already exists on load. */
  nameHasValue?: boolean;
};

/** Presales hierarchy + Admin / Super Admin / Sales Admin. */
export function canWhatsappOneTimeNameEdit(viewerRoleKey: string): boolean {
  return (
    isPresalesRole(viewerRoleKey) || canViewBothMilestonePipelines(viewerRoleKey)
  );
}

/** Whether Full Name should be read-only (same rules as phone once locked). */
export function resolveWhatsappPresalesNameLocked(
  input: WhatsappPresalesNameLockInput,
): boolean {
  if (!isPresalesOneTimeNameEditLead(input.leadType, input.leadSource)) {
    return Boolean(input.nameHasValue);
  }

  if (input.handedOffToSales) {
    return true;
  }

  if (!canWhatsappOneTimeNameEdit(input.viewerRoleKey)) {
    return Boolean(input.nameHasValue);
  }

  if (input.nameLockedFromServer) {
    return true;
  }

  if (
    hasWhatsappPresalesNameUpdateBeenUsed(
      input.leadId,
      input.leadType,
      input.leadSource,
    )
  ) {
    return true;
  }

  // Still editable while drafting (including clearing the whole default name).
  return false;
}

export function shouldShowWhatsappPresalesNameHint(
  input: WhatsappPresalesNameLockInput,
): boolean {
  if (!isPresalesOneTimeNameEditLead(input.leadType, input.leadSource)) return false;
  if (!canWhatsappOneTimeNameEdit(input.viewerRoleKey)) return false;
  if (input.handedOffToSales) return false;
  return !resolveWhatsappPresalesNameLocked(input);
}

export function validateWhatsappCustomerNameForSave(
  name: string,
  phone?: string,
  leadType?: string,
  leadSource?: string,
): { ok: true } | { ok: false; message: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a customer name before saving." };
  }
  if (isDefaultInboundPlaceholderName(leadType ?? "whatsapplead", leadSource, trimmed, phone)) {
    const channel =
      leadType?.trim().toLowerCase() === "addlead" && isIvrCallLeadSource(leadSource)
        ? "IVR call"
        : "WhatsApp";
    return {
      ok: false,
      message: `Replace the default ${channel} name with the customer's real name.`,
    };
  }
  return { ok: true };
}
