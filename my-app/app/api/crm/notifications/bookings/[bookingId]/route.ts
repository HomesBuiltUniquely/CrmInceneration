import { NextRequest } from "next/server";
import { proxyNotifyGet } from "@/lib/crm-notify-proxy";

/**
 * GET /api/crm/notifications/bookings/[bookingId]
 * → Go NotifyProject: GET /v1/bookings/{booking_id}  (BookingResponse)
 *
 * Returns a single booking record from the notify DB by its numeric ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  return proxyNotifyGet(req, `/v1/bookings/${encodeURIComponent(bookingId)}`);
}
