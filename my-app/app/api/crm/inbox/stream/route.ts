import type { NextRequest } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { resolveCrmAuthViewer } from "@/lib/crm-auth-viewer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE fallback: periodic inbox ping so the bell can refresh without WebSocket on the edge.
 */
export async function GET(req: NextRequest) {
  const viewer = await resolveCrmAuthViewer(req);
  if (!viewer) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  req.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      write({ type: "inbox_stream_open" });

      while (!closed) {
        try {
          const countsUrl = `${BASE_URL}/v1/crm/inbox/counts`;
          const res = await fetch(countsUrl, {
            headers: upstreamAuthHeaders(req),
            cache: "no-store",
          });
          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            write({ type: "inbox_updated", counts: json });
          }
        } catch {
          write({ type: "inbox_ping" });
        }
        await new Promise((r) => setTimeout(r, 20_000));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}