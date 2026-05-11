import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { getAllowedLeadTypesForRole } from "@/lib/crm-role-access";
import { getRoleFromUser, normalizeRole, unwrapAuthUserPayload } from "@/lib/auth/api";
import { getLocalMonthRangeIsoDates } from "@/lib/presales-heatmap-helpers";
import { getEffectiveNewCrmEndDate, getEffectiveNewCrmStartDate } from "@/lib/new-crm-cutoff";

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
  if (effDates.from) upstream.searchParams.set("dateFrom", effDates.from);
  if (effDates.to) upstream.searchParams.set("dateTo", effDates.to);
  if (milestoneStage) upstream.searchParams.set("milestoneStage", milestoneStage);
  if (milestoneStageCategory) upstream.searchParams.set("milestoneStageCategory", milestoneStageCategory);
  if (milestoneSubStage) upstream.searchParams.set("milestoneSubStage", milestoneSubStage);
  if (verificationStatus) upstream.searchParams.set("verificationStatus", verificationStatus);
  if (reinquiry) upstream.searchParams.set("reinquiry", reinquiry);

  return upstream;
}

async function countLeadType(
  req: NextRequest,
  reqUrl: URL,
  leadType: string,
  assigneeScopes: string[],
  effDates: { from: string; to: string },
): Promise<number> {
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
