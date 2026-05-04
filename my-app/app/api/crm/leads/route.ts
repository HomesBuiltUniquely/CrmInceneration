import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { getAllowedLeadTypesForRole } from "@/lib/crm-role-access";
import { getRoleFromUser, normalizeRole, unwrapAuthUserPayload } from "@/lib/auth/api";
import { getLocalMonthRangeIsoDates } from "@/lib/presales-heatmap-helpers";

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

function inDateRange(
  updatedAt: string | null | undefined,
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  const ts = updatedAt ? Date.parse(updatedAt) : Number.NaN;
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

  const extraParams = [
    "stage",
    "substage",
    "result",
    "dateFrom",
    "dateTo",
    "assignee",
    "milestoneStage",
    "milestoneStageCategory",
    "milestoneSubStage",
    "verificationStatus",
    "reinquiry",
  ] as const;

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
    for (const key of extraParams) {
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
    for (const key of extraParams) {
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

  const perType = Math.min(500, Math.max(100, Number.parseInt(size, 10) * 25 || 200));
  const fetches = selectedTypes.map(async (leadType) => {
    const upstream = new URL(`${BASE_URL}${managerEndpoint || "/v1/leads/filter"}`);
    upstream.searchParams.set("leadType", leadType);
    if (!managerEndpoint) upstream.searchParams.set("milestoneScope", "crm");
    if (!managerEndpoint && isNewCrmGlobalSearchMode) {
      upstream.searchParams.set("newCrmGlobalSearch", "true");
    }
    upstream.searchParams.set("page", "0");
    upstream.searchParams.set("size", String(perType));
    upstream.searchParams.set("sort", sort);
    if (search) upstream.searchParams.set("search", search);
    for (const key of extraParams) {
      const v = extraParamValue(url, key, effDates);
      if (v) upstream.searchParams.set(key, v);
    }
    try {
      const res = await fetch(upstream.toString(), { headers: upstreamAuthHeaders(req), cache: "no-store" });
      if (!res.ok) return [] as ApiLead[];
      const data = (await res.json()) as SpringPage<ApiLead>;
      return Array.isArray(data.content) ? data.content : [];
    } catch {
      return [] as ApiLead[];
    }
  });

  const chunks = await Promise.all(fetches);
  const byId = new Map<string, ApiLead>();
  for (let i = 0; i < chunks.length; i++) {
    const sourceType = selectedTypes[i];
    for (const lead of chunks[i]) {
      const id = lead.id !== undefined && lead.id !== null ? String(lead.id) : "";
      if (!id) continue;
      if (!byId.has(id)) {
        byId.set(id, { ...lead, leadType: sourceType });
      }
    }
  }

  const assignee = (url.searchParams.get("assignee") ?? "").trim().toLowerCase();
  const mStage = (url.searchParams.get("milestoneStage") ?? "").trim();
  const mCat = (url.searchParams.get("milestoneStageCategory") ?? "").trim();
  const mSub = (url.searchParams.get("milestoneSubStage") ?? "").trim();
  const dateFrom = effDates.from;
  const dateTo = effDates.to;

  const merged = [...byId.values()]
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
          lead.id !== undefined && lead.id !== null ? String(lead.id) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (hay.includes(needle)) return true;

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
        if (needleDigits && phoneLike.includes(needleDigits)) return true;

        // Global visible-record fallback search for old/new CRM parity.
        const deepHay = JSON.stringify(lead).toLowerCase();
        if (deepHay.includes(needle)) return true;
        return false;
      }

      if (assignee) {
        const a =
          (typeof lead.assignee === "string" ? lead.assignee : lead.assignee?.name) ??
          (typeof lead.salesOwner === "string" ? lead.salesOwner : lead.salesOwner?.name) ??
          "";
        if (!a.toLowerCase().includes(assignee)) return false;
      }

      if (!inDateRange(lead.updatedAt, dateFrom, dateTo)) return false;

      if (mStage && norm(lead.stage?.milestoneStage) !== norm(mStage)) return false;
      if (mCat && norm(lead.stage?.milestoneStageCategory) !== norm(mCat)) return false;
      if (mSub && norm(lead.stage?.milestoneSubStage) !== norm(mSub)) return false;
      return true;
    })
    .sort((a, b) => parseUpdatedAt(b) - parseUpdatedAt(a));

  const pageNum = Number.parseInt(page, 10) || 0;
  const pageSize = Number.parseInt(size, 10) || 20;
  const start = pageNum * pageSize;
  const slice = merged.slice(start, start + pageSize);
  const totalElements = merged.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));

  const body: SpringPage<ApiLead> = {
    content: slice,
    totalElements,
    totalPages,
    number: pageNum,
    size: pageSize,
  };

  return NextResponse.json(body);
}
