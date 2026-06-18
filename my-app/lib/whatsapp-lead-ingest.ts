/**
 * Ingest phones using direct GET calls to api.hubinterior.com customer API only.
 * - List: GET /api/customer/phones/recent (or explicit phone list in request)
 * - Details per phone: GET /api/customer?phone=… (then /api/customer/:number)
 * - CRM: re-inquiry on existing lead or POST /v1/WhatsappLead on Hub
 */

import { BASE_URL } from "@/lib/base-url";
import {
  CUSTOMER_API_BASE,
  type CustomerPhoneRecentItem,
  type FetchRecentCustomerPhonesOpts,
  fetchCustomerDetailsDirect,
  fetchCustomerRecordById,
  fetchRecentCustomerPhones,
} from "@/lib/customer-phones-api";
import type { ApiLead, CrmLeadType, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES, asCrmLeadType } from "@/lib/leads-filter";
import { detailsUrl, LEAD_TYPE_TO_BASE } from "@/lib/crm-lead-endpoints";
import {
  WHATSAPP_CRM_LEAD_TYPE,
  fetchWhatsappLeadsForMerge,
} from "@/lib/crm-whatsapp-leads";
import { fetchWalkInLeadsForMerge } from "@/lib/crm-walkin-leads";
import {
  leadPhoneDigits,
  normalizeLeadTypeKey,
  pickPrimarySourceRows,
} from "@/lib/primary-source-leads";
import {
  dedupeLeadSources,
  parseAdditionalLeadSources,
  serializeAdditionalLeadSources,
} from "@/lib/lead-source-utils";
import { isHubNoResourceResponse } from "@/lib/hub-no-resource";

export const WHATSAPP_SOURCE_LABEL = "WhatsApp";

const WHATSAPP_CREATE_PATHS = [
  LEAD_TYPE_TO_BASE.whatsapplead,
  "/v1/WhatsAppLead",
  "/v1/Whatsapplead",
] as const;

export type WhatsappIngestAction =
  | "reinquiry"
  | "created"
  | "exists"
  | "skipped"
  | "error";

export type WhatsappIngestPhoneResult = {
  phone: string;
  action: WhatsappIngestAction;
  recordId?: number;
  leadType?: CrmLeadType;
  leadId?: string;
  assignee?: string;
  message?: string;
};

export type WhatsappIngestPollMeta = {
  source: "customer-phones-recent";
  apiBase: string;
  polledCount: number;
  /** Highest `id` from this poll — pass as `sinceId` on the next run. */
  lastSinceId: number;
  nextSinceId: number;
};

export type WhatsappIngestSummary = {
  processed: number;
  reinquiry: number;
  created: number;
  exists: number;
  skipped: number;
  errors: number;
  results: WhatsappIngestPhoneResult[];
  poll?: WhatsappIngestPollMeta;
};

export type CustomerIngestHints = {
  name?: string;
  email?: string;
  projectName?: string;
  customerNumber?: string;
  payload?: Record<string, unknown> | null;
};

function hintsFromCustomerPayload(
  payload: Record<string, unknown> | null | undefined,
): CustomerIngestHints {
  if (!payload) return {};
  const email = String(
    payload.clientEmail ?? payload.email ?? payload.customer_email ?? "",
  ).trim();
  const projectName = String(
    payload.projectName ?? payload.project_name ?? payload.sourceProject ?? "",
  ).trim();
  const name = String(
    payload.customerName ??
      payload.name ??
      payload.clientName ??
      payload.customer_name ??
      "",
  ).trim();
  const customerNumber = String(
    payload.customerNumber ?? payload.customer_mobile ?? payload.contactNo ?? "",
  ).trim();
  return {
    name: name || undefined,
    email: email || undefined,
    projectName: projectName || undefined,
    customerNumber: customerNumber || undefined,
    payload,
  };
}

function mergeCustomerHints(
  item: CustomerPhoneRecentItem,
  extra?: CustomerIngestHints,
): CustomerIngestHints {
  return {
    ...hintsFromCustomerPayload(item.payload),
    ...extra,
    customerNumber: item.customerNumber || extra?.customerNumber,
    payload: item.payload ?? extra?.payload ?? null,
  };
}

export function normalizeInboundPhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "").trim();
  return digits.length >= 8 ? digits : "";
}

function pickAssigneeLabel(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  const keys = [
    "salesExecutive",
    "assignedTo",
    "assignedToName",
    "salesOwnerName",
    "ownerName",
    "assignee",
  ];
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const name = String(o.name ?? o.fullName ?? "").trim();
      if (name) return name;
    }
  }
  return "";
}

function additionalSourcesRaw(detail: Record<string, unknown>): string {
  const v = detail.additionalLeadSources;
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

function hasWhatsappInAdditionalSources(detail: Record<string, unknown>): boolean {
  return parseAdditionalLeadSources(detail.additionalLeadSources).some((s) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "").includes("whatsapp"),
  );
}

async function fetchFilterPage(
  leadType: CrmLeadType,
  search: string,
  headers: HeadersInit,
): Promise<ApiLead[]> {
  const all: ApiLead[] = [];
  for (let page = 0; page < 3; page += 1) {
    const upstream = new URL(`${BASE_URL}/v1/leads/filter`);
    upstream.searchParams.set("leadType", leadType);
    upstream.searchParams.set("milestoneScope", "crm");
    upstream.searchParams.set("page", String(page));
    upstream.searchParams.set("size", "100");
    upstream.searchParams.set("sort", "updatedAt,desc");
    if (search) upstream.searchParams.set("search", search);
    const res = await fetch(upstream.toString(), { headers, cache: "no-store" });
    if (!res.ok) break;
    const pageData = (await res.json()) as SpringPage<ApiLead>;
    const chunk = Array.isArray(pageData.content) ? pageData.content : [];
    if (chunk.length === 0) break;
    all.push(...chunk);
    const totalPages = Math.max(1, Number(pageData.totalPages ?? 1));
    if (page + 1 >= totalPages) break;
  }
  return all;
}

/** Search CRM pool for rows matching exact phone digits. */
export async function findLeadsByPhone(
  phoneDigits: string,
  headers: HeadersInit,
): Promise<ApiLead[]> {
  const needle = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
  const ctx = {
    headers,
    sort: "updatedAt,desc",
    search: needle,
    effDates: { from: "", to: "" },
    extraParams: [] as Array<{ key: string; value: string }>,
    perType: 100,
    maxPages: 5,
  };

  const fetches: Promise<ApiLead[]>[] = [];
  for (const leadType of CRM_LEAD_TYPES) {
    if (leadType === "walkinlead") {
      fetches.push(
        fetchWalkInLeadsForMerge(ctx).then((r) => r.leads),
      );
      continue;
    }
    if (leadType === "whatsapplead") {
      fetches.push(
        fetchWhatsappLeadsForMerge(ctx).then((r) => r.leads),
      );
      continue;
    }
    fetches.push(fetchFilterPage(leadType, needle, headers));
  }

  const chunks = await Promise.all(fetches);
  const seen = new Set<string>();
  const matches: ApiLead[] = [];
  for (const chunk of chunks) {
    for (const lead of chunk) {
      if (leadPhoneDigits(lead) !== phoneDigits) continue;
      const lt = normalizeLeadTypeKey(lead.leadType);
      const id = String(lead.id ?? "").trim();
      const key = `${lt}:${id}`;
      if (!id || seen.has(key)) continue;
      seen.add(key);
      matches.push({ ...lead, leadType: lt });
    }
  }
  return matches;
}

export async function markWhatsappReinquiryOnLead(
  leadType: CrmLeadType,
  id: string,
  headers: HeadersInit,
): Promise<{ ok: boolean; alreadyTagged?: boolean; error?: string }> {
  const url = `${BASE_URL}${detailsUrl(leadType, id)}`;
  const getRes = await fetch(url, { headers, cache: "no-store" });
  if (!getRes.ok) {
    return { ok: false, error: `Could not load lead (${getRes.status})` };
  }
  const base = (await getRes.json()) as Record<string, unknown>;
  if (hasWhatsappInAdditionalSources(base)) {
    return { ok: true, alreadyTagged: true };
  }
  const existing = parseAdditionalLeadSources(base.additionalLeadSources);
  const nextSources = dedupeLeadSources([...existing, WHATSAPP_SOURCE_LABEL]);
  const merged = {
    ...base,
    additionalLeadSources: serializeAdditionalLeadSources(
      nextSources,
      additionalSourcesRaw(base),
    ),
  };
  const putRes = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(merged),
    cache: "no-store",
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    return { ok: false, error: text || `PUT failed (${putRes.status})` };
  }
  return { ok: true };
}

export async function createWhatsappLead(
  phoneDigits: string,
  headers: HeadersInit,
  hints: CustomerIngestHints = {},
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const display =
    normalizeInboundPhone(hints.customerNumber) ||
    (phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits);
  const displayName = hints.name?.trim() || `WhatsApp ${display}`;
  const body: Record<string, unknown> = {
    phoneNumber: display,
    phone: display,
    mobile: display,
    mobileNumber: display,
    name: displayName,
    leadSource: WHATSAPP_SOURCE_LABEL,
    LeadSource: WHATSAPP_SOURCE_LABEL,
    leadType: WHATSAPP_CRM_LEAD_TYPE,
  };
  if (hints.email?.trim()) {
    body.email = hints.email.trim();
    body.clientEmail = hints.email.trim();
  }
  if (hints.projectName?.trim()) body.projectName = hints.projectName.trim();

  for (const path of WHATSAPP_CREATE_PATHS) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (isHubNoResourceResponse(res.status, text)) continue;
    if (!res.ok) continue;
    let id = "";
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      id = String(json.id ?? json.leadId ?? "").trim();
    } catch {
      // accepted without id
    }
    return { ok: true, id: id || undefined };
  }
  return { ok: false, error: "WhatsApp lead create API unavailable on Hub (POST /v1/WhatsappLead)" };
}

export async function processWhatsappPhone(
  rawPhone: unknown,
  headers: HeadersInit,
  opts?: { recordId?: number; hints?: CustomerIngestHints },
): Promise<WhatsappIngestPhoneResult> {
  const phone = normalizeInboundPhone(rawPhone);
  const recordId = opts?.recordId;
  if (!phone) {
    return {
      phone: String(rawPhone ?? ""),
      action: "skipped",
      recordId,
      message: "Invalid phone",
    };
  }

  try {
    const matches = await findLeadsByPhone(phone, headers);
    const nonWhatsapp = matches.filter(
      (m) => normalizeLeadTypeKey(m.leadType) !== WHATSAPP_CRM_LEAD_TYPE,
    );
    const whatsappOnly = matches.filter(
      (m) => normalizeLeadTypeKey(m.leadType) === WHATSAPP_CRM_LEAD_TYPE,
    );

    if (nonWhatsapp.length > 0) {
      const primary = pickPrimarySourceRows(nonWhatsapp)[0];
      const lt = asCrmLeadType(primary.leadType, "formlead");
      const id = String(primary.id ?? "").trim();
      if (!id) {
        return { phone, recordId, action: "error", message: "Matched lead has no id" };
      }
      const tagged = await markWhatsappReinquiryOnLead(lt, id, headers);
      if (!tagged.ok) {
        return {
          phone,
          recordId,
          action: "error",
          leadType: lt,
          leadId: id,
          assignee: pickAssigneeLabel(primary),
          message: tagged.error,
        };
      }
      return {
        phone,
        recordId,
        action: "reinquiry",
        leadType: lt,
        leadId: id,
        assignee: pickAssigneeLabel(primary),
        message: tagged.alreadyTagged ? "Already tagged" : undefined,
      };
    }

    if (whatsappOnly.length > 0) {
      const row = whatsappOnly[0];
      return {
        phone,
        recordId,
        action: "exists",
        leadType: WHATSAPP_CRM_LEAD_TYPE,
        leadId: String(row.id ?? "").trim() || undefined,
      };
    }

    const created = await createWhatsappLead(phone, headers, opts?.hints);
    if (!created.ok) {
      return { phone, recordId, action: "error", message: created.error };
    }
    return {
      phone,
      recordId,
      action: "created",
      leadType: WHATSAPP_CRM_LEAD_TYPE,
      leadId: created.id,
    };
  } catch (err) {
    return {
      phone,
      recordId,
      action: "error",
      message: err instanceof Error ? err.message : "Processing failed",
    };
  }
}

/** Poll GET /api/customer/phones/recent (MSG91 / webhook DB). */
export async function pollRecentCustomerPhonesForIngest(
  opts: FetchRecentCustomerPhonesOpts = {},
): Promise<{ items: CustomerPhoneRecentItem[]; poll: WhatsappIngestPollMeta }> {
  const response = await fetchRecentCustomerPhones(opts);
  const lastSinceId = response.items.reduce(
    (max, item) => Math.max(max, item.id),
    0,
  );
  return {
    items: response.items,
    poll: {
      source: "customer-phones-recent",
      apiBase: CUSTOMER_API_BASE,
      polledCount: response.count,
      lastSinceId,
      nextSinceId: lastSinceId,
    },
  };
}

/** Enrich list row with direct GET /api/customer?phone= (and optional records/:id). */
async function resolveCustomerItem(
  item: CustomerPhoneRecentItem,
  opts?: { useRecordId?: boolean },
): Promise<CustomerPhoneRecentItem> {
  const phoneKey = item.phone || item.customerNumber;
  try {
    const direct = await fetchCustomerDetailsDirect(phoneKey);
    if (direct) {
      return {
        ...item,
        ...direct,
        id: direct.id > 0 ? direct.id : item.id,
        payload: direct.payload ?? item.payload,
      };
    }
  } catch {
    // fall through to record id or list row
  }
  if (opts?.useRecordId && item.id > 0) {
    try {
      const { item: full } = await fetchCustomerRecordById(item.id);
      if (full) return full;
    } catch {
      // use list row
    }
  }
  return item;
}

export async function runWhatsappLeadIngestFromCustomerItems(
  items: CustomerPhoneRecentItem[],
  headers: HeadersInit,
  opts?: { useRecordId?: boolean; poll?: WhatsappIngestPollMeta; skipDirectLookup?: boolean },
): Promise<WhatsappIngestSummary> {
  const seenPhones = new Set<string>();
  const results: WhatsappIngestPhoneResult[] = [];

  for (const rawItem of items) {
    const item = opts?.skipDirectLookup
      ? rawItem
      : await resolveCustomerItem(rawItem, { useRecordId: opts?.useRecordId });
    const phone = normalizeInboundPhone(item.phone || item.customerNumber);
    if (!phone || seenPhones.has(phone)) {
      results.push({
        phone: item.phone || String(item.customerNumber ?? ""),
        recordId: item.id,
        action: "skipped",
        message: seenPhones.has(phone) ? "Duplicate phone in batch" : "Invalid phone",
      });
      continue;
    }
    seenPhones.add(phone);
    results.push(
      await processWhatsappPhone(phone, headers, {
        recordId: item.id,
        hints: mergeCustomerHints(item),
      }),
    );
  }

  const summary: WhatsappIngestSummary = {
    processed: results.length,
    reinquiry: 0,
    created: 0,
    exists: 0,
    skipped: 0,
    errors: 0,
    results,
    poll: opts?.poll,
  };
  for (const r of results) {
    if (r.action === "reinquiry") summary.reinquiry += 1;
    else if (r.action === "created") summary.created += 1;
    else if (r.action === "exists") summary.exists += 1;
    else if (r.action === "skipped") summary.skipped += 1;
    else if (r.action === "error") summary.errors += 1;
  }
  return summary;
}

/** Each phone: GET /api/customer?phone=… then ingest into CRM. */
export async function runWhatsappLeadIngest(
  phones: string[],
  headers: HeadersInit,
): Promise<WhatsappIngestSummary> {
  const unique = [...new Set(phones.map(normalizeInboundPhone).filter(Boolean))];
  const items: CustomerPhoneRecentItem[] = [];
  for (const phone of unique) {
    const direct = await fetchCustomerDetailsDirect(phone);
    items.push(
      direct ?? {
        id: 0,
        phone,
        customerNumber: phone,
        payload: null,
        createdAt: "",
      },
    );
  }
  return runWhatsappLeadIngestFromCustomerItems(items, headers, { skipDirectLookup: true });
}

/** GET phones/recent, then GET /api/customer?phone= per row, then CRM ingest. */
export async function runWhatsappLeadIngestFromCustomerPoll(
  pollOpts: FetchRecentCustomerPhonesOpts,
  crmHeaders: HeadersInit,
  ingestOpts?: { useRecordId?: boolean },
): Promise<WhatsappIngestSummary> {
  const { items, poll } = await pollRecentCustomerPhonesForIngest(pollOpts);
  if (items.length === 0) {
    return {
      processed: 0,
      reinquiry: 0,
      created: 0,
      exists: 0,
      skipped: 0,
      errors: 0,
      results: [],
      poll,
    };
  }
  return runWhatsappLeadIngestFromCustomerItems(items, crmHeaders, {
    useRecordId: ingestOpts?.useRecordId,
    poll,
  });
}
