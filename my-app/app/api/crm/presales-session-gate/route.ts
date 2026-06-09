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
  const s = String(row.active ?? row.isActive ?? row.enabled ?? "")
    .trim()
    .toLowerCase();
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
  const user =
    data.user && typeof data.user === "object"
      ? (data.user as Record<string, unknown>)
      : data;
  return user;
}

async function fetchRows(req: NextRequest, url: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(url, { cache: "no-store", headers: upstreamAuthHeaders(req) });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as unknown;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "content", "items", "users", "rows"]) {
      const candidate = obj[key];
      if (Array.isArray(candidate)) return candidate as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function blockResponse(reason: string) {
  return NextResponse.json({ allowed: false, reason, message: BLOCK_MESSAGE }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const me = await fetchMe(req);
  if (!me) {
    return NextResponse.json({ allowed: false, message: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeRole(String(me.role ?? me.userRole ?? me.authority ?? ""));
  if (!isPresalesRole(role)) {
    return NextResponse.json({ allowed: true, skipped: true });
  }

  if (rowIsInactive(me)) {
    return blockResponse("auth_me_inactive");
  }

  const userId = Number(me.id ?? 0);
  if (userId <= 0) {
    return NextResponse.json({ allowed: true, warning: "missing_user_id" });
  }

  const byIdRes = await fetch(`${BASE_URL}/api/admin/pre-sales/${userId}`, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  if (byIdRes.ok) {
    const row = (await byIdRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (rowIsInactive(row)) return blockResponse("pre_sales_record_inactive");
  }

  const pool = await fetchRows(req, `${BASE_URL}/api/admin/pre-sales`);
  const inPool = pool.find((row) => Number(row.id ?? 0) === userId);
  if (inPool) {
    if (rowIsInactive(inPool)) return blockResponse("pre_sales_pool_inactive");
    return NextResponse.json({ allowed: true });
  }

  const roleQuery =
    role === "PRESALES_MANAGER" ? "PRESALES_MANAGER" : "PRESALES_EXECUTIVE";
  const byRole = await fetchRows(
    req,
    `${BASE_URL}/api/auth/users-by-role?role=${encodeURIComponent(roleQuery)}`,
  );
  const inRoleList = byRole.find((row) => Number(row.id ?? 0) === userId);
  if (inRoleList) {
    if (rowIsInactive(inRoleList)) return blockResponse("role_directory_inactive");
    return NextResponse.json({ allowed: true });
  }

  return blockResponse("presales_user_not_found");
}
