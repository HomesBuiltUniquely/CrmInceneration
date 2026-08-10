import { extractQuoteIdFromUrl } from "@/lib/crm-quote-links";
import type { ApiLead } from "@/lib/leads-filter";
import { resolveQuoteAmount } from "@/lib/lead-quote-options";
import { quoteSentIdOf } from "@/lib/quote-sent-info";
import {
  extractProlanceQuoteTotalAmount,
  fetchProlanceQuoteShare,
} from "@/lib/prolance-quote-api";

const quoteAmountCache = new Map<string, number>();

export function resolveAnchorQuoteId(lead: ApiLead): string {
  const fromInfo = quoteSentIdOf(lead);
  if (fromInfo) return fromInfo;
  const link = String(lead.quoteLink ?? "").trim();
  return extractQuoteIdFromUrl(link);
}

function readLeadBudgetRaw(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const df = row.dynamicFields;
  const fromDf =
    df && typeof df === "object" && !Array.isArray(df)
      ? String(
          (df as Record<string, unknown>).budget ??
            (df as Record<string, unknown>).budgetRange ??
            (df as Record<string, unknown>).estimatedBudget ??
            "",
        ).trim()
      : "";
  return String(
    row.budget ?? row.budgetRange ?? row.estimatedBudget ?? row.leadBudget ?? fromDf ?? "",
  ).trim();
}

/** Parse CRM budget label (e.g. "4.0 Lakhs Onwards") to INR. */
export function parseBudgetLabelToInr(raw: string | null | undefined): number {
  const text = String(raw ?? "").trim();
  if (!text) return 0;

  const lower = text.toLowerCase();
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return 0;
  const num = Number(numMatch[1]);
  if (!Number.isFinite(num) || num <= 0) return 0;

  if (/\bcr|\bcrore\b/.test(lower)) return Math.round(num * 10_000_000);
  if (/\blakh|\blakhs\b/.test(lower) || /\b\d+(?:\.\d+)?\s*l\b/.test(lower)) {
    return Math.round(num * 100_000);
  }
  if (num >= 100_000) return Math.round(num);
  return Math.round(num * 100_000);
}

export function syncLeadInvestmentAmount(lead: ApiLead): number {
  const anchorId = resolveAnchorQuoteId(lead);
  if (anchorId) {
    const cached = quoteAmountCache.get(anchorId);
    if (cached != null && cached > 0) return cached;
  }
  return parseBudgetLabelToInr(readLeadBudgetRaw(lead));
}

/** Instant map — budget (+ cached quote amounts). No network. */
export function buildLeadBudgetInvestmentMapSync(leads: ApiLead[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const lead of leads) {
    map.set(stableLeadKey(lead), syncLeadInvestmentAmount(lead));
  }
  return map;
}

async function fetchQuoteTotalFast(quoteId: string): Promise<number> {
  const id = quoteId.trim();
  if (!id) return 0;
  const cached = quoteAmountCache.get(id);
  if (cached != null) return cached;

  try {
    const share = await fetchProlanceQuoteShare(id);
    const amount = resolveQuoteAmount(extractProlanceQuoteTotalAmount(share)) ?? 0;
    quoteAmountCache.set(id, amount);
    return amount;
  } catch {
    quoteAmountCache.set(id, 0);
    return 0;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker()),
  );
}

export type EnrichInvestmentOptions = {
  /** Stop starting new quote fetches after this many ms (default 2000). */
  deadlineMs?: number;
  concurrency?: number;
  /** Cap distinct quote ids per pass (quote-sent / late funnel first). */
  maxQuoteIds?: number;
};

/**
 * Upgrade budget map with live quote totals (one share call per quote id, deduped).
 * Respects deadline — returns partial upgrades within ~2s.
 */
export async function enrichInvestmentMapWithQuotes(
  leads: ApiLead[],
  map: Map<string, number>,
  options: EnrichInvestmentOptions = {},
): Promise<Map<string, number>> {
  const deadlineMs = options.deadlineMs ?? 2000;
  const concurrency = options.concurrency ?? 16;
  const maxQuoteIds = options.maxQuoteIds ?? 120;
  const deadline = Date.now() + deadlineMs;

  const quoteIdToKeys = new Map<string, string[]>();
  for (const lead of leads) {
    const quoteId = resolveAnchorQuoteId(lead);
    if (!quoteId) continue;
    const key = stableLeadKey(lead);
    const keys = quoteIdToKeys.get(quoteId) ?? [];
    keys.push(key);
    quoteIdToKeys.set(quoteId, keys);
  }

  const quoteIds = [...quoteIdToKeys.keys()].slice(0, maxQuoteIds);

  await runWithConcurrency(
    quoteIds,
    async (quoteId) => {
      if (Date.now() > deadline) return;
      const amount = await fetchQuoteTotalFast(quoteId);
      if (amount <= 0) return;
      for (const leadKey of quoteIdToKeys.get(quoteId) ?? []) {
        map.set(leadKey, amount);
      }
    },
    concurrency,
  );

  return map;
}

/** @deprecated Prefer sync map + enrichInvestmentMapWithQuotes */
export async function fetchLeadTotalInvestmentAmount(lead: ApiLead): Promise<number> {
  const anchorId = resolveAnchorQuoteId(lead);
  if (anchorId) {
    const fromQuote = await fetchQuoteTotalFast(anchorId);
    if (fromQuote > 0) return fromQuote;
  }
  return parseBudgetLabelToInr(readLeadBudgetRaw(lead));
}

export async function buildLeadInvestmentMap(
  leads: ApiLead[],
  concurrency = 16,
): Promise<Map<string, number>> {
  const map = buildLeadBudgetInvestmentMapSync(leads);
  return enrichInvestmentMapWithQuotes(leads, map, {
    deadlineMs: 2000,
    concurrency,
    maxQuoteIds: 120,
  });
}

export function stableLeadKey(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  return String(row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? row.id ?? "")
    .trim()
    .toLowerCase();
}
