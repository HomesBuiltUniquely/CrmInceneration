import { NextRequest, NextResponse } from "next/server";
import { applyResolvedListingType } from "@/lib/booking-token-listing-type";
import { bookingPaymentSubmitJsonUpstreamCandidates } from "@/lib/booking-payment-upstream";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { isBookingDoneNotDeployedResponse } from "@/lib/booking-done-upstream";

export const maxDuration = 60;

/**
 * Preferred Save payment upload through Vercel BFF.
 * Forwards JSON + base64 as-is — never converts to multipart (avoids Tomcat parse 400s).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;

    const contentType = (req.headers.get("content-type") ?? "").trim().toLowerCase();
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment JSON body is required.",
          debugMessage: `Expected application/json, got: ${contentType || "(none)"}`,
        },
        { status: 400 },
      );
    }

    const bodyText = await req.text();
    if (!bodyText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment body is required.",
          debugMessage: "Empty JSON body from client",
        },
        { status: 400 },
      );
    }

    const headers = new Headers(upstreamAuthHeaders(req));
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    headers.delete("content-length");

    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;
    let lastUrl = "";

    for (const url of bookingPaymentSubmitJsonUpstreamCandidates(recordId)) {
      lastUrl = url;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: bodyText,
        cache: "no-store",
      });
      const payload = await readUpstreamPayload(res);
      lastPayload = payload;
      lastStatus = res.status;

      if (res.ok) {
        try {
          const body = JSON.parse(payload.text) as {
            bookingStatus?: string;
            paymentKind?: string | null;
            remainingAmount?: number | null;
            listingType?: string | null;
          };
          const normalized = applyResolvedListingType({
            bookingStatus: body.bookingStatus ?? "in_progress",
            paymentKind: body.paymentKind,
            remainingAmount: body.remainingAmount,
            listingType: body.listingType ?? "token",
          });
          return NextResponse.json(
            { ...body, listingType: normalized.listingType },
            { status: res.status },
          );
        } catch {
          return new NextResponse(payload.text, {
            status: res.status,
            headers: { "Content-Type": payload.contentType },
          });
        }
      }

      if (!isBookingDoneNotDeployedResponse(payload.text) && res.status !== 404 && res.status !== 405) {
        break;
      }
    }

    return proxyJsonError(
      lastStatus,
      lastPayload ?? {
        text: lastUrl ? `Upstream failed at ${lastUrl}` : "",
        json: null,
        contentType: "application/json",
      },
      "Unable to record payment.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to record payment.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
