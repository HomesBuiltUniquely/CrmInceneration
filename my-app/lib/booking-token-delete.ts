import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { CrmLeadType } from "@/lib/leads-filter";

export type BookingTokenDeleteForLeadResponse = {
  success: boolean;
  leadType?: string;
  leadId?: number;
  deletedCount?: number;
  deletedRecordIds?: string[];
  deletedProofCount?: number;
  message?: string;
  error?: string;
};

function parseApiError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const msg =
      (typeof parsed.error === "string" && parsed.error.trim()) ||
      (typeof parsed.message === "string" && parsed.message.trim()) ||
      (typeof parsed.userMessage === "string" && parsed.userMessage.trim());
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function deleteBookingTokenForLead(
  leadType: CrmLeadType,
  leadId: number,
): Promise<BookingTokenDeleteForLeadResponse> {
  const res = await fetch(
    `/api/crm/lead/${encodeURIComponent(leadType)}/${leadId}/booking-token`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const text = await res.text();
  let body: BookingTokenDeleteForLeadResponse;
  try {
    body = JSON.parse(text) as BookingTokenDeleteForLeadResponse;
  } catch {
    body = { success: false, error: parseApiError(text, "Failed to delete booking & token data.") };
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.error ?? body.message ?? parseApiError(text, "Failed to delete booking & token data."));
  }
  return body;
}

export async function deleteCrmLead(leadType: CrmLeadType, leadId: number): Promise<void> {
  const res = await fetch(`/api/crm/lead/${encodeURIComponent(leadType)}/${leadId}`, {
    method: "DELETE",
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Failed to delete lead."));
  }
}

/** Remove booking & token rows only — CRM lead is not deleted. */
export async function deleteLeadWithBookingToken(
  leadType: string,
  leadId: number,
): Promise<BookingTokenDeleteForLeadResponse> {
  if (!isCrmLeadType(leadType)) {
    throw new Error("Invalid lead type.");
  }
  return deleteBookingTokenForLead(leadType as CrmLeadType, leadId);
}
