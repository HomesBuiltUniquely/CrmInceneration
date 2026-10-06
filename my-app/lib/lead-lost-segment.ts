import { crmLeadAssigneeAliasNorms, readSalesStageFieldsFromLead, type ApiLead } from "@/lib/leads-filter";
import { isLostCategory } from "@/lib/crm-pipeline";
import type { InsightCountOpts } from "@/lib/lead-follow-up-insights";
import {
  leadPhoneDigits,
  parseLeadCreatedAtMs,
  parseLeadUpdatedAtMs,
} from "@/lib/primary-source-leads";

function assigneeAliasNorms(lead: ApiLead): Set<string> {
  return crmLeadAssigneeAliasNorms(lead);
}

export type LostSegmentMode =
  | "lostDiscovery"
  | "lostConnection"
  | "lostExperienceDesign"
  | "lostDecision"
  | "lostClosed";

export const LOST_SEGMENT_TILES: { mode: LostSegmentMode; label: string }[] = [
  { mode: "lostDiscovery", label: "Discovery Lost" },
  { mode: "lostConnection", label: "Connection Lost" },
  { mode: "lostExperienceDesign", label: "Experience & Design Lost" },
  { mode: "lostDecision", label: "Decision Lost" },
  { mode: "lostClosed", label: "Closed Lost" },
];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasLostToken(...parts: string[]): boolean {
  return parts.some((p) => /\blost\b/i.test(p));
}

function isExperienceDesignText(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  if (t.includes("experience") && t.includes("design")) return true;
  if (/\bexp\b/.test(t) && t.includes("design")) return true;
  return false;
}

function stageMatchesMilestone(stage: string, milestone: string): boolean {
  const s = norm(stage);
  const m = norm(milestone);
  if (!s || !m) return false;
  if (s === m || s.startsWith(`${m} `) || s.startsWith(`${m}-`)) return true;
  try {
    return new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s);
  } catch {
    return false;
  }
}

function readPresalesLostFields(lead: ApiLead): {
  category: string;
  stage: string;
  subStage: string;
} {
  const st = lead.stage;
  const category = String(
    st?.presalesMilestoneCategory ??
      (lead as { presalesMilestoneCategory?: string | null }).presalesMilestoneCategory ??
      "",
  ).trim();
  const stage = String(
    st?.presalesMilestoneStage ??
      (lead as { presalesMilestoneStage?: string | null }).presalesMilestoneStage ??
      "",
  ).trim();
  const subStage = String(
    st?.presalesMilestoneSubStage ??
      (lead as { presalesMilestoneSubStage?: string | null }).presalesMilestoneSubStage ??
      "",
  ).trim();
  return { category, stage, subStage };
}

export function readMilestoneStageCategoryNorm(lead: ApiLead): string {
  return norm(readSalesStageFieldsFromLead(lead).milestoneStageCategory);
}

/** Classify a lead into one of the five lost-segment buckets (or null). */
export function classifyLostSegment(lead: ApiLead): LostSegmentMode | null {
  const sales = readSalesStageFieldsFromLead(lead);
  let categoryRaw = sales.milestoneStageCategory;
  let stageRaw = sales.milestoneStage;
  let subRaw = sales.milestoneSubStage;

  // Presales-only lost (no sales milestone yet) still belongs in Lost Segment.
  if (!categoryRaw && !stageRaw) {
    const presales = readPresalesLostFields(lead);
    if (isLostCategory(presales.category) || hasLostToken(presales.category, presales.stage, presales.subStage)) {
      categoryRaw = presales.category;
      stageRaw = presales.stage;
      subRaw = presales.subStage;
    }
  }

  const cat = norm(categoryRaw);
  const stage = norm(stageRaw);
  const sub = norm(subRaw);
  if (!cat && !stage && !sub) return null;

  const haystack = `${cat} ${stage} ${sub}`.trim();
  const lost =
    isLostCategory(categoryRaw) ||
    hasLostToken(categoryRaw, stageRaw, subRaw) ||
    /\blost\b/.test(haystack);
  if (!lost) return null;

  // Priority: Closed → Decision → Exp&Design → Connection → Discovery (docs §5.2).
  // Match category labels ("Discovery Lost"), stage labels ("Discovery Lost"),
  // and stage+lost-category pairs ("Discovery" + "LOST").
  const lostOnStageLabel = /\blost\b/.test(stage) || /\blost\b/.test(sub);

  if (
    (cat.includes("closed") && cat.includes("lost")) ||
    ((stageMatchesMilestone(stage, "closed") || stage.startsWith("closed")) &&
      (cat.includes("lost") || isLostCategory(categoryRaw) || lostOnStageLabel))
  ) {
    return "lostClosed";
  }

  if (
    (cat.includes("decision") && cat.includes("lost")) ||
    ((stageMatchesMilestone(stage, "decision") || stage.startsWith("decision")) &&
      (cat.includes("lost") || isLostCategory(categoryRaw) || lostOnStageLabel))
  ) {
    return "lostDecision";
  }

  if (isExperienceDesignText(cat) || isExperienceDesignText(stage)) {
    return "lostExperienceDesign";
  }

  if (
    (cat.includes("connection") && cat.includes("lost")) ||
    ((stageMatchesMilestone(stage, "connection") ||
      stage.startsWith("connection") ||
      sub.includes("connection lost")) &&
      (cat.includes("lost") || isLostCategory(categoryRaw) || lostOnStageLabel))
  ) {
    return "lostConnection";
  }

  if (
    (cat.includes("discovery") && cat.includes("lost")) ||
    ((stageMatchesMilestone(stage, "discovery") ||
      stage.startsWith("discovery") ||
      sub.includes("discovery lost")) &&
      (cat.includes("lost") || isLostCategory(categoryRaw) || lostOnStageLabel))
  ) {
    return "lostDiscovery";
  }

  // Fresh Lead Lost / unmatched lost → Discovery Lost (safe default per Lost Funnel handoff).
  return "lostDiscovery";
}

export function isLostSegmentLead(lead: ApiLead): boolean {
  return classifyLostSegment(lead) !== null;
}

/** Any lead on a LOST milestone category/path (broader than segment bucket). */
export function isLostPathLead(lead: ApiLead): boolean {
  const sales = readSalesStageFieldsFromLead(lead);
  if (isLostCategory(sales.milestoneStageCategory)) return true;
  const presales = readPresalesLostFields(lead);
  if (isLostCategory(presales.category)) return true;
  const stage = norm(sales.milestoneStage);
  const cat = norm(sales.milestoneStageCategory);
  const sub = norm(sales.milestoneSubStage);
  if (/\blost\b/.test(`${cat} ${stage} ${sub}`.trim())) return true;
  return hasLostToken(presales.category, presales.stage, presales.subStage);
}

/**
 * Lost-path leads stay hidden on the default inbox.
 * Show them when the user is searching, on lost insight tiles, filtering a lost
 * milestone, or applying any list filter (date / type / stage / assignee / etc.)
 * so filtered totals match visible rows.
 */
export function shouldShowLostPathLeadsInTable(args: {
  searchActive: boolean;
  insightTableMode: string | null;
  milestoneStageCategory: string;
  milestoneSubStage: string;
  /** Toolbar date, lead type, stage, assignee, reinquiry, etc. */
  listFiltersActive?: boolean;
}): boolean {
  if (args.searchActive) return true;
  if (args.listFiltersActive) return true;
  if (args.insightTableMode === "lostQuoteSent") {
    return true;
  }
  if (isLostSegmentInsightMode(args.insightTableMode)) return true;
  const filterText = `${args.milestoneStageCategory} ${args.milestoneSubStage}`.trim();
  if (isLostCategory(args.milestoneStageCategory) || /\blost\b/i.test(filterText)) {
    return true;
  }
  return false;
}

/** Same “any list filter” rule used by the leads toolbar for revealing lost-path rows. */
export function isLeadsListFilterActiveForLostPath(args: {
  dateField?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  crmMonthWindow?: string | null;
  leadType?: string | null;
  assignee?: string | null;
  milestoneStage?: string | null;
  milestoneStageCategory?: string | null;
  milestoneSubStage?: string | null;
  reinquiry?: string | null;
}): boolean {
  const lt = (args.leadType ?? "").trim().toLowerCase();
  const leadTypeFilterOn = Boolean(lt) && lt !== "all" && lt !== "verified";
  const dateOn =
    (args.crmMonthWindow ?? "").trim().toLowerCase() === "current" ||
    (Boolean((args.dateField ?? "").trim()) &&
      Boolean((args.dateFrom ?? "").trim()) &&
      Boolean((args.dateTo ?? "").trim()));
  return (
    dateOn ||
    leadTypeFilterOn ||
    Boolean((args.assignee ?? "").trim()) ||
    Boolean((args.milestoneStage ?? "").trim()) ||
    Boolean((args.milestoneStageCategory ?? "").trim()) ||
    Boolean((args.milestoneSubStage ?? "").trim()) ||
    Boolean((args.reinquiry ?? "").trim())
  );
}

/** Default inbox: hide lost-path rows before pagination so page size matches visible rows. */
export function shouldExcludeLostPathFromTablePagination(args: {
  search?: string | null;
  insightTableMode?: string | null;
  dateField?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  crmMonthWindow?: string | null;
  leadType?: string | null;
  assignee?: string | null;
  milestoneStage?: string | null;
  milestoneStageCategory?: string | null;
  milestoneSubStage?: string | null;
  reinquiry?: string | null;
}): boolean {
  return !shouldShowLostPathLeadsInTable({
    searchActive: Boolean((args.search ?? "").trim()),
    insightTableMode: args.insightTableMode ?? null,
    milestoneStageCategory: args.milestoneStageCategory ?? "",
    milestoneSubStage: args.milestoneSubStage ?? "",
    listFiltersActive: isLeadsListFilterActiveForLostPath(args),
  });
}

/** Query flag used by `/api/crm/leads` to drop lost-path rows before slice. */
export function readExcludeLostPathParam(url: URL): boolean {
  const v = (url.searchParams.get("excludeLostPath") ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * Filter lost-path (optional) then slice. Always exclude-before-page so
 * size=20 yields up to 20 visible rows (not 20 fetched → 11 after hide).
 */
export function paginateLeadsForTableInventory<T extends ApiLead>(
  leads: T[],
  page: number,
  size: number,
  excludeLostPath: boolean,
): { content: T[]; totalElements: number; totalPages: number; number: number; size: number } {
  const inventory = excludeLostPath ? leads.filter((lead) => !isLostPathLead(lead)) : leads;
  const pageSize = Math.max(1, Number(size) || 20);
  const pageNum = Math.max(0, Number(page) || 0);
  const start = pageNum * pageSize;
  return {
    content: inventory.slice(start, start + pageSize),
    totalElements: inventory.length,
    totalPages: Math.max(1, Math.ceil(inventory.length / pageSize)),
    number: pageNum,
    size: pageSize,
  };
}

function leadAssignedToSelf(lead: ApiLead, meNorm: string): boolean {
  if (!meNorm) return false;
  return assigneeAliasNorms(lead).has(meNorm);
}

function leadAssignedToTeamMember(lead: ApiLead, teamNorms: Set<string>): boolean {
  if (teamNorms.size === 0) return false;
  for (const alias of assigneeAliasNorms(lead)) {
    if (teamNorms.has(alias)) return true;
  }
  return false;
}

function leadMatchesInsightAssigneeScope(lead: ApiLead, opts: InsightCountOpts): boolean {
  const me = norm(opts.currentUserName);
  const teamSet = new Set(opts.managerTeamNames.map(norm));
  if (opts.viewerRole === "SALES_EXECUTIVE") return leadAssignedToSelf(lead, me);
  if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team") {
    return leadAssignedToTeamMember(lead, teamSet);
  }
  if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my") {
    return leadAssignedToSelf(lead, me);
  }
  return true;
}

/**
 * Phone-dedupe for Lost Segment tiles: prefer the latest lost-path row per phone
 * so earliest-created active siblings do not hide lost leads from counts.
 */
export function pickLostSegmentCountRows(leads: ApiLead[]): ApiLead[] {
  const byKey = new Map<string, ApiLead[]>();
  let orphanSeq = 0;
  for (const lead of leads) {
    const phone = leadPhoneDigits(lead);
    const key =
      phone.length >= 8
        ? `p:${phone}`
        : `id:${String((lead as { id?: string | number }).id ?? "").trim() || `orphan_${orphanSeq++}`}`;
    const list = byKey.get(key) ?? [];
    list.push(lead);
    byKey.set(key, list);
  }

  const out: ApiLead[] = [];
  for (const group of byKey.values()) {
    const lostRows = group.filter((lead) => isLostPathLead(lead));
    const pool = lostRows.length > 0 ? lostRows : group;
    out.push(
      [...pool].sort((a, b) => {
        const updatedDiff = parseLeadUpdatedAtMs(b) - parseLeadUpdatedAtMs(a);
        if (updatedDiff !== 0) return updatedDiff;
        const createdDiff = parseLeadCreatedAtMs(b) - parseLeadCreatedAtMs(a);
        if (createdDiff !== 0) return createdDiff;
        return String(a.id ?? "").localeCompare(String(b.id ?? ""));
      })[0]!,
    );
  }
  return out;
}

export function computeLostSegmentCounts(
  leads: ApiLead[],
  opts: InsightCountOpts,
): Record<LostSegmentMode, number> {
  const counts: Record<LostSegmentMode, number> = {
    lostDiscovery: 0,
    lostConnection: 0,
    lostExperienceDesign: 0,
    lostDecision: 0,
    lostClosed: 0,
  };
  // Accept raw or pre-deduped pools; re-dedupe preferring lost-path current row.
  const pool = pickLostSegmentCountRows(leads);
  for (const lead of pool) {
    if (!leadMatchesInsightAssigneeScope(lead, opts)) continue;
    const bucket = classifyLostSegment(lead);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

/**
 * Drop Reason Analysis from the same lost-segment leads as Lost Funnel Total
 * (grouped by milestone substage — totals match exactly).
 */
export function computeLostSegmentDropReasons(
  leads: ApiLead[],
  opts: InsightCountOpts,
): { total: number; items: Array<{ reason: string; count: number; percent: number }> } {
  const byReason = new Map<string, { reason: string; count: number }>();
  let total = 0;

  for (const lead of pickLostSegmentCountRows(leads)) {
    if (!leadMatchesInsightAssigneeScope(lead, opts)) continue;
    if (!classifyLostSegment(lead)) continue;
    total += 1;

    const sales = readSalesStageFieldsFromLead(lead);
    const rawSub = String(sales.milestoneSubStage ?? "").trim();
    const reason = rawSub || "Unspecified / Other";
    const key = reason.trim().toLowerCase().replace(/\s+/g, " ");
    const existing = byReason.get(key);
    if (existing) existing.count += 1;
    else byReason.set(key, { reason, count: 1 });
  }

  const items = [...byReason.values()].sort(
    (a, b) => b.count - a.count || a.reason.localeCompare(b.reason),
  );

  return {
    total,
    items: items.map((row) => ({
      reason: row.reason,
      count: row.count,
      percent: total > 0 ? (row.count / total) * 100 : 0,
    })),
  };
}

const OTHER_DROP_REASON = "Other / Unspecified";

/**
 * Ensure listed reasons sum to the authoritative total (Lost Funnel Total).
 * Any gap becomes "Other / Unspecified" so nothing is silently missing.
 */
export function reconcileDropReasonsToTotal(
  drop: { total: number; items: Array<{ reason: string; count: number; percent: number }> },
  authoritativeTotal?: number | null,
): { total: number; items: Array<{ reason: string; count: number; percent: number }> } {
  const cleaned = drop.items
    .filter((i) => (Number(i.count) || 0) > 0)
    .map((i) => ({
      reason: String(i.reason ?? "").trim() || OTHER_DROP_REASON,
      count: Number(i.count) || 0,
      percent: Number(i.percent) || 0,
    }));

  const withoutOther = cleaned.filter(
    (i) => i.reason.trim().toLowerCase() !== OTHER_DROP_REASON.toLowerCase(),
  );
  const itemsSum = withoutOther.reduce((s, i) => s + i.count, 0);
  const declaredOther = cleaned
    .filter((i) => i.reason.trim().toLowerCase() === OTHER_DROP_REASON.toLowerCase())
    .reduce((s, i) => s + i.count, 0);

  const targetTotal = Math.max(
    Number(authoritativeTotal) || 0,
    Number(drop.total) || 0,
    itemsSum + declaredOther,
  );

  const gap = targetTotal - itemsSum;
  const items =
    gap > 0
      ? [...withoutOther, { reason: OTHER_DROP_REASON, count: gap, percent: 0 }]
      : withoutOther;

  return {
    total: targetTotal,
    items: items
      .map((row) => ({
        ...row,
        percent: targetTotal > 0 ? (row.count / targetTotal) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}

export function filterLeadsForLostSegmentMode(
  leads: ApiLead[],
  mode: LostSegmentMode,
  opts: InsightCountOpts,
): ApiLead[] {
  return leads.filter((lead) => {
    if (!leadMatchesInsightAssigneeScope(lead, opts)) return false;
    return classifyLostSegment(lead) === mode;
  });
}

export function isLostSegmentInsightMode(
  mode: string | null | undefined,
): mode is LostSegmentMode {
  return (
    mode === "lostDiscovery" ||
    mode === "lostConnection" ||
    mode === "lostExperienceDesign" ||
    mode === "lostDecision" ||
    mode === "lostClosed"
  );
}
