import type { Lead } from "@/lib/data";
import { extractQuoteIdFromUrl } from "@/lib/crm-quote-links";
import { resolveEmailSubstage, shouldSendEmail } from "@/lib/email-substage-mapper";

/**
 * Email request payload structure
 * This matches the backend EmailRequest model
 */
export interface EmailRequestPayload {
  subStage: string;
  rescheduleCount?: number;
  clientName: string;
  clientEmail: string;
  leadId?: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingLocation?: string;
  meetingType?: "online" | "physical";
  quotedAmount?: string;
  quoteLink?: string;
  /** Design / Hub quote id — stored in quote_sent_info when present. */
  quoteId?: string;
  leadType?: string;
  reconnectDate?: string;
  cancellationReason?: string;
  feedbackFormLink?: string;
  designerName?: string;
  designerEmail?: string;
  ccEmails?: string[];
}

function formatMeetingDateDisplay(rawDate?: string): string | undefined {
  if (!rawDate || !rawDate.trim()) return undefined;
  const str = rawDate.trim();
  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(str)) {
    return str;
  }
  const d = new Date(str.includes(" ") && !str.includes("T") ? str.replace(" ", "T") : str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return str;
}

function formatMeetingTimeDisplay(rawDate?: string): string | undefined {
  if (!rawDate || !rawDate.trim()) return undefined;
  const str = rawDate.trim();
  if (/^\d{1,2}:\d{2}\s*(am|pm)$/i.test(str)) {
    return str.toLowerCase();
  }
  const d = new Date(str.includes(" ") && !str.includes("T") ? str.replace(" ", "T") : str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).toLowerCase();
  }
  return undefined;
}

/**
 * Builds email request payload from lead and substage
 * Returns null if email should not be sent for this substage
 */
export function buildEmailRequest(
  lead: Lead,
  substage: string,
  manualTrigger: boolean = false,
  rescheduleCount?: number
): EmailRequestPayload | null {
  const trimmedSubstage = substage.trim();
  const emailSubstage = resolveEmailSubstage(trimmedSubstage);

  if (!emailSubstage) {
    return null;
  }
  
  if (!manualTrigger && !shouldSendEmail(trimmedSubstage)) {
    return null;
  }

  if (!lead.email?.trim()) {
    return null;
  }

  const reschedMatch = trimmedSubstage.match(/meeting rescheduled\s*(\d+)/i);
  const parsedCount = reschedMatch
    ? Number(reschedMatch[1])
    : (typeof rescheduleCount === "number" && rescheduleCount > 0 ? rescheduleCount : undefined);
  const finalSubStage =
    emailSubstage === "Meeting Rescheduled" && parsedCount
      ? `Meeting Rescheduled ${parsedCount}`
      : emailSubstage;

  const payload: EmailRequestPayload = {
    subStage: finalSubStage,
    rescheduleCount: parsedCount,
    clientName: lead.name?.trim() || "Valued Customer",
    clientEmail: lead.email.trim(),
    // Hub quote_sent_info update needs numeric DB id + leadType (not business leadId alone).
    leadId: lead.id?.trim() || lead.leadId?.trim() || undefined,
    leadType: lead.leadType?.trim() || undefined,
    designerName: lead.designerName?.trim() || undefined,
    designerEmail: lead.designerEmail?.trim() || undefined,
  };

  // Add optional fields based on substage
  switch (emailSubstage) {
    case "Meeting Scheduled":
    case "Meeting Rescheduled": {
      const rawDateTime = lead.followUpDate || lead.meetingDate;
      if (rawDateTime) {
        const formattedDate = formatMeetingDateDisplay(rawDateTime);
        if (formattedDate) payload.meetingDate = formattedDate;
        const formattedTime = formatMeetingTimeDisplay(rawDateTime);
        if (formattedTime) payload.meetingTime = formattedTime;
      }
      if (!payload.meetingDate && lead.meetingDate) {
        payload.meetingDate = formatMeetingDateDisplay(lead.meetingDate) || lead.meetingDate;
      }

      if (lead.meetingVenue) {
        payload.meetingLocation = lead.meetingVenue;
      } else if (lead.meetingType) {
        payload.meetingLocation = lead.meetingType;
      }
      
      if (lead.meetingType) {
        payload.meetingType = lead.meetingType.toLowerCase().includes("physical") ? "physical" : "online";
      }
      break;
    }

    case "Meeting Cancelled/Paused": {
      payload.cancellationReason = lead.lostReason?.trim() || "No detailed reason provided";
      const rawDateTime = lead.meetingDate || lead.followUpDate;
      if (rawDateTime) {
        const formattedDate = formatMeetingDateDisplay(rawDateTime);
        if (formattedDate) payload.meetingDate = formattedDate;
        const formattedTime = formatMeetingTimeDisplay(rawDateTime);
        if (formattedTime) payload.meetingTime = formattedTime;
      }
      break;
    }

    case "Quote Sent":
      if (lead.budget) {
        payload.quotedAmount = lead.budget;
      }
      if (lead.quoteLink) {
        payload.quoteLink = lead.quoteLink;
      }
      {
        const quoteId =
          lead.quoteId?.trim() ||
          (lead.quoteLink ? extractQuoteIdFromUrl(lead.quoteLink) : "") ||
          "";
        if (quoteId) payload.quoteId = quoteId;
      }
      break;

    case "Customer Cancelled Plan":
      payload.feedbackFormLink = "https://hubinterior.com/feedback";
      break;

    case "Project Postponed Indefinitely":
    case "No Response After Discussion":
      if (lead.followUpDate) {
        const dateObj = new Date(lead.followUpDate);
        payload.reconnectDate = dateObj.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      break;

    default:
      break;
  }

  return payload;
}

/**
 * Send email via Next.js API route
 * Calls: POST /api/email/send (which forwards to backend)
 */
export async function sendEmailNotification(
  payload: EmailRequestPayload
): Promise<{ success: boolean; message: string }> {
  console.log("[sendEmailNotification] ========================================");
  console.log("[sendEmailNotification] Sending email request...");
  console.log("[sendEmailNotification] Payload:", JSON.stringify(payload, null, 2));
  
  try {
    const endpoint = "/api/email/send";
    
    console.log("[sendEmailNotification] Endpoint:", endpoint);
    
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("[sendEmailNotification] Response status:", response.status, response.statusText);
    
    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
      message?: string;
    };

    console.log("[sendEmailNotification] Response data:", data);
    
    if (!response.ok) {
      const errorMsg = data.error || "Failed to send email";
      console.error("[sendEmailNotification] ❌ Error:", errorMsg);
      console.log("[sendEmailNotification] ========================================");
      return {
        success: false,
        message: errorMsg,
      };
    }

    console.log("[sendEmailNotification] ✅ Success!");
    console.log("[sendEmailNotification] ========================================");
    return {
      success: true,
      message: data.message || "Email sent successfully",
    };
  } catch (error) {
    console.error("[sendEmailNotification] ❌ Fetch error:", error);
    console.log("[sendEmailNotification] ========================================");
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
