import { NextRequest, NextResponse } from "next/server";

const EXTERNAL_API_BASE = (
  process.env.NEXT_PUBLIC_API?.trim() || "https://api.hubinterior.com"
).replace(/\/+$/, "");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const id = quoteId.trim();
  if (!id) {
    return NextResponse.json({ message: "quoteId is required" }, { status: 400 });
  }

  const res = await fetch(
    `${EXTERNAL_API_BASE}/api/prolance-test/public/quote-revisions/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
