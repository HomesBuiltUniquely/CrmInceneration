import {
  fetchBookingTokenDeals,
  type BookingTokenDeal,
  type BookingTokenDealsResponse,
} from "@/lib/booking-done-api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { classifyBookingPayment } from "@/lib/booking-done-payment-rules";
import {
  assigneeScopeForExecutive,
  normalizeIncentiveLeadKey,
} from "@/lib/incentives-lead-assignee";
import {
  leadInIncentivePeriod,
  type IncentivePeriodHalf,
} from "@/lib/incentive-period";
import type { IncentiveMemberRef } from "@/lib/incentives-profile";

export type IncentiveBookingLead = {
  id: string;
  leadType: string;
  leadId: number;
  leadLabel: string;
  customerName: string;
  quoteAmount: number;
  amountReceived: number;
  remainingAmount?: number;
  submittedAt: string;
  submittedByName?: string;
  submittedByUserId?: number;
  assigneeName?: string;
  assigneeUserId?: number;
  listingType?: string;
  paymentKind?: string;
};

type RawDeal = BookingTokenDeal & Record<string, unknown>;

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && "name" in v) {
      const name = (v as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return undefined;
}

function pickNestedUserId(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    if (v && typeof v === "object" && "id" in v) {
      const id = (v as { id?: unknown }).id;
      if (typeof id === "number" && Number.isFinite(id) && id > 0) return id;
    }
  }
  return undefined;
}

function resolveAmountReceived(raw: RawDeal, quoteAmount: number): number {
  const tenPct =
    pickNumber(raw, ["tenPercentAmount", "ten_percent_amount"]) ??
    (quoteAmount > 0 ? Math.round(quoteAmount * 0.1) : 0);
  const remaining = pickNumber(raw, ["remainingAmount", "remaining_amount"]);
  let received =
    pickNumber(raw, [
      "amountReceived",
      "amount_received",
      "preBookingAmount",
      "pre_booking_amount",
      "totalReceived",
    ]) ?? raw.preBookingAmount ?? 0;

  const kind = String(raw.paymentKind ?? "").toUpperCase();
  if (kind === "FULL_10%" && tenPct > 0) {
    return Math.max(received, tenPct);
  }
  if (remaining === 0 && tenPct > 0 && received >= tenPct) {
    return Math.max(received, tenPct);
  }
  return received;
}

function mapDealToLead(deal: BookingTokenDeal): IncentiveBookingLead {
  const raw = deal as RawDeal;
  const quoteAmount =
    pickNumber(raw, ["dealValue", "quoteAmount", "quote_amount"]) ?? deal.dealValue ?? 0;
  const amountReceived = resolveAmountReceived(raw, quoteAmount);
  const remainingAmount = pickNumber(raw, ["remainingAmount", "remaining_amount"]);

  const submittedByUserId =
    pickNumber(raw, [
      "submittedByUserId",
      "submitted_by_user_id",
      "submittedById",
    ]) ?? pickNestedUserId(raw, ["submittedBy", "submittedByUser", "createdBy"]);
  const assigneeUserId =
    pickNumber(raw, [
      "assigneeUserId",
      "assigneeId",
      "assignee_id",
      "salesExecutiveId",
      "sales_executive_id",
      "salesExecutiveUserId",
    ]) ?? pickNestedUserId(raw, ["assignee", "salesExecutive", "salesOwner", "assignedTo"]);

  const submittedByName = pickString(raw, [
    "submittedByName",
    "submitted_by_name",
    "submittedBy",
    "createdByName",
  ]) ?? pickString(raw, ["submittedByUser", "createdBy"]);
  const assigneeName = pickString(raw, [
    "assigneeName",
    "assignee",
    "salesExecutive",
    "salesExecutiveName",
    "sales_executive_name",
    "salesOwner",
    "salesSpoc",
    "assignedToName",
  ]);

  const leadIdentifier = pickString(raw, ["leadIdentifier", "lead_identifier"]);
  const leadLabel = leadIdentifier
    ? `${leadIdentifier} · ${deal.leadType}`
    : `Lead #${deal.leadId} · ${deal.leadType}`;

  const derivedKind = classifyBookingPayment(amountReceived, quoteAmount);
  const apiKind = String(deal.paymentKind ?? "").toUpperCase();
  const paymentKind = derivedKind ?? (apiKind === "FULL_10%" || apiKind === "TOKEN" ? apiKind : "");

  return {
    id: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    leadLabel,
    customerName: deal.customerName,
    quoteAmount,
    amountReceived,
    remainingAmount,
    submittedAt: deal.submittedAt,
    submittedByName,
    submittedByUserId,
    assigneeName,
    assigneeUserId,
    listingType: deal.listingType,
    paymentKind,
  };
}

async function fetchAllBookingTokenDeals(): Promise<BookingTokenDeal[]> {
  const size = 500;
  let page = 0;
  let totalPages = 1;
  const deals: BookingTokenDeal[] = [];

  while (page < totalPages) {
    const response: BookingTokenDealsResponse = await fetchBookingTokenDeals({
      page,
      size,
    });
    deals.push(...response.deals);
    totalPages = Math.max(1, response.totalPages ?? 1);
    page += 1;
    if (response.deals.length === 0) break;
  }

  return deals;
}

export async function fetchIncentiveBookingLeads(): Promise<IncentiveBookingLead[]> {
  const deals = await fetchAllBookingTokenDeals();
  return mapBookingDealsToIncentiveLeads(deals);
}

/** Admin/manager view — server matches CRM assignees to booking-token rows. */
export async function fetchIncentiveBookingLeadsForExecutive(
  member: IncentiveMemberRef,
): Promise<IncentiveBookingLead[]> {
  const params = new URLSearchParams();
  params.set("executiveId", String(member.id));
  const scope = assigneeScopeForExecutive(member);
  if (scope.length > 0) {
    params.set(
      "assigneeScope",
      scope
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .join("\0"),
    );
  }

  const res = await fetch(`/api/crm/incentives/executive-leads?${params.toString()}`, {
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { leads?: IncentiveBookingLead[] };
  return Array.isArray(json.leads) ? json.leads : [];
}

export function mapBookingDealsToIncentiveLeads(deals: BookingTokenDeal[]): IncentiveBookingLead[] {
  return deals
    .filter((deal) => {
      const listing = String(deal.listingType ?? "").toLowerCase();
      const status = String(deal.bookingStatus ?? "").toLowerCase();
      return listing !== "cancel" && status !== "cancelled";
    })
    .map(mapDealToLead)
    .filter((lead) => lead.quoteAmount > 0 || lead.amountReceived > 0);
}

export function filterIncentiveLeadsForExecutiveMember(
  leads: IncentiveBookingLead[],
  member: IncentiveMemberRef,
  crmLeadKeys: Set<string>,
): IncentiveBookingLead[] {
  const matchedLeadKeys = new Set<string>();
  for (const lead of leads) {
    const key = leadKeyForRecord(lead);
    if (crmLeadKeys.has(key) || leadMatchesExecutive(lead, member)) {
      matchedLeadKeys.add(key);
    }
  }
  if (matchedLeadKeys.size === 0) return [];
  return leads.filter((lead) => matchedLeadKeys.has(leadKeyForRecord(lead)));
}

function leadMonthKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

/**
 * All booking_token records submitted in the selected 15-day period (one ledger row each).
 */
export function resolveIncentiveLeadsForPeriod(
  leads: IncentiveBookingLead[],
  monthKey: string,
  half: IncentivePeriodHalf,
): IncentiveBookingLead[] {
  return leads
    .filter((lead) => leadInIncentivePeriod(lead.submittedAt, monthKey, half))
    .sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
}

/**
 * All booking_token records submitted in the selected month (both 15-day halves).
 */
export function resolveIncentiveLeadsForMonth(
  leads: IncentiveBookingLead[],
  monthKey: string,
): IncentiveBookingLead[] {
  return leads
    .filter((lead) => leadMonthKey(lead.submittedAt) === monthKey)
    .sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
}

/** @deprecated Use resolveIncentiveLeadsForMonth — kept for compatibility */
export function filterIncentiveLeadsForMonth(
  leads: IncentiveBookingLead[],
  monthKey: string,
): IncentiveBookingLead[] {
  return resolveIncentiveLeadsForMonth(leads, monthKey);
}

function leadMatchesExecutive(lead: IncentiveBookingLead, member: IncentiveMemberRef): boolean {
  const ids = [lead.submittedByUserId, lead.assigneeUserId].filter(
    (id): id is number => id != null && id > 0,
  );
  if (ids.some((id) => id === member.id)) return true;

  const execScope = assigneeScopeForExecutive(member);
  const leadNames = [lead.submittedByName, lead.assigneeName].filter(Boolean) as string[];
  for (const name of leadNames) {
    const norm = normalizeName(name);
    for (const token of execScope) {
      const execNorm = normalizeName(token);
      if (norm === execNorm || norm.includes(execNorm) || execNorm.includes(norm)) {
        return true;
      }
    }
  }
  return false;
}

function leadKeyForRecord(lead: IncentiveBookingLead): string {
  return normalizeIncentiveLeadKey(lead.leadType, lead.leadId);
}

export type FilterExecutiveLeadsOptions = {
  /**
   * Sales executive JWT — Hub already returns only their booking-done deals.
   * Skip assignee matching so the ledger is not empty when submitter fields are missing.
   */
  trustUpstreamScope?: boolean;
  /** CRM admin-pool lead keys for this executive — used when booking rows lack assignee ids. */
  executiveLeadKeys?: Set<string>;
};

export function filterIncentiveLeadsForExecutive(
  leads: IncentiveBookingLead[],
  member: IncentiveMemberRef,
  options?: FilterExecutiveLeadsOptions,
): IncentiveBookingLead[] {
  if (options?.trustUpstreamScope) {
    return leads;
  }

  const crmKeys = options?.executiveLeadKeys;
  const matchedLeadKeys = new Set<string>();

  for (const lead of leads) {
    const key = leadKeyForRecord(lead);
    if (crmKeys?.has(key) || leadMatchesExecutive(lead, member)) {
      matchedLeadKeys.add(key);
    }
  }
  if (matchedLeadKeys.size === 0) return [];

  return leads.filter((lead) => matchedLeadKeys.has(leadKeyForRecord(lead)));
}
