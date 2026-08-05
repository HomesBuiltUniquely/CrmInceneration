import { NextRequest } from "next/server";
import { proxyNotifyGet } from "@/lib/crm-notify-proxy";

/**
 * GET /api/crm/notifications/counts
 * → Go NotifyProject: GET /v1/counts  (CountsResponse)
 *
 * Returns global totals from the notify DB:
 *   total_leads, total_scheduled, total_rescheduled,
 *   total_cancelled, total_success, total_bookings
 */
export async function GET(req: NextRequest) {
  return proxyNotifyGet(req, "/v1/counts");
}
