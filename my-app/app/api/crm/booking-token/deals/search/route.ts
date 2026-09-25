import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { applyResolvedListingType } from "@/lib/booking-token-listing-type";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/**
 * GET /api/crm/booking-token/deals/search?q=&page=&size=
 * → Hub GET /v1/booking-token/deals/search
 *
 * Prefer Hub `listingType` on search hits (hand off badges). Dashboard remap
 * that ignores Hub token/booking labels would mis-badge global results.
 */
function applySearchListingType<
  T extends {
    bookingStatus?: string;
    paymentKind?: string | null;
    remainingAmount?: number | null;
    listingType?: string | null;
  },
>(deal: T): T {
  const fromHub = deal.listingType?.trim().toLowerCase();
  if (fromHub === "token" || fromHub === "booking" || fromHub === "cancel") {
    return { ...deal, listingType: fromHub };
  }
  return applyResolvedListingType({
    ...deal,
    bookingStatus: deal.bookingStatus ?? "",
  });
}

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const url = `${BASE_URL}/v1/booking-token/deals/search${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to run booking global search.");
    }

    try {
      const body = JSON.parse(payload.text) as {
        deals?: Array<{
          bookingStatus?: string;
          paymentKind?: string | null;
          remainingAmount?: number | null;
          listingType?: string | null;
        }>;
      };
      if (Array.isArray(body.deals)) {
        body.deals = body.deals.map((deal) => applySearchListingType(deal));
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
        error: "Unable to run booking global search.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
