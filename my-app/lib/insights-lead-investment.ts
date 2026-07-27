import { extractQuoteIdFromUrl } from "@/lib/crm-quote-links";
import type { ApiLead } from "@/lib/leads-filter";
import { resolveQuoteAmount } from "@/lib/lead-quote-options";
import { quoteSentIdOf } from "@/lib/quote-sent-info";
import {
  extractProlanceQuoteTotalAmount,
  fetchProlanceQuoteRevisions,
  fetchProlanceQuoteShare,
} from "@/lib/prolance-quote-api";

const quoteAmountCache = new Map<string, number>();

function resolveAnchorQuoteId(lead: ApiLead): string {
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

/** Parse CRM budget label (e.g. "4.0 Lakhs Onwards") to INR — same basis as Financial Guardrails budget fallback. */
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

async function fetchCurrentQuoteTotalInvestment(anchorId: string): Promise<number> {
  const cached = quoteAmountCache.get(anchorId);
  if (cached != null) return cached;

  try {
    const revisions = await fetchProlanceQuoteRevisions(anchorId);
    let share: Record<string, unknown>;
    if (revisions.length === 0) {
      share = await fetchProlanceQuoteShare(anchorId);
    } else {
      const latest = [...revisions].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      ).at(-1);
      if (!latest) {
        quoteAmountCache.set(anchorId, 0);
        return 0;
      }
      share = await fetchProlanceQuoteShare(latest.quoteId);
    }
    const amount = resolveQuoteAmount(extractProlanceQuoteTotalAmount(share)) ?? 0;
    quoteAmountCache.set(anchorId, amount);
    return amount;
  } catch {
    quoteAmountCache.set(anchorId, 0);
    return 0;
  }
}

/**
 * Total Investment Range for a lead — current quote version amount when a quote exists,
 * otherwise parsed budget (matches Configuration Scope Financial Guardrails).
 */
export async function fetchLeadTotalInvestmentAmount(lead: ApiLead): Promise<number> {
  const anchorId = resolveAnchorQuoteId(lead);
  if (anchorId) {
    const fromQuote = await fetchCurrentQuoteTotalInvestment(anchorId);
    if (fromQuote > 0) return fromQuote;
  }
  return parseBudgetLabelToInr(readLeadBudgetRaw(lead));
}

export async function sumWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<number>,
  concurrency: number,
): Promise<number> {
  if (items.length === 0) return 0;
  let index = 0;
  let total = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      total += await fn(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker()),
  );
  return total;
}

export async function buildLeadInvestmentMap(
  leads: ApiLead[],
  concurrency = 6,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  await sumWithConcurrency(
    leads,
    async (lead) => {
      const amount = await fetchLeadTotalInvestmentAmount(lead);
      map.set(stableLeadKey(lead), amount);
      return amount;
    },
    concurrency,
  );
  return map;
}

export function stableLeadKey(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  return String(row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? row.id ?? "")
    .trim()
    .toLowerCase();
}
