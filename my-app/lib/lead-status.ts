export const LEAD_STATUS_STORAGE_KEY = "crm-lead-status-overrides";
export const LEAD_STATUS_EVENT = "crm-lead-status-updated";

type StoredLeadStatusMap = Record<string, string>;

function readStoredLeadStatuses(): StoredLeadStatusMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(LEAD_STATUS_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed: unknown = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<StoredLeadStatusMap>((result, [key, value]) => {
      if (typeof value === "string" && value.trim().length > 0) {
        result[key] = value;
      }

      return result;
    }, {});
  } catch {
    return {};
  }
}

export function getStoredLeadStatus(leadId: string, fallback: string) {
  const allStatuses = readStoredLeadStatuses();
  return allStatuses[leadId] ?? fallback;
}

export function setStoredLeadStatus(leadId: string, status: string) {
  if (typeof window === "undefined") {
    return;
  }

  const allStatuses = readStoredLeadStatuses();
  allStatuses[leadId] = status;
  window.localStorage.setItem(LEAD_STATUS_STORAGE_KEY, JSON.stringify(allStatuses));
  window.dispatchEvent(
    new CustomEvent(LEAD_STATUS_EVENT, {
      detail: {
        leadId,
        status,
      },
    }),
  );
}
