import type { NextRequest } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import {
  getNameFromUser,
  getRoleFromUser,
  normalizeRole,
  unwrapAuthUserPayload,
} from "@/lib/auth/api";
import { isUserActive } from "@/lib/user-active";
import { viewerContextFromAuthUser } from "@/lib/sales-executive-followup-day-brief";

export type CrmAuthViewer = {
  role: string;
  active: boolean;
  displayName: string;
  user: Record<string, unknown>;
  viewerContext: ReturnType<typeof viewerContextFromAuthUser>;
};

export async function resolveCrmAuthViewer(req: NextRequest): Promise<CrmAuthViewer | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const user = unwrapAuthUserPayload(json);
    const role = normalizeRole(getRoleFromUser(user));
    const displayName = getNameFromUser(user);
    return {
      role,
      active: isUserActive(user as { active?: boolean; isActive?: boolean }),
      displayName,
      user,
      viewerContext: viewerContextFromAuthUser({
        ...user,
        fullName: user.fullName ?? displayName,
      }),
    };
  } catch {
    return null;
  }
}