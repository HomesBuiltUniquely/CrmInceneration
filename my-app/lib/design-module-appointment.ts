/**
 * Server-side helpers to call Design Module appointment availability APIs.
 * Sales CRM uses x-api-key; designer /me APIs use session (not proxied here).
 *
 * Resolve order: DESIGN_MODULE_URL → NEXT_PUBLIC_API → hosted Hub API.
 */

export const DESIGN_MODULE_APPOINTMENT_URL = (
  process.env.DESIGN_MODULE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API?.trim() ||
  "https://api.hubinterior.com"
).replace(/\/+$/, "");

export const DESIGN_MODULE_APPOINTMENT_API_KEY =
  process.env.HUB_SYNC_API_KEY?.trim() ||
  process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim() ||
  "";

export function designModuleAppointmentHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (DESIGN_MODULE_APPOINTMENT_API_KEY) {
    headers["x-api-key"] = DESIGN_MODULE_APPOINTMENT_API_KEY;
  }
  return headers;
}

export async function proxyDesignModuleAppointmentGet(
  pathWithQuery: string,
): Promise<Response> {
  const url = `${DESIGN_MODULE_APPOINTMENT_URL}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;
  return fetch(url, {
    method: "GET",
    headers: designModuleAppointmentHeaders(),
    cache: "no-store",
  });
}
