type AnyLead = Record<string, unknown>;
import { normalizeLeadTypeLabel } from "@/lib/lead-source-utils";

function pick(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function firstAdditionalSource(raw: unknown): string {
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === "string" && x.trim()) return x.trim();
    }
    return "";
  }
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        for (const x of parsed) {
          if (typeof x === "string" && x.trim()) return x.trim();
        }
      }
    } catch {
      return "";
    }
  }
  return s;
}

function firstMatchingValueByKeyPart(
  record: Record<string, unknown>,
  includesAll: string[],
): string {
  for (const [key, value] of Object.entries(record)) {
    const nk = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!includesAll.every((p) => nk.includes(p))) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeSourceToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlaceholderSource(value: string): boolean {
  const token = normalizeSourceToken(value);
  return (
    !token ||
    token === "-" ||
    token === "na" ||
    token === "none" ||
    token === "null" ||
    token === "undefined" ||
    token === "unknown" ||
    token === "selectsource" ||
    token === "source"
  );
}

export function getLeadDisplayName(lead: AnyLead): string {
  const dynamic = obj(lead.dynamicFields);
  const top =
    pick(
      lead.name,
      lead.fullName,
      lead.customerName,
      lead.displayName,
      lead.userName,
      lead.firstName,
    ) ||
    pick(
      dynamic.customerName,
      dynamic.custom_Contact_s_Public_Display_Name,
      dynamic.name,
      dynamic.fullName,
    );

  if (top) return top;
  const id = pick(lead.id, lead.leadId);
  return id ? `Lead ${id}` : "—";
}

export function getLeadDisplayEmail(lead: AnyLead): string {
  const dynamic = obj(lead.dynamicFields);
  return pick(
    lead.email,
    lead.emailId,
    lead.emailAddress,
    lead.mail,
    lead.primaryEmail,
    dynamic.customerEmail,
    dynamic.email,
  );
}

export function getLeadDisplayPhone(lead: AnyLead): string {
  const dynamic = obj(lead.dynamicFields);
  return pick(
    lead.phone,
    lead.phoneNumber,
    lead.mobile,
    lead.mobileNumber,
    lead.contactNumber,
    lead.primaryPhone,
    lead.altPhoneNumber,
    dynamic.customerPhone,
    dynamic.phone,
  );
}

export function getLeadDisplayPincode(lead: AnyLead): string {
  const dynamic = obj(lead.dynamicFields);
  return pick(
    lead.propertyPincode,
    lead.propertyPin,
    lead.pincode,
    lead.pinCode,
    lead.zip,
    lead.postalCode,
    lead.zipCode,
    dynamic.propertyPincode,
  );
}

export function getLeadDisplaySource(lead: AnyLead): string {
  const dynamic = obj(lead.dynamicFields);
  const resolvedRaw = pick(
    lead.leadSource,
    lead.LeadSource,
    lead.leadsource,
    lead.source,
    lead.primaryLeadSource,
    lead.leadTypeLabel,
    lead.typeLabel,
    lead.sourceType,
    dynamic.leadSource,
    dynamic.LeadSource,
    dynamic.leadsource,
    dynamic.source,
    dynamic.sourceType,
    dynamic.leadTypeLabel,
    dynamic.custom_Lead_Source,
    dynamic.custom_LeadSource,
    dynamic.customSource,
    firstAdditionalSource(lead.additionalLeadSources),
    firstAdditionalSource(dynamic.additionalLeadSources),
    firstMatchingValueByKeyPart(lead, ["lead", "source"]),
    firstMatchingValueByKeyPart(dynamic, ["lead", "source"]),
    firstMatchingValueByKeyPart(dynamic, ["source"]),
    lead.leadType,
  );
  const fallback = pick(
    lead.leadType,
    lead.lead_type,
    lead.type,
    dynamic.leadType,
    dynamic.lead_type,
    dynamic.type,
    "formlead",
  );
  const effective = isPlaceholderSource(resolvedRaw) ? fallback : resolvedRaw;
  return normalizeLeadTypeLabel(effective || fallback || "formlead");
}
