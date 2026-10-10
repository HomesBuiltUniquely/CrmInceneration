import { NextRequest, NextResponse } from "next/server";
import {
  DESIGN_MODULE_APPOINTMENT_URL,
  proxyDesignModuleAppointmentGet,
} from "@/lib/design-module-appointment";

/**
 * Proxy → Design Module
 * GET /api/appointment/available-designers?date&startTime&endTime|durationMinutes
 */
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const path = `/api/appointment/available-designers${qs ? `?${qs}` : ""}`;

  try {
    const res = await proxyDesignModuleAppointmentGet(path);
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          designers: [],
          error: text || `Design Module HTTP ${res.status}`,
          date: req.nextUrl.searchParams.get("date"),
        },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[available-designers] Design Module unreachable: ${message}`);
    return NextResponse.json(
      {
        designers: [],
        error: `Design Module unreachable at ${DESIGN_MODULE_APPOINTMENT_URL}.`,
      },
      { status: 502 },
    );
  }
}
