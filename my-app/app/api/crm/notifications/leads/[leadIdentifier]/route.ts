import { NextRequest } from "next/server";
import { proxyNotifyGet } from "@/lib/crm-notify-proxy";

/**
 * GET /api/crm/notifications/leads/[leadIdentifier]
 * → Go NotifyProject: GET /v1/leads/{lead_identifier}  (LeadResponse)
 *
 * Returns a single lead record from the notify DB by its business identifier.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadIdentifier: string }> },
) {
  const { leadIdentifier } = await params;
  return proxyNotifyGet(req, `/v1/leads/${encodeURIComponent(leadIdentifier)}`);
}
