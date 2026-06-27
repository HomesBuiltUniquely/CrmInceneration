import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { bookingPaymentSubmitUpstreamUrl } from "@/lib/booking-payment-upstream";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const incoming = await req.formData();
    const upstreamForm = new FormData();

    const amount = incoming.get("amount");
    if (amount != null) upstreamForm.append("amount", String(amount));

    const notes = incoming.get("notes");
    if (typeof notes === "string" && notes.trim()) {
      upstreamForm.append("notes", notes.trim());
    }

    for (const [key, value] of incoming.entries()) {
      if (key !== "files" || !(value instanceof Blob) || value.size === 0) continue;
      const name = value instanceof File ? value.name : "payment-proof";
      upstreamForm.append("files", value, name);
    }

    const res = await fetch(bookingPaymentSubmitUpstreamUrl(recordId), {
      method: "POST",
      headers: upstreamAuthHeaders(req),
      body: upstreamForm,
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to record payment.");
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
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
