import {
  extractQuoteIdFromUrl,
  leadQuoteOptionFromSavedLink,
  normalizeLeadQuoteOptions,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import type { Lead } from "@/lib/data";
import { fetchNewCrmQuotePayloads } from "@/lib/lead-details-client";
import {
  buildLeadQuoteOptionsFromProlance,
  extractProlanceQuoteConfiguration,
  extractProlanceQuoteTotalAmount,
  fetchProlanceQuoteShare,
} from "@/lib/prolance-quote-api";

export type LeadQuoteOptionsResult = {
  options: LeadQuoteOption[];
  hubLeadId: string;
};

function pickDetailStr(detail: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = detail[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function resolveHubLeadId(payloads: unknown[]): string {
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const row = payload as Record<string, unknown>;
    const hubLeadId = row.leadId;
    if (typeof hubLeadId === "number" && Number.isFinite(hubLeadId) && hubLeadId > 0) {
      return String(Math.trunc(hubLeadId));
    }
    if (typeof hubLeadId === "string" && /^\d+$/.test(hubLeadId.trim())) {
      return hubLeadId.trim();
    }
  }
  return "";
}

function resolveAnchorQuoteId(payloads: unknown[], savedQuoteLink: string): string {
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const row = payload as Record<string, unknown>;
    const quoteId = row.quoteId;
    if (typeof quoteId === "number" && Number.isFinite(quoteId) && quoteId > 0) {
      return String(Math.trunc(quoteId));
    }
    if (typeof quoteId === "string" && /^\d+$/.test(quoteId.trim())) {
      return quoteId.trim();
    }
    const fromUrl =
      extractQuoteIdFromUrl(String(row.customerQuoteUrl ?? "")) ||
      extractQuoteIdFromUrl(String(row.internalQuoteUrl ?? ""));
    if (fromUrl) return fromUrl;
  }
  return extractQuoteIdFromUrl(savedQuoteLink);
}

function mergeQuoteOptions(...groups: LeadQuoteOption[][]): LeadQuoteOption[] {
  const byKey = new Map<string, LeadQuoteOption>();
  for (const group of groups) {
    for (const option of group) {
      const key = option.customerQuoteUrl || option.internalQuoteUrl || option.id;
      if (!key || byKey.has(key)) continue;
      byKey.set(key, option);
    }
  }
  return normalizeLeadQuoteOptions([...byKey.values()]);
}

export async function fetchQuoteOptionsForLead(
  businessLeadId: string,
  externalReferenceId: string,
  savedQuoteLink: string,
): Promise<LeadQuoteOptionsResult> {
  const payloads = await fetchNewCrmQuotePayloads(businessLeadId, externalReferenceId);
  const anchorQuoteId = resolveAnchorQuoteId(payloads, savedQuoteLink);
  const hubLeadId = resolveHubLeadId(payloads);

  if (anchorQuoteId) {
    try {
      const prolanceOptions = await buildLeadQuoteOptionsFromProlance(anchorQuoteId, hubLeadId);
      if (prolanceOptions.length > 0) {
        return { options: prolanceOptions, hubLeadId };
      }
    } catch {
      /* fall through */
    }
  }

  const savedOption = savedQuoteLink ? leadQuoteOptionFromSavedLink(savedQuoteLink) : null;
  const fallback = mergeQuoteOptions(
    ...payloads.map((payload) => normalizeLeadQuoteOptions(payload)),
    ...(savedOption ? [[savedOption]] : []),
  );
  return { options: fallback, hubLeadId };
}

export async function fetchQuoteOptionsForLeadDetail(
  detail: Record<string, unknown>,
  leadId: string,
): Promise<LeadQuoteOptionsResult> {
  const businessLeadId =
    pickDetailStr(detail, "leadId", "leadRef", "leadCode", "customerId") || leadId;
  const externalReferenceId = pickDetailStr(
    detail,
    "uniqueId",
    "lead_identifier",
    "leadIdentifier",
    "externalReferenceId",
  );
  const savedQuoteLink = pickDetailStr(detail, "quoteLink", "quoteURL", "proposalLink");
  return fetchQuoteOptionsForLead(businessLeadId, externalReferenceId, savedQuoteLink);
}

/** Build a minimal lead-detail payload for quote APIs without re-fetching GET lead. */
export function leadToQuoteDetailPayload(lead: Lead, leadId: string): Record<string, unknown> {
  return {
    leadId: lead.leadId?.trim() || leadId,
    leadRef: lead.leadId?.trim() || leadId,
    uniqueId: lead.externalReferenceId?.trim() || "",
    lead_identifier: lead.externalReferenceId?.trim() || "",
    leadIdentifier: lead.externalReferenceId?.trim() || "",
    externalReferenceId: lead.externalReferenceId?.trim() || "",
    quoteLink: lead.quoteLink?.trim() || "",
    quoteURL: lead.quoteLink?.trim() || "",
    proposalLink: lead.quoteLink?.trim() || "",
  };
}

export function pickLatestQuoteOption(options: LeadQuoteOption[]): LeadQuoteOption | null {
  if (options.length === 0) return null;
  return options.find((option) => option.isLatest) ?? options[0] ?? null;
}

export function resolveQuoteAmount(amount: number | null | undefined): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

/** Fetch quotation total + configuration for a specific quote revision. */
export async function refreshQuoteOptionDetails(
  option: LeadQuoteOption,
): Promise<LeadQuoteOption> {
  const quoteId = option.quoteId?.trim() || option.id.trim();
  if (!quoteId) return option;
  try {
    const share = await fetchProlanceQuoteShare(quoteId);
    const amount = extractProlanceQuoteTotalAmount(share);
    const configuration = extractProlanceQuoteConfiguration(share);
    return {
      ...option,
      amount: amount ?? option.amount,
      configuration: configuration || option.configuration,
    };
  } catch {
    return option;
  }
}

/** @deprecated Use refreshQuoteOptionDetails */
export async function refreshQuoteOptionAmount(
  option: LeadQuoteOption,
): Promise<LeadQuoteOption> {
  const refreshed = await refreshQuoteOptionDetails(option);
  return refreshed;
}
