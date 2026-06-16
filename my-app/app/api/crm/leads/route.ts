import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { ApiLead, LeadSourceCounts, LeadSummaryTotals, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES, crmLeadTopLevelStage } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { getAllowedLeadTypesForRole } from "@/lib/crm-role-access";
import { getRoleFromUser, normalizeRole, unwrapAuthUserPayload } from "@/lib/auth/api";
import { getLocalMonthRangeIsoDates } from "@/lib/presales-heatmap-helpers";
import { readLeadCreatedAtRaw } from "@/lib/lead-follow-up-insights";
import { fetchWalkInLeadsForMerge } from "@/lib/crm-walkin-leads";
import { leadAssignedTimestampForPresalesMonthWindow } from "@/lib/presales-heatmap-helpers";
import { normalizeLeadTypeKey } from "@/lib/primary-source-leads";
import { isPresalesRole } from "@/lib/roleUtils";
import { leadMatchesWorkspaceMilestoneFilter } from "@/lib/crm-workspace";
import { parseAssigneeAliasSetQuery } from "@/lib/admin-assignee-match";
import { hubHandlesDateFilter } from "@/lib/crm-date-field-filter";

/** Toolbar dates win; otherwise `crmMonthWindow=current` expands to this calendar month (server TZ). */
function effectiveDateRangeFromRequest(url: URL): { from: string; to: string } {
  const rawFrom = (url.searchParams.get("dateFrom") ?? "").trim();
  const rawTo = (url.searchParams.get("dateTo") ?? "").trim();
  const win = (url.searchParams.get("crmMonthWindow") ?? "").trim().toLowerCase();
  if (rawFrom || rawTo) return { from: rawFrom, to: rawTo };
  if (win === "current") {
    const { from, to } = getLocalMonthRangeIsoDates();
    return { from, to };
  }
  return { from: "", to: "" };
}

function extraParamValue(url: URL, key: string, eff: { from: string; to: string }): string {
  if (key === "dateFrom") return eff.from;
  if (key === "dateTo") return eff.to;
  return (url.searchParams.get(key) ?? "").trim();
}

const NEW_CRM_GLOBAL_SEARCH_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "SALES_ADMIN",
  "SALES_MANAGER",
  "SALES_EXECUTIVE",
  "PRESALES_MANAGER",
  "PRESALES_EXECUTIVE",
]);

function parseUpdatedAt(a: ApiLead): number {
  const u = a.updatedAt;
  if (!u) return 0;
  const t = Date.parse(u);
  return Number.isNaN(t) ? 0 : t;
}

function norm(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}

function leadStableIdentifier(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const fromFields = String(
    row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? row.uniqueId ?? "",
  ).trim();
  if (fromFields) return fromFields.toLowerCase();
  if (lead.id !== undefined && lead.id !== null) return String(lead.id);
  return "";
}

function emptySourceCounts(): LeadSourceCounts {
  return {
    all: 0,
    formlead: 0,
    glead: 0,
    mlead: 0,
    addlead: 0,
    websitelead: 0,
    walkinlead: 0,
  };
}

function computeSourceCounts(leads: ApiLead[]): LeadSourceCounts {
  const counts = emptySourceCounts();
  for (const lead of leads) {
    const leadType = normalizeLeadTypeKey(lead.leadType);
    counts[leadType] += 1;
    counts.all += 1;
  }
  return counts;
}

function computeSummaryTotals(leads: ApiLead[]): LeadSummaryTotals {
  let lead = 0;
  let opportunity = 0;
  for (const item of leads) {
    const stage = crmLeadTopLevelStage(item).trim().toLowerCase();
    if (stage === "fresh lead" || stage === "discovery" || stage === "connection") {
      lead += 1;
      continue;
    }
    if (stage === "experience & design" || stage === "decision" || stage === "closed") {
      opportunity += 1;
    }
  }
  return { lead, opportunity };
}

function inDateRange(
  leadDateRaw: string | null | undefined,
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  const ts = leadDateRaw ? Date.parse(leadDateRaw) : Number.NaN;
  if (Number.isNaN(ts)) return false;
  const dayMs = 24 * 60 * 60 * 1000;
  if (from) {
    const fromTs = Date.parse(`${from}T00:00:00`);
    if (!Number.isNaN(fromTs) && ts < fromTs) return false;
  }
  if (to) {
    const toTs = Date.parse(`${to}T00:00:00`) + dayMs - 1;
    if (!Number.isNaN(toTs) && ts > toTs) return false;
  }
  return true;
}

async function resolveViewerRole(req: NextRequest): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    if (!res.ok) return "";
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const user = unwrapAuthUserPayload(json);
    return normalizeRole(getRoleFromUser(user));
  } catch {
    return "";
  }
}

const LEADS_EXTRA_PARAMS = [
  "stage",
  "substage",
  "result",
  "dateField",
  "dateFrom",
  "dateTo",
  "assignee",
  "milestoneStage",
  "milestoneStageCategory",
  "milestoneSubStage",
  "presalesMilestoneStage",
  "presalesMilestoneCategory",
  "presalesMilestoneSubStage",
  "verificationStatus",
  "reinquiry",
] as const;

/** Hub presales inbox — JWT-scoped list; forwards same filters as `/v1/leads/filter`. */
async function fetchPresalesSearchLeads(
  req: NextRequest,
  url: URL,
  effDates: { from: string; to: string },
  sort: string,
  search: string,
): Promise<ApiLead[]> {
  const parseChunk = (json: unknown): Array<{ type?: string; lead?: ApiLead }> => {
    if (!json || typeof json !== "object") return [];
    const rec = json as Record<string, unknown>;
    if (Array.isArray(rec.content)) return rec.content as Array<{ type?: string; lead?: ApiLead }>;
    const data =
      rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)
        ? (rec.data as Record<string, unknown>)
        : null;
    if (data && Array.isArray(data.content)) {
      return data.content as Array<{ type?: string; lead?: ApiLead }>;
    }
    if (Array.isArray(rec.items)) return rec.items as Array<{ type?: string; lead?: ApiLead }>;
    if (Array.isArray(json)) return json as Array<{ type?: string; lead?: ApiLead }>;
    return [];
  };

  const parseTotalPages = (json: unknown): number => {
    if (!json || typeof json !== "object") return 1;
    const rec = json as Record<string, unknown>;
    const direct = Number(rec.totalPages ?? 1);
    if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
    const data =
      rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)
        ? (rec.data as Record<string, unknown>)
        : null;
    const nested = Number(data?.totalPages ?? 1);
    return Number.isFinite(nested) && nested > 0 ? Math.floor(nested) : 1;
  };

  const searchSize = 500;
  const byId = new Map<string, ApiLead>();
  for (let pageNum = 0; pageNum < 200; pageNum += 1) {
    const upstream = new URL(`${BASE_URL}/v1/leads/presales-search`);
    upstream.searchParams.set("page", String(pageNum));
    upstream.searchParams.set("size", String(searchSize));
    upstream.searchParams.set("sort", sort);
    if (search) upstream.searchParams.set("search", search);
    for (const key of LEADS_EXTRA_PARAMS) {
      const v = extraParamValue(url, key, effDates);
      if (v) upstream.searchParams.set(key, v);
    }
    const res = await fetch(upstream.toString(), {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    if (!res.ok) break;
    const pageData = (await res.json().catch(() => ({}))) as unknown;
    const chunk = parseChunk(pageData);
    if (chunk.length === 0) break;
    for (const item of chunk) {
      const lt = String(item.type ?? "").trim().toLowerCase();
      const lead = item.lead;
      if (!lead || typeof lead !== "object") continue;
      const id = leadStableIdentifier(lead as ApiLead);
      const fallbackKey = `noid:${String(
        lead.customerId ??
          lead.phone ??
          lead.phoneNumber ??
          lead.mobile ??
          lead.mobileNumber ??
          lead.email ??
          lead.createdAt ??
          lead.createdDate ??
          "",
      )
        .trim()
        .toLowerCase()}`;
      const key = id || fallbackKey;
      if (byId.has(key)) continue;
      const typed = CRM_LEAD_TYPES.includes(lt as (typeof CRM_LEAD_TYPES)[number])
        ? (lt as (typeof CRM_LEAD_TYPES)[number])
        : "formlead";
      byId.set(key, { ...lead, leadType: typed });
    }
    const totalPages = Math.max(1, parseTotalPages(pageData));
    if (pageNum + 1 >= totalPages) break;
    if (chunk.length < searchSize) break;
  }
  const fromSearch = [...byId.values()];
  if (fromSearch.length > 0) return fromSearch;

  // Fallback: some deployments return empty from presales-search for exec JWT scope.
  // In that case, query filter flow across all lead types and merge.
  const fallbackById = new Map<string, ApiLead>();
  let noIdSeq = 0;
  const pageSize = 500;
  for (const leadType of CRM_LEAD_TYPES) {
    for (let pageNum = 0; pageNum < 200; pageNum += 1) {
      const upstream = new URL(`${BASE_URL}/v1/leads/filter`);
      upstream.searchParams.set("leadType", leadType);
      upstream.searchParams.set("page", String(pageNum));
      upstream.searchParams.set("size", String(pageSize));
      upstream.searchParams.set("sort", sort);
      if (search) upstream.searchParams.set("search", search);
      for (const key of LEADS_EXTRA_PARAMS) {
        const v = extraParamValue(url, key, effDates);
        if (v) upstream.searchParams.set(key, v);
      }
      const res = await fetch(upstream.toString(), {
        headers: upstreamAuthHeaders(req),
        cache: "no-store",
      });
      if (!res.ok) break;
      const pageData = (await res.json().catch(() => ({}))) as SpringPage<ApiLead>;
      const chunk = Array.isArray(pageData.content) ? pageData.content : [];
      if (chunk.length === 0) break;
      for (const lead of chunk) {
        const leadIdentifier = leadStableIdentifier(lead);
        const key = leadIdentifier || `fallback_noid_${noIdSeq++}`;
        if (fallbackById.has(key)) continue;
        fallbackById.set(key, { ...lead, leadType });
      }
      const totalPages = Math.max(1, Number(pageData.totalPages ?? 1));
      if (pageNum + 1 >= totalPages) break;
      if (chunk.length < pageSize) break;
    }
  }
  return [...fallbackById.values()];
}

function filterAndSortMergedLeads(
  leads: ApiLead[],
  url: URL,
  effDates: { from: string; to: string },
  usePresalesMilestoneFilters: boolean,
  search: string,
): ApiLead[] {
  const assignee = (url.searchParams.get("assignee") ?? "").trim().toLowerCase();
  const assigneeAliasSet = parseAssigneeAliasSetQuery(
    url.searchParams.get("assigneeAliasSet"),
  );
  const skipAssigneeSubstringFilter = assigneeAliasSet.length > 0;
  const mStage = (url.searchParams.get("milestoneStage") ?? "").trim();
  const mCat = (url.searchParams.get("milestoneStageCategory") ?? "").trim();
  const mSub = (url.searchParams.get("milestoneSubStage") ?? "").trim();
  const psStage = (url.searchParams.get("presalesMilestoneStage") ?? "").trim();
  const psCat = (url.searchParams.get("presalesMilestoneCategory") ?? "").trim();
  const psSub = (url.searchParams.get("presalesMilestoneSubStage") ?? "").trim();
  const dateFrom = effDates.from;
  const dateTo = effDates.to;
  const skipHubDateFilter = hubHandlesDateFilter({
    dateFrom,
    dateTo,
    dateField: url.searchParams.get("dateField"),
    crmMonthWindow: url.searchParams.get("crmMonthWindow"),
  });

  return leads
    .filter((lead) => {
      if (search) {
        const needle = search.toLowerCase();
        const needleDigits = search.replace(/\D/g, "");
        const assigneeText =
          typeof lead.assignee === "string"
            ? lead.assignee
            : (lead.assignee?.name ?? lead.assignee?.fullName ?? "");
        const dynamic =
          lead.dynamicFields && typeof lead.dynamicFields === "object" && !Array.isArray(lead.dynamicFields)
            ? (lead.dynamicFields as Record<string, unknown>)
            : {};
        const hay = [
          lead.name,
          lead.customerName,
          lead.companyName,
          lead.email,
          lead.phone,
          lead.phoneNumber,
          lead.mobile,
          lead.mobileNumber,
          lead.customerId,
          dynamic.customerName,
          dynamic.customerPhone,
          dynamic.phone,
          dynamic.customerEmail,
          assigneeText,
          leadStableIdentifier(lead),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesText = hay.includes(needle);

        const phoneLike = [
          lead.phone,
          lead.phoneNumber,
          lead.mobile,
          lead.mobileNumber,
          dynamic.customerPhone,
          dynamic.phone,
        ]
          .map((v) => String(v ?? "").replace(/\D/g, ""))
          .filter(Boolean)
          .join(" ");
        const matchesPhone = Boolean(needleDigits && phoneLike.includes(needleDigits));

        const deepHay = JSON.stringify(lead).toLowerCase();
        const matchesDeep = deepHay.includes(needle);
        if (!matchesText && !matchesPhone && !matchesDeep) return false;
      }

      if (assignee && !skipAssigneeSubstringFilter) {
        const a =
          (typeof lead.assignee === "string" ? lead.assignee : lead.assignee?.name) ??
          (typeof lead.salesOwner === "string" ? lead.salesOwner : lead.salesOwner?.name) ??
          "";
        if (!a.toLowerCase().includes(assignee)) return false;
      }

      const isWalkInRow = normalizeLeadTypeKey(lead.leadType) === "walkinlead";
      if (!skipHubDateFilter && !isWalkInRow && (dateFrom || dateTo)) {
        const dateFieldRaw = usePresalesMilestoneFilters
          ? (() => {
              const assignedTs = leadAssignedTimestampForPresalesMonthWindow(lead);
              return assignedTs > 0
                ? new Date(assignedTs).toISOString()
                : readLeadCreatedAtRaw(lead);
            })()
          : readLeadCreatedAtRaw(lead) || String(lead.updatedAt ?? "").trim();
        if (!inDateRange(dateFieldRaw, dateFrom, dateTo)) return false;
      }

      if (usePresalesMilestoneFilters) {
        if (
          (psStage || psCat || psSub) &&
          !leadMatchesWorkspaceMilestoneFilter(lead, "presales", psStage, psCat, psSub)
        ) {
          return false;
        }
      } else if (
        !isWalkInRow &&
        (mStage || mCat || mSub) &&
        !leadMatchesWorkspaceMilestoneFilter(lead, "sales", mStage, mCat, mSub)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => parseUpdatedAt(b) - parseUpdatedAt(a));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const effDates = effectiveDateRangeFromRequest(url);
  const mergeAll = url.searchParams.get("mergeAll") === "1";
  const roleView = (url.searchParams.get("roleView") ?? "").trim().toLowerCase();
  const page = url.searchParams.get("page") ?? "0";
  const size = url.searchParams.get("size") ?? "20";
  const sort = url.searchParams.get("sort") ?? "updatedAt,desc";
  const leadTypeParam = (url.searchParams.get("leadType") ?? "all").trim().toLowerCase();
  const search = (url.searchParams.get("search") ?? "").trim();
  const viewerRole = await resolveViewerRole(req);
  const milestoneScope = (url.searchParams.get("milestoneScope") ?? "").trim().toLowerCase();
  const newCrmGlobalSearch = (url.searchParams.get("newCrmGlobalSearch") ?? "").trim().toLowerCase() === "true";
  const viewerRoleKey = normalizeRole(viewerRole);
  const isNewCrmGlobalSearchMode =
    milestoneScope === "crm" &&
    newCrmGlobalSearch &&
    NEW_CRM_GLOBAL_SEARCH_ROLES.has(viewerRoleKey);
  const allowedLeadTypes = isNewCrmGlobalSearchMode
    ? [...CRM_LEAD_TYPES]
    : getAllowedLeadTypesForRole(viewerRoleKey);

  const leadPool = (url.searchParams.get("leadPool") ?? "").trim().toLowerCase();
  const usePresalesSearchPool = isPresalesRole(viewerRoleKey) || leadPool === "presales";
  const usePresalesMilestoneFilters = usePresalesSearchPool;
  const includePresalesInGlobalSearch =
    isNewCrmGlobalSearchMode &&
    viewerRoleKey === "SUPER_ADMIN" &&
    !usePresalesSearchPool &&
    search.length > 0;

  const managerEndpoint =
    roleView === "my" ? "/v1/leads/sales-manager/my-leads" : roleView === "team" ? "/v1/leads/sales-manager/team-leads" : "";

  if (!mergeAll && managerEndpoint) {
    const leadType = leadTypeParam === "all" ? "formlead" : leadTypeParam;
    if (!allowedLeadTypes.includes(leadType as (typeof CRM_LEAD_TYPES)[number])) {
      return NextResponse.json(
        { error: `${viewerRoleKey || "Current role"} cannot access ${leadType} in this view.` },
        { status: 403 }
      );
    }
    const upstream = new URL(`${BASE_URL}${managerEndpoint}`);
    upstream.searchParams.set("leadType", leadType);
    upstream.searchParams.set("page", page);
    upstream.searchParams.set("size", size);
    upstream.searchParams.set("sort", sort);
    if (search) upstream.searchParams.set("search", search);
    if (isNewCrmGlobalSearchMode) {
      upstream.searchParams.set("milestoneScope", "crm");
      upstream.searchParams.set("newCrmGlobalSearch", "true");
    }
    for (const key of LEADS_EXTRA_PARAMS) {
      const v = extraParamValue(url, key, effDates);
      if (v) upstream.searchParams.set(key, v);
    }

    const res = await fetch(upstream.toString(), { headers: upstreamAuthHeaders(req), cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  }

  if (!mergeAll && !managerEndpoint) {
    const leadType = leadTypeParam === "all" ? "formlead" : leadTypeParam;
    if (!allowedLeadTypes.includes(leadType as (typeof CRM_LEAD_TYPES)[number])) {
      return NextResponse.json(
        { error: `${viewerRoleKey || "Current role"} cannot access ${leadType} in filter flow.` },
        { status: 403 }
      );
    }
    const upstream = new URL(`${BASE_URL}/v1/leads/filter`);
    upstream.searchParams.set("leadType", leadType);
    upstream.searchParams.set("milestoneScope", "crm");
    if (isNewCrmGlobalSearchMode) {
      upstream.searchParams.set("newCrmGlobalSearch", "true");
    }
    upstream.searchParams.set("page", page);
    upstream.searchParams.set("size", size);
    upstream.searchParams.set("sort", sort);
    if (search) upstream.searchParams.set("search", search);
    const mStage = (url.searchParams.get("milestoneStage") ?? "").trim();
    const mSub = (url.searchParams.get("milestoneSubStage") ?? "").trim();
    if (mStage) upstream.searchParams.set("stage", mStage);
    if (mSub) upstream.searchParams.set("substage", mSub);
    for (const key of LEADS_EXTRA_PARAMS) {
      const v = extraParamValue(url, key, effDates);
      if (v) upstream.searchParams.set(key, v);
    }

    const res = await fetch(upstream.toString(), { headers: upstreamAuthHeaders(req), cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  }

  if (mergeAll && usePresalesSearchPool) {
    const presalesRows = await fetchPresalesSearchLeads(req, url, effDates, sort, search);
    const merged = filterAndSortMergedLeads(
      presalesRows,
      url,
      effDates,
      usePresalesMilestoneFilters,
      search,
    );
    const pageNum = Number.parseInt(page, 10) || 0;
    const pageSize = Number.parseInt(size, 10) || 20;
    const start = pageNum * pageSize;
    const slice = merged.slice(start, start + pageSize);
    const body: SpringPage<ApiLead> = {
      content: slice,
      totalElements: merged.length,
      totalPages: Math.max(1, Math.ceil(merged.length / pageSize)),
      number: pageNum,
      size: pageSize,
      sourceCounts: computeSourceCounts(merged),
      summaryTotals: computeSummaryTotals(merged),
    };
    return NextResponse.json(body);
  }

  const selectedTypes =
    leadTypeParam === "all"
      ? allowedLeadTypes
      : CRM_LEAD_TYPES.includes(leadTypeParam as (typeof CRM_LEAD_TYPES)[number])
        ? allowedLeadTypes.includes(leadTypeParam as (typeof CRM_LEAD_TYPES)[number])
          ? ([leadTypeParam] as (typeof CRM_LEAD_TYPES)[number][])
          : []
        : allowedLeadTypes;

  if (selectedTypes.length === 0) {
    return NextResponse.json(
      { error: `${viewerRoleKey || "Current role"} cannot access ${leadTypeParam || "this lead type"}.` },
      { status: 403 }
    );
  }

  const isPresalesPool = isPresalesRole(viewerRoleKey);
  const perType = isPresalesPool
    ? 1000
    : Math.min(500, Math.max(100, Number.parseInt(size, 10) * 25 || 200));
  const maxPagesPerType = isPresalesPool ? 200 : 100;
  const walkInExtraParams = LEADS_EXTRA_PARAMS.map((key) => ({
    key,
    value: extraParamValue(url, key, effDates),
  }));

  const fetches = selectedTypes.map(async (leadType) => {
    if (leadType === "walkinlead") {
      try {
        return await fetchWalkInLeadsForMerge({
          req,
          sort,
          search,
          effDates,
          extraParams: walkInExtraParams,
          perType,
          maxPages: maxPagesPerType,
        });
      } catch {
        return { leads: [] as ApiLead[], accessDenied: false };
      }
    }

    const buildUpstream = (pageNum: number) => {
      const upstream = new URL(`${BASE_URL}${managerEndpoint || "/v1/leads/filter"}`);
      upstream.searchParams.set("leadType", leadType);
      if (!managerEndpoint) upstream.searchParams.set("milestoneScope", "crm");
      if (!managerEndpoint && isNewCrmGlobalSearchMode) {
        upstream.searchParams.set("newCrmGlobalSearch", "true");
      }
      upstream.searchParams.set("page", String(pageNum));
      upstream.searchParams.set("size", String(perType));
      upstream.searchParams.set("sort", sort);
      if (search) upstream.searchParams.set("search", search);
      for (const key of LEADS_EXTRA_PARAMS) {
        const v = extraParamValue(url, key, effDates);
        if (v) upstream.searchParams.set(key, v);
      }
      // When hierarchy aliasSet is present, assignee param is empty on the request.
      // Extract the first alias as a display name hint and send to Hub so Hub
      // pre-filters server-side. UI filterLeadsByAssigneeScope still does
      // exact match after merge — this just reduces Hub returning unfiltered pool.
      const aliasSetRaw = (url.searchParams.get("assigneeAliasSet") ?? "").trim();
      const assigneeAlreadySet = (url.searchParams.get("assignee") ?? "").trim();
      if (aliasSetRaw && !assigneeAlreadySet) {
        const firstAlias = aliasSetRaw
          .split("\0")
          .map((s) => s.trim())
          .filter(Boolean)[0] ?? "";
        if (firstAlias) upstream.searchParams.set("assignee", firstAlias);
      }
      return upstream;
    };

    try {
      const allLeads: ApiLead[] = [];
      let accessDenied = false;
      let upstreamTotalPages = 1;
      for (let pageNum = 0; pageNum < maxPagesPerType; pageNum += 1) {
        const res = await fetch(buildUpstream(pageNum).toString(), {
          headers: upstreamAuthHeaders(req),
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 403) accessDenied = true;
          break;
        }
        const pageData = (await res.json()) as SpringPage<ApiLead>;
        upstreamTotalPages = Math.max(1, Number(pageData.totalPages ?? 1));
        const chunk = Array.isArray(pageData.content) ? pageData.content : [];
        if (chunk.length === 0) break;
        allLeads.push(...chunk);
        if (pageNum + 1 >= upstreamTotalPages) break;
        if (chunk.length < perType) break;
      }
      return { leads: allLeads, accessDenied };
    } catch {
      return { leads: [] as ApiLead[], accessDenied: false };
    }
  });

  const fetchResults = await Promise.all(fetches);
  const accessDeniedLeadTypes = fetchResults
    .map((r, i) => (r.accessDenied ? selectedTypes[i] : null))
    .filter((t): t is (typeof CRM_LEAD_TYPES)[number] => t !== null);
  const chunks = fetchResults.map((r) => r.leads);
  const byId = new Map<string, ApiLead>();
  for (let i = 0; i < chunks.length; i++) {
    const sourceType = selectedTypes[i];
    for (const lead of chunks[i]) {
      const id = leadStableIdentifier(lead);
      if (!id) continue;
      if (!byId.has(id)) {
        byId.set(id, {
          ...lead,
          leadType: normalizeLeadTypeKey(lead.leadType ?? sourceType),
        });
      }
    }
  }
  if (includePresalesInGlobalSearch) {
    const presalesRows = await fetchPresalesSearchLeads(req, url, effDates, sort, search);
    for (const lead of presalesRows) {
      const id = leadStableIdentifier(lead);
      if (!id || byId.has(id)) continue;
      byId.set(id, lead);
    }
  }

  const merged = filterAndSortMergedLeads(
    [...byId.values()],
    url,
    effDates,
    usePresalesMilestoneFilters,
    search,
  );

  const pageNum = Number.parseInt(page, 10) || 0;
  const pageSize = Number.parseInt(size, 10) || 20;
  const start = pageNum * pageSize;
  const slice = merged.slice(start, start + pageSize);
  const totalElements = merged.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const sourceCounts = computeSourceCounts(merged);
  const summaryTotals = computeSummaryTotals(merged);

  const body: SpringPage<ApiLead> = {
    content: slice,
    totalElements,
    totalPages,
    number: pageNum,
    size: pageSize,
    sourceCounts,
    summaryTotals,
    ...(accessDeniedLeadTypes.length > 0
      ? { accessDeniedLeadTypes: [...new Set(accessDeniedLeadTypes)] }
      : {}),
  };

  return NextResponse.json(body);
}
