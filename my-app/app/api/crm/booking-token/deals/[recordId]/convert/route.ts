import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaderRecord, upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { bookingTokenConvertUpstreamCandidates } from "@/lib/booking-token-upstream";
import { syncConvertBookingToDesignModule } from "@/lib/design-module-hub-sync";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const body = await req.text();
    const requestBody = body || JSON.stringify({ confirm: true });
    const authHeaders = upstreamAuthHeaderRecord(req);
    const headers: HeadersInit = {
      ...authHeaders,
      "Content-Type": "application/json",
    };

    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;

    for (let i = 0; i < bookingTokenConvertUpstreamCandidates(recordId).length; i += 1) {
      const url = bookingTokenConvertUpstreamCandidates(recordId)[i];
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: requestBody,
        cache: "no-store",
      });
      const payload = await readUpstreamPayload(res);
      lastPayload = payload;
      lastStatus = res.status;
      if (res.ok) {
        try {
          const parsed = JSON.parse(payload.text) as {
            bookingStatus?: string;
            paymentKind?: string | null;
            remainingAmount?: number | null;
            listingType?: string | null;
          };
          let designSync: { designLeadId?: number } | null = null;
          let designSyncError: string | null = null;
          try {
            designSync = await syncConvertBookingToDesignModule(recordId, authHeaders, req.nextUrl.origin);
          } catch (syncErr) {
            designSyncError =
              syncErr instanceof Error ? syncErr.message : "Design Module finance sync failed";
            console.warn("[booking-token/convert] design module sync failed", {
              recordId,
              error: designSyncError,
            });
          }
          return NextResponse.json(
            {
              ...parsed,
              listingType: "booking",
              bookingStatus: parsed.bookingStatus ?? "confirmed",
              designLeadId: designSync?.designLeadId ?? null,
              designSyncError,
            },
            { status: res.status },
          );
        } catch {
          return new NextResponse(payload.text, {
            status: res.status,
            headers: { "Content-Type": payload.contentType },
          });
        }
      }
      const isMissing =
        res.status === 404 ||
        (payload.text.includes("NoResourceFoundException") ||
          payload.text.includes("No static resource"));
      if (i < bookingTokenConvertUpstreamCandidates(recordId).length - 1 && isMissing) {
        continue;
      }
      break;
    }

    return proxyJsonError(
      lastStatus,
      lastPayload!,
      "Unable to convert deal to booking. Hub convert API may be missing — restart backend after deploying convert endpoint.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to convert deal to booking.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
