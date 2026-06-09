import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { normalizeRole } from "@/lib/auth/api";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BLOCK_MESSAGE =
  "Your presales account is inactive. Contact your manager or admin.";

function isPresalesRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "PRESALES_EXECUTIVE" || r === "PRESALES_MANAGER";
}

function rowIsInactive(row: Record<string, unknown>): boolean {
  if (row.active === false || row.isActive === false || row.enabled === false) return true;
  const s = String(row.active ?? row.isActive ?? row.enabled ?? "").trim().toLowerCase();
  return s === "false" || s === "0" || s === "inactive";
}

function rowIsActive(row: Record<string, unknown>): boolean {
  return !rowIsInactive(row);
}

async function fetchMe(req: NextRequest): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const user = data.user;
  if (user && typeof user === "object" && !Array.isArray(user)) {
    return user as Record<string, unknown>;
  }
  return data;
}

async function fetchRows(req: NextRequest, url: string): Promise<Record<string, unknown>[] | null> {
  const res = await fetch(url, { cache: "no-store", headers: upstreamAuthHeaders(req) });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as unknown;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: Record<string, unknown>[] }).data;
  }
  return null;
}

function blockResponse(reason: string) {
  return NextResponse.json({
    allowed: false,
    reason,
    message: BLOCK_MESSAGE,
  });
}

/** Frontend session gate for inactive presales users (until Hub blocks login). */
export async function GET(req: NextRequest) {
  const me = await fetchMe(req);
  if (!me) {
    return NextResponse.json({ allowed: true, reason: "me_unavailable" });
  }

  const role = normalizeRole(String(me.role ?? me.userRole ?? me.authority ?? ""));
  const userId = Number(me.id ?? me.userId ?? 0);
  if (!isPresalesRole(role) || userId <= 0) {
    return NextResponse.json({ allowed: true, reason: "not_presales" });
  }

  if (rowIsInactive(me)) {
    return blockResponse("auth_user_inactive");
  }

  const byIdRes = await fetch(`${BASE_URL}/api/admin/pre-sales/${userId}`, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  if (byIdRes.ok) {
    const row = (await byIdRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (rowIsInactive(row)) return blockResponse("pre_sales_record_inactive");
    return NextResponse.json({ allowed: true, reason: "pre_sales_record_active" });
  }

  const pool = await fetchRows(req, `${BASE_URL}/api/admin/pre-sales`);
  if (pool) {
    const row = pool.find((r) => Number(r.id ?? r.userId ?? 0) === userId);
    if (row) {
      if (rowIsInactive(row)) return blockResponse("pre_sales_pool_inactive");
      return NextResponse.json({ allowed: true, reason: "pre_sales_pool_active" });
    }
  }

  const roleQueries =
    role === "PRESALES_MANAGER"
      ? ["PRESALES_MANAGER"]
      : ["PRESALES_EXECUTIVE", "PRE_SALES"];

  for (const rq of roleQueries) {
    const rows = await fetchRows(
      req,
      `${BASE_URL}/api/auth/users-by-role?role=${encodeURIComponent(rq)}`,
    );
    if (!rows || rows.length === 0) continue;
    const row = rows.find((r) => Number(r.id ?? r.userId ?? 0) === userId);
    if (row) {
      if (rowIsInactive(row)) return blockResponse("role_directory_inactive");
      return NextResponse.json({ allowed: true, reason: "role_directory_active" });
    }
    // Directory returned rows but this user is absent — Hub often omits inactive users.
    return blockResponse("absent_from_role_directory");
  }

  return NextResponse.json({ allowed: true, reason: "unable_to_verify" });
}
