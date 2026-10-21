import { mergeCustomerDiscountIntoShareResponse } from "@/lib/prolance-quote-api";
import { NextRequest, NextResponse } from "next/server";

const EXTERNAL_API_BASE = (
  process.env.NEXT_PUBLIC_API?.trim() || "https://api.hubinterior.com"
).replace(/\/+$/, "");

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const id = quoteId.trim();
  if (!id) {
    return NextResponse.json({ message: "quoteId is required" }, { status: 400 });
  }

  const encoded = encodeURIComponent(id);
  const [shareRes, hubRes, revisionRes] = await Promise.all([
    fetch(`${EXTERNAL_API_BASE}/api/prolance-test/quotes/share/${encoded}`, {
      cache: "no-store",
    }),
    fetch(`${EXTERNAL_API_BASE}/api/prolance-test/public/quotes/${encoded}/hub-discount`, {
      cache: "no-store",
    }).catch(() => null),
    fetch(`${EXTERNAL_API_BASE}/api/prolance-test/public/quote-revisions/${encoded}`, {
      cache: "no-store",
    }).catch(() => null),
  ]);

  const sharePayload = await readJson(shareRes);
  if (!shareRes.ok) {
    return NextResponse.json(sharePayload, { status: shareRes.status });
  }

  const [hubPayload, revisionPayload] = await Promise.all([
    hubRes && hubRes.ok ? readJson(hubRes) : Promise.resolve({}),
    revisionRes && revisionRes.ok ? readJson(revisionRes) : Promise.resolve({}),
  ]);

  return NextResponse.json(
    mergeCustomerDiscountIntoShareResponse(sharePayload, hubPayload, revisionPayload),
  );
}
