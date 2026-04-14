import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

/** Proxies `POST /v1/quote/send` (multipart/form-data). */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const res = await fetch(`${BASE_URL}/v1/quote/send`, {
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
