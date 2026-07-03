import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { getAllowedLeadTypesForRole } from "@/lib/crm-role-access";
import { getRoleFromUser, normalizeRole, unwrapAuthUserPayload } from "@/lib/auth/api";
import { getLocalMonthRangeIsoDates } from "@/lib/presales-heatmap-helpers";
import { getEffectiveNewCrmEndDate, getEffectiveNewCrmStartDate } from "@/lib/new-crm-cutoff";
import { appendCrmDateFilters, hubHandlesDateFilter } from "@/lib/crm-date-field-filter";
import { fetchWalkInLeadsForMerge } from "@/lib/crm-walkin-leads";
import { fetchWhatsappLeadsForMerge } from "@/lib/crm-whatsapp-leads";
import { readLeadCreatedAtRaw } from "@/lib/lead-follow-up-insights";

type SourceCountsResponse = Record<"all" | (typeof CRM_LEAD_TYPES)[number], number>;

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

function effectiveDateRangeFromRequest(url: URL): { from: string; to: string } {
  const rawFrom = (url.searchParams.get("dateFrom") ?? "").trim();
  const rawTo = (url.searchParams.get("dateTo") ?? "").trim();
  const win = (url.searchParams.get("crmMonthWindow") ?? "").trim().toLowerCase();
  const monthRange = !rawFrom && !rawTo && win === "current" ? getLocalMonthRangeIsoDates() : null;
  const baseFrom = rawFrom || monthRange?.from || "";
  const baseTo = rawTo || monthRange?.to || "";
  return {
    from: getEffectiveNewCrmStartDate(baseFrom) ?? "",
    to: getEffectiveNewCrmEndDate(baseFrom, baseTo) ?? "",
  };
}

function buildUpstreamUrl(
  reqUrl: URL,
  leadType: string,
  assignee: string,
  page: number,
  pageSize: number,
  effDates: { from: string; to: string },
): URL {
  const upstream = new URL(`${BASE_URL}/v1/leads/filter`);
  upstream.searchParams.set("leadType", leadType);
  upstream.searchParams.set("milestoneScope", "crm");
  upstream.searchParams.set("page", String(page));
  upstream.searchParams.set("size", String(pageSize));
  upstream.searchParams.set("sort", (reqUrl.searchParams.get("sort") ?? "updatedAt,desc").trim() || "updatedAt,desc");

  const search = (reqUrl.searchParams.get("search") ?? "").trim();
  const milestoneStage = (reqUrl.searchParams.get("milestoneStage") ?? "").trim();
  const milestoneStageCategory = (reqUrl.searchParams.get("milestoneStageCategory") ?? "").trim();
  const milestoneSubStage = (reqUrl.searchParams.get("milestoneSubStage") ?? "").trim();
  const verificationStatus = (reqUrl.searchParams.get("verificationStatus") ?? "").trim();
  const reinquiry = (reqUrl.searchParams.get("reinquiry") ?? "").trim();

  if (search) upstream.searchParams.set("search", search);
  if (assignee) upstream.searchParams.set("assignee", assignee);
  appendCrmDateFilters(upstream.searchParams, {
    dateFrom: effDates.from,
    dateTo: effDates.to,
    dateField: reqUrl.searchParams.get("dateField"),
    crmMonthWindow: reqUrl.searchParams.get("crmMonthWindow"),
  });
  if (milestoneStage) upstream.searchParams.set("milestoneStage", milestoneStage);
  if (milestoneStageCategory) upstream.searchParams.set("milestoneStageCategory", milestoneStageCategory);
  if (milestoneSubStage) upstream.searchParams.set("milestoneSubStage", milestoneSubStage);
  if (verificationStatus) upstream.searchParams.set("verificationStatus", verificationStatus);
  if (reinquiry) upstream.searchParams.set("reinquiry", reinquiry);

  return upstream;
}

function leadInCreatedDateRange(lead: ApiLead, from: string, to: string): boolean {
  if (!from && !to) return true;
  const raw = readLeadCreatedAtRaw(lead) || String(lead.updatedAt ?? "").trim();
  if (!raw) return false;
  const ts = Date.parse(raw);
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

async function countLeadType(
  req: NextRequest,
  reqUrl: URL,
  leadType: string,
  assigneeScopes: string[],
  effDates: { from: string; to: string },
): Promise<number> {
  if (leadType === "walkinlead") {
    const sort = (reqUrl.searchParams.get("sort") ?? "updatedAt,desc").trim() || "updatedAt,desc";
    const search = (reqUrl.searchParams.get("search") ?? "").trim();
    const extraParams = [
      { key: "milestoneStage", value: (reqUrl.searchParams.get("milestoneStage") ?? "").trim() },
      {
        key: "milestoneStageCategory",
        value: (reqUrl.searchParams.get("milestoneStageCategory") ?? "").trim(),
      },
      { key: "milestoneSubStage", value: (reqUrl.searchParams.get("milestoneSubStage") ?? "").trim() },
      { key: "verificationStatus", value: (reqUrl.searchParams.get("verificationStatus") ?? "").trim() },
      { key: "reinquiry", value: (reqUrl.searchParams.get("reinquiry") ?? "").trim() },
      { key: "assignee", value: (reqUrl.searchParams.get("assignee") ?? "").trim() },
      { key: "dateFrom", value: effDates.from },
      { key: "dateTo", value: effDates.to },
      { key: "dateField", value: (reqUrl.searchParams.get("dateField") ?? "").trim() },
    ];
    const fetchCtx = {
      req,
      sort,
      search,
      effDates,
      extraParams,
      perType: 500,
      maxPages: 100,
    };
    const { leads } = await fetchWalkInLeadsForMerge(fetchCtx);
    const skipLocalDateFilter = hubHandlesDateFilter({
      dateFrom: effDates.from,
      dateTo: effDates.to,
      dateField: reqUrl.searchParams.get("dateField"),
      crmMonthWindow: reqUrl.searchParams.get("crmMonthWindow"),
    });
    const assigneeNorms = assigneeScopes.map((a) => a.trim().toLowerCase()).filter(Boolean);
    const ids = new Set<string>();
    for (const lead of leads) {
      if (!skipLocalDateFilter && !leadInCreatedDateRange(lead, effDates.from, effDates.to)) continue;
      if (assigneeNorms.length > 0) {
        const assigneeText =
          typeof lead.assignee === "string"
            ? lead.assignee
            : (lead.assignee?.name ?? lead.assignee?.fullName ?? "");
        const hay = assigneeText.trim().toLowerCase();
        if (!assigneeNorms.some((a) => hay.includes(a))) continue;
      }
      const id = String(lead.id ?? "").trim();
      if (id) ids.add(id);
    }
    return ids.size;
  }

  if (leadType === "whatsapplead") {
    const sort = (reqUrl.searchParams.get("sort") ?? "updatedAt,desc").trim() || "updatedAt,desc";
    const search = (reqUrl.searchParams.get("search") ?? "").trim();
    const extraParams = [
      { key: "milestoneStage", value: (reqUrl.searchParams.get("milestoneStage") ?? "").trim() },
      {
        key: "milestoneStageCategory",
        value: (reqUrl.searchParams.get("milestoneStageCategory") ?? "").trim(),
      },
      { key: "milestoneSubStage", value: (reqUrl.searchParams.get("milestoneSubStage") ?? "").trim() },
      {
        key: "presalesMilestoneStage",
        value: (reqUrl.searchParams.get("presalesMilestoneStage") ?? "").trim(),
      },
      {
        key: "presalesMilestoneCategory",
        value: (reqUrl.searchParams.get("presalesMilestoneCategory") ?? "").trim(),
      },
      {
        key: "presalesMilestoneSubStage",
        value: (reqUrl.searchParams.get("presalesMilestoneSubStage") ?? "").trim(),
      },
      { key: "verificationStatus", value: (reqUrl.searchParams.get("verificationStatus") ?? "").trim() },
      { key: "reinquiry", value: (reqUrl.searchParams.get("reinquiry") ?? "").trim() },
      { key: "assignee", value: (reqUrl.searchParams.get("assignee") ?? "").trim() },
      { key: "dateFrom", value: effDates.from },
      { key: "dateTo", value: effDates.to },
      { key: "dateField", value: (reqUrl.searchParams.get("dateField") ?? "").trim() },
    ];
    const fetchCtx = {
      req,
      sort,
      search,
      effDates,
      extraParams,
      perType: 500,
      maxPages: 100,
    };
    const { leads } = await fetchWhatsappLeadsForMerge(fetchCtx);
    const skipLocalDateFilter = hubHandlesDateFilter({
      dateFrom: effDates.from,
      dateTo: effDates.to,
      dateField: reqUrl.searchParams.get("dateField"),
      crmMonthWindow: reqUrl.searchParams.get("crmMonthWindow"),
    });
    const assigneeNorms = assigneeScopes.map((a) => a.trim().toLowerCase()).filter(Boolean);
    const ids = new Set<string>();
    for (const lead of leads) {
      if (!skipLocalDateFilter && !leadInCreatedDateRange(lead, effDates.from, effDates.to)) continue;
      if (assigneeNorms.length > 0) {
        const assigneeText =
          typeof lead.assignee === "string"
            ? lead.assignee
            : (lead.assignee?.name ?? lead.assignee?.fullName ?? "");
        const hay = assigneeText.trim().toLowerCase();
        if (!assigneeNorms.some((a) => hay.includes(a))) continue;
      }
      const id = String(lead.id ?? "").trim();
      if (id) ids.add(id);
    }
    return ids.size;
  }

  const pageSize = 500;
  const scopes = assigneeScopes.length > 0 ? assigneeScopes : [""];
  const ids = new Set<string>();

  for (const assignee of scopes) {
    for (let page = 0; page < 100; page += 1) {
      const upstream = buildUpstreamUrl(reqUrl, leadType, assignee, page, pageSize, effDates);
      const res = await fetch(upstream.toString(), {
        headers: upstreamAuthHeaders(req),
        cache: "no-store",
      });
      if (!res.ok) break;
      const json = (await res.json()) as SpringPage<ApiLead>;
      const content = Array.isArray(json.content) ? json.content : [];
      if (content.length === 0) break;
      for (const lead of content) {
        const id = String(lead.id ?? "").trim();
        if (!id) continue;
        ids.add(id);
      }
      if (content.length < pageSize) break;
    }
  }

  return ids.size;
}

export async function GET(req: NextRequest) {
  const reqUrl = new URL(req.url);
  const viewerRole = await resolveViewerRole(req);
  const viewerRoleKey = normalizeRole(viewerRole);
  const allowedLeadTypes = getAllowedLeadTypesForRole(viewerRoleKey);
  const requestedLeadType = (reqUrl.searchParams.get("leadType") ?? "all").trim().toLowerCase();
  const effDates = effectiveDateRangeFromRequest(reqUrl);
  const assigneeScopes = [
    ...new Set(
      (reqUrl.searchParams.get("assignees") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const directAssignee = (reqUrl.searchParams.get("assignee") ?? "").trim();
  if (assigneeScopes.length === 0 && directAssignee) assigneeScopes.push(directAssignee);

  const counts: SourceCountsResponse = {
    all: 0,
    formlead: 0,
    glead: 0,
    mlead: 0,
    addlead: 0,
    websitelead: 0,
    walkinlead: 0,
    whatsapplead: 0,
  };

  const selectedTypes =
    requestedLeadType && requestedLeadType !== "all"
      ? CRM_LEAD_TYPES.filter((leadType) => leadType === requestedLeadType)
      : [...CRM_LEAD_TYPES];

  const results = await Promise.all(
    selectedTypes.map(async (leadType) => {
      if (!allowedLeadTypes.includes(leadType)) return [leadType, 0] as const;
      const count = await countLeadType(req, reqUrl, leadType, assigneeScopes, effDates);
      return [leadType, count] as const;
    }),
  );

  for (const [leadType, count] of results) {
    counts[leadType] = count;
    counts.all += count;
  }

  return NextResponse.json(counts);
}
