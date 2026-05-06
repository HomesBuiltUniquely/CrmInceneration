import type { CrmLeadType } from "@/lib/leads-filter";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

function authHeaders(): HeadersInit {
  return getCrmAuthHeaders({ "Content-Type": "application/json" });
}

async function buildApiError(res: Response, fallback: string): Promise<Error> {
  const text = (await res.text()).trim();
  if (res.status === 401) return new Error("Session expired. Please login again.");
  if (res.status === 403) {
    return new Error("You don't have permission to perform this action.");
  }
  return new Error(text || fallback);
}

export async function getLeadDetail(leadType: CrmLeadType, id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) throw await buildApiError(res, `Failed to load lead details (${res.status})`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getLeadActivities(leadType: CrmLeadType, id: string): Promise<unknown> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/activities`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) throw await buildApiError(res, `Failed to load activities (${res.status})`);
  return res.json();
}

export async function putLeadDetail(
  leadType: CrmLeadType,
  id: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw await buildApiError(res, `Save failed (${res.status})`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function postManualActivity(
  leadType: CrmLeadType,
  id: string,
  activityType: "CALL" | "WHATSAPP" | "SMS" | "NOTE",
  value: string
): Promise<string> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/activity`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ activityType, value }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) throw new Error("You don't have permission to add activity.");
    throw new Error(text || `Activity update failed (${res.status})`);
  }
  return text;
}

function verifyPayloadMessage(parsed: Record<string, unknown> | null): string | null {
  if (!parsed) return null;
  const m = parsed.message;
  if (typeof m === "string" && m.trim()) return m.trim();
  const e = parsed.error;
  if (typeof e === "string" && e.trim()) return e.trim();
  return null;
}

/** `POST .../verify/{id}` — body shape depends on Hub (e.g. sales executive id). */
export async function postVerifyLead(
  leadType: CrmLeadType,
  id: string,
  body: Record<string, unknown> = {}
): Promise<unknown> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/verify`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const fromJson = verifyPayloadMessage(parsed);
    const msg =
      fromJson ??
      (res.status === 401 ? "Session expired. Please log in again." : null) ??
      (res.status === 403 ? "You don't have permission to verify this lead." : null) ??
      (text.trim() ? text.trim() : null) ??
      `Verify failed (${res.status})`;
    throw new Error(msg);
  }

  if (parsed && parsed.success === false) {
    throw new Error(verifyPayloadMessage(parsed) ?? "Verify failed.");
  }

  return parsed ?? {};
}

export async function postStageRollback(
  leadType: CrmLeadType,
  id: string,
  body: {
    toMilestoneStage: string;
    toMilestoneStageCategory: string;
    toMilestoneSubStage: string;
    reason: string;
  }
): Promise<unknown> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/stage-rollback`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Session expired. Please login again.");
    }
    if (res.status === 403) {
      throw new Error("Only Super Admin can rollback stage.");
    }
    throw new Error(text || `Stage rollback failed (${res.status})`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

/** `POST /v1/quote/send` — multipart fields: quoteLink, toEmail, subject, body, leadId, leadType. */
export async function postQuoteSend(formData: FormData): Promise<unknown> {
  const headers = getCrmAuthHeaders();
  const res = await fetch(`/api/crm/quote/send`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Quote send failed (${res.status})`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

type NewCrmQuoteResponse = {
  ok?: boolean;
  externalLeadId?: string;
  leadId?: string | number;
  quoteId?: string | number;
  internalQuoteUrl?: string;
  customerQuoteUrl?: string;
  message?: string;
  error?: string;
};

/** `GET /api/new-crm/quotes/internal-link/by-lead/{leadId}` via CRM backend proxy. */
export async function getNewCrmQuoteInternalLinkByLead(
  leadId: string,
): Promise<NewCrmQuoteResponse> {
  const id = leadId.trim();
  if (!id) throw new Error("Lead ID is required to fetch quote.");
  const res = await fetch(
    `/api/new-crm/quotes/internal-link/by-lead/${encodeURIComponent(id)}`,
    {
      method: "GET",
      credentials: "include",
      headers: authHeaders(),
      cache: "no-store",
    },
  );
  const text = await res.text();
  let parsed: NewCrmQuoteResponse | null = null;
  try {
    parsed = text ? (JSON.parse(text) as NewCrmQuoteResponse) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const message =
      (parsed?.message && parsed.message.trim()) ||
      (parsed?.error && parsed.error.trim()) ||
      text.trim() ||
      `Get quote failed (${res.status})`;
    throw new Error(message);
  }
  return parsed ?? {};
}
