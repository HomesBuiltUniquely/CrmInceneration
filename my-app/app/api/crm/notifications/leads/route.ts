import { NextRequest } from "next/server";
import { proxyNotifyGet } from "@/lib/crm-notify-proxy";

/**
 * GET /api/crm/notifications/leads
 * → Go NotifyProject: GET /v1/leads  (LeadListResponse)
 *
 * Returns all leads stored in the notify DB.
 * Used to generate "New Lead" notifications.
 */
export async function GET(req: NextRequest) {
  return proxyNotifyGet(req, "/v1/leads");
}
