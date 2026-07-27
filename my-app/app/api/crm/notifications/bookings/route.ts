import { NextRequest } from "next/server";
import { proxyNotifyGet } from "@/lib/crm-notify-proxy";

/**
 * GET /api/crm/notifications/bookings
 *
 * Proxies to Go NotifyProject server: GET /v1/bookings
 * (BookingListResponse — { data: Booking[] })
 *
 * Returns booking/token notifications for all roles — no scope filtering.
 */
export async function GET(req: NextRequest) {
  return proxyNotifyGet(req, "/v1/bookings");
}
