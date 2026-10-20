import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { normalizeRole } from "@/lib/auth/api";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { recordsFromMeetingsBoard } from "@/lib/meeting-management-api";

export const maxDuration = 30;

function scopeForRole(role: string): "all" | "team" | "own" {
  const normalized = normalizeRole(role);
  if (normalized === "SUPER_ADMIN" || normalized === "ADMIN" || normalized === "SALES_ADMIN") return "all";
  if (normalized === "SALES_MANAGER") return "team";
  return "own";
}

function readCount(value: unknown): number | undefined {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count >= 0 ? count : undefined;
}

function upstreamMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as Record<string, unknown>;
  const message = row.message ?? row.error ?? row.userMessage;
  return typeof message === "string" && message.trim() ? message.trim() : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const role = normalizeRole(req.nextUrl.searchParams.get("role") ?? "");
    const username = (req.nextUrl.searchParams.get("username") ?? "").trim();
    const url = new URL(`${BASE_URL}/v1/meetings/board`);
    if (role) url.searchParams.set("role", role);
    if (username) url.searchParams.set("username", username);
    url.searchParams.set("scope", scopeForRole(role));
    for (const key of ["from", "to", "page", "pageSize"] as const) {
      const value = (req.nextUrl.searchParams.get(key) ?? "").trim();
      if (value) url.searchParams.set(key, value);
    }
    for (const key of ["designerName", "salesName", "branch", "progress"] as const) {
      for (const value of req.nextUrl.searchParams.getAll(key)) {
        const text = value.trim();
        if (text) url.searchParams.append(key, text);
      }
    }

    const res = await fetch(url, {
      headers: { ...upstreamAuthHeaders(req), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let payload: unknown = {};
    if (text.trim()) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = {};
      }
    }
    if (!res.ok) {
      const fallback =
        res.status === 401
          ? "Unauthorized"
          : res.status === 403
            ? "Not allowed for this scope"
            : `Could not load meetings (${url.host} returned ${res.status}).`;
      const message = upstreamMessage(payload, fallback);
      if (res.status !== 401) {
        const keys =
          payload && typeof payload === "object" ? Object.keys(payload as Record<string, unknown>).join(",") : "";
        console.error(
          "[meetings/board] upstream",
          url.origin + url.pathname,
          res.status,
          res.headers.get("content-type") ?? "",
          keys,
          text.replace(/\s+/g, " ").slice(0, 700),
        );
      }
      return NextResponse.json({ success: false, error: message }, { status: res.status });
    }

    const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const nested =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : body;
    const mapped = recordsFromMeetingsBoard(
      nested.meetings ?? body.meetings,
      nested.quoteSentLeads ?? body.quoteSentLeads,
    );
    const total = readCount(nested.total ?? body.total) ?? mapped.total;
    const page = readCount(nested.page ?? body.page) ?? mapped.page;
    const pageSize = readCount(nested.pageSize ?? body.pageSize) ?? mapped.pageSize;
    return NextResponse.json({ ...mapped, total, page, pageSize });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    console.error("[meetings/board]", BASE_URL, detail || "Could not load meetings.");
    return NextResponse.json(
      { success: false, error: detail ? `Could not load meetings. ${detail}` : "Could not load meetings." },
      { status: 500 },
    );
  }
}
