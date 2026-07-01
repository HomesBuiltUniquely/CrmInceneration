import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { applyResolvedListingType } from "@/lib/booking-token-listing-type";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const url = `${BASE_URL}/v1/booking-token/deals${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to load booking deals.");
    }

    try {
      const body = JSON.parse(payload.text) as {
        deals?: Array<{
          bookingStatus: string;
          paymentKind?: string | null;
          remainingAmount?: number | null;
          listingType?: string | null;
        }>;
      };
      if (Array.isArray(body.deals)) {
        body.deals = body.deals.map((deal) => applyResolvedListingType(deal));
        return NextResponse.json(body, { status: res.status });
      }
    } catch {
      /* return raw upstream body */
    }

    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load booking deals.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
