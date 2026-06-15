/**
 * Hub customer API (api.hubinterior.com) — direct GET only (no webhook POST).
 *
 * - GET /api/customer/phones/recent  (X-External-Api-Key)
 * - GET /api/customer/records/:id   (X-External-Api-Key)
 * - GET /api/customer?phone=…       (no auth)
 * - GET /api/customer/:customerNumber (no auth)
 */

export const CUSTOMER_API_BASE = (
  process.env.NEXT_PUBLIC_API?.trim() || "https://api.hubinterior.com"
).replace(/\/+$/, "");

export function externalLeadIngestApiKey(): string {
  return process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim() ?? "";
}

export function customerApiAuthHeaders(): HeadersInit {
  const key = externalLeadIngestApiKey();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["X-External-Api-Key"] = key;
  return headers;
}

export type CustomerPhoneRecentItem = {
  id: number;
  phone: string;
  customerNumber: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type FetchRecentCustomerPhonesOpts = {
  limit?: number;
  since?: string;
  sinceId?: number;
  distinct?: boolean;
};

export type RecentCustomerPhonesResponse = {
  ok: boolean;
  count: number;
  items: CustomerPhoneRecentItem[];
};

function clampLimit(limit: number | undefined): number {
  const n = Number(limit ?? 50);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

/** GET /api/customer/phones/recent */
export async function fetchRecentCustomerPhones(
  opts: FetchRecentCustomerPhonesOpts = {},
): Promise<RecentCustomerPhonesResponse> {
  const key = externalLeadIngestApiKey();
  if (!key) {
    throw new Error("EXTERNAL_LEAD_INGEST_API_KEY is not configured");
  }

  const url = new URL(`${CUSTOMER_API_BASE}/api/customer/phones/recent`);
  url.searchParams.set("limit", String(clampLimit(opts.limit)));
  if (opts.since?.trim()) url.searchParams.set("since", opts.since.trim());
  if (opts.sinceId !== undefined && opts.sinceId !== null) {
    url.searchParams.set("sinceId", String(Math.max(0, Math.floor(Number(opts.sinceId)))));
  }
  if (opts.distinct === true) url.searchParams.set("distinct", "true");

  const res = await fetch(url.toString(), {
    headers: customerApiAuthHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Customer phones API failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Customer phones API returned invalid JSON");
  }

  const rec =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {};
  const itemsRaw = Array.isArray(rec.items) ? rec.items : [];
  const items: CustomerPhoneRecentItem[] = [];

  for (const row of itemsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isFinite(id)) continue;
    const phone = String(r.phone ?? r.customerNumber ?? "").trim();
    if (!phone) continue;
    const payload =
      r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : null;
    items.push({
      id,
      phone,
      customerNumber: String(r.customerNumber ?? phone).trim(),
      payload,
      createdAt: String(r.createdAt ?? "").trim(),
    });
  }

  return {
    ok: Boolean(rec.ok ?? true),
    count: Number(rec.count ?? items.length),
    items,
  };
}

export type CustomerRecordResponse = {
  ok: boolean;
  item: CustomerPhoneRecentItem | null;
};

/** GET /api/customer/records/:id */
export async function fetchCustomerRecordById(
  recordId: number,
): Promise<CustomerRecordResponse> {
  const key = externalLeadIngestApiKey();
  if (!key) {
    throw new Error("EXTERNAL_LEAD_INGEST_API_KEY is not configured");
  }
  const id = Math.floor(Number(recordId));
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Invalid customer record id");
  }

  const url = `${CUSTOMER_API_BASE}/api/customer/records/${id}`;
  const res = await fetch(url, {
    headers: customerApiAuthHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Customer record API failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const json = JSON.parse(text) as Record<string, unknown>;
  const row =
    json.item && typeof json.item === "object" && !Array.isArray(json.item)
      ? (json.item as Record<string, unknown>)
      : json.record && typeof json.record === "object"
        ? (json.record as Record<string, unknown>)
        : json;

  const phone = String(row.phone ?? row.customerNumber ?? "").trim();
  const parsedId = Number(row.id ?? id);
  if (!phone || !Number.isFinite(parsedId)) {
    return { ok: Boolean(json.ok ?? false), item: null };
  }

  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : null;

  return {
    ok: Boolean(json.ok ?? true),
    item: {
      id: parsedId,
      phone,
      customerNumber: String(row.customerNumber ?? phone).trim(),
      payload,
      createdAt: String(row.createdAt ?? "").trim(),
    },
  };
}

function parseCustomerRow(
  row: Record<string, unknown>,
  fallbackPhone: string,
  syntheticId?: number,
): CustomerPhoneRecentItem | null {
  const phone = String(
    row.phone ?? row.customerNumber ?? row.customer_mobile ?? row.contactNo ?? fallbackPhone,
  ).trim();
  if (!phone) return null;
  const id = Number(row.id ?? row.recordId ?? syntheticId ?? 0);
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : row;
  return {
    id: Number.isFinite(id) && id > 0 ? id : 0,
    phone,
    customerNumber: String(row.customerNumber ?? phone).trim(),
    payload: payload as Record<string, unknown>,
    createdAt: String(row.createdAt ?? row.created_at ?? "").trim(),
  };
}

function parseCustomerLookupJson(
  json: unknown,
  fallbackPhone: string,
): CustomerPhoneRecentItem | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  if (Array.isArray(rec.items) && rec.items[0] && typeof rec.items[0] === "object") {
    return parseCustomerRow(rec.items[0] as Record<string, unknown>, fallbackPhone);
  }
  if (rec.item && typeof rec.item === "object") {
    return parseCustomerRow(rec.item as Record<string, unknown>, fallbackPhone);
  }
  if (rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)) {
    return parseCustomerRow(rec.data as Record<string, unknown>, fallbackPhone);
  }
  return parseCustomerRow(rec, fallbackPhone);
}

/** GET /api/customer?phone=919876543210 — no auth (direct API read). */
export async function fetchCustomerByPhone(
  phone: string,
): Promise<CustomerRecordResponse> {
  const digits = String(phone).replace(/\D/g, "").trim();
  if (digits.length < 8) {
    return { ok: false, item: null };
  }
  const url = new URL(`${CUSTOMER_API_BASE}/api/customer`);
  url.searchParams.set("phone", digits);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (res.status === 404) return { ok: false, item: null };
  if (!res.ok) {
    throw new Error(`GET /api/customer?phone= failed (${res.status}): ${text.slice(0, 300)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, item: null };
  }
  const item = parseCustomerLookupJson(json, digits);
  return { ok: Boolean(item), item };
}

/** GET /api/customer/:customerNumber — no auth (direct API read). */
export async function fetchCustomerByCustomerNumber(
  customerNumber: string,
): Promise<CustomerRecordResponse> {
  const cn = encodeURIComponent(String(customerNumber).trim());
  if (!cn) return { ok: false, item: null };
  const url = `${CUSTOMER_API_BASE}/api/customer/${cn}`;
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (res.status === 404) return { ok: false, item: null };
  if (!res.ok) {
    throw new Error(
      `GET /api/customer/:customerNumber failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, item: null };
  }
  const item = parseCustomerLookupJson(json, String(customerNumber).replace(/\D/g, ""));
  return { ok: Boolean(item), item };
}

/**
 * Load customer details via direct GET (prefer ?phone=, then /:customerNumber).
 */
export async function fetchCustomerDetailsDirect(
  phoneOrNumber: string,
): Promise<CustomerPhoneRecentItem | null> {
  const digits = String(phoneOrNumber).replace(/\D/g, "").trim();
  if (!digits) return null;
  const byPhone = await fetchCustomerByPhone(digits);
  if (byPhone.item) return byPhone.item;
  const byNumber = await fetchCustomerByCustomerNumber(digits);
  return byNumber.item;
}
