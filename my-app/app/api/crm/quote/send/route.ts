import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081";

/** Proxies `POST /v1/quote/send` (multipart/form-data). */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const res = await fetch(`${BASE}/v1/quote/send`, {
    method: "POST",
    headers: upstreamAuthHeaders(req),
    body: formData,
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
