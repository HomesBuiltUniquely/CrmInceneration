import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaderRecord } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { bookingTokenCancelApproveUpstreamUrl } from "@/lib/booking-token-upstream";
import { syncRefundToDesignModule } from "@/lib/design-module-hub-sync";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const authHeaders = upstreamAuthHeaderRecord(req);
    const res = await fetch(bookingTokenCancelApproveUpstreamUrl(recordId), {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to approve cancellation.");
    }

    try {
      const parsed = JSON.parse(payload.text) as {
        id?: string;
        listingType?: string;
        bookingStatus?: string;
        cancellationApprovalStatus?: string;
        cancellationReason?: string | null;
        cancelledAt?: string | null;
        cancellationApprovedAt?: string | null;
        cancellationApprovedByName?: string | null;
        cancelledPaymentEntryIds?: string[];
      };

      let refundSync: Awaited<ReturnType<typeof syncRefundToDesignModule>> | null = null;
      let designSyncError: string | null = null;
      try {
        refundSync = await syncRefundToDesignModule(recordId, authHeaders, req.nextUrl.origin, {
          cancellationReason: parsed.cancellationReason,
          cancelledAt: parsed.cancelledAt,
          cancellationApprovedAt: parsed.cancellationApprovedAt,
          cancellationApprovedBy: parsed.cancellationApprovedByName,
          refundScope:
            parsed.cancelledPaymentEntryIds?.length ? "payments" : "deal",
          cancelledPaymentEntryIds: parsed.cancelledPaymentEntryIds,
        });
      } catch (syncErr) {
        designSyncError =
          syncErr instanceof Error ? syncErr.message : "Design Module refund sync failed";
        console.warn("[booking-token/cancel/approve] design module refund sync failed", {
          recordId,
          error: designSyncError,
        });
      }

      return NextResponse.json(
        {
          ...parsed,
          refundId: refundSync?.refundId ?? null,
          refundAmount: refundSync?.refundAmount ?? null,
          designLeadId: refundSync?.designLeadId ?? null,
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
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to approve cancellation.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
