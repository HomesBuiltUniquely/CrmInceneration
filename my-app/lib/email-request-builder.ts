import type { Lead } from "@/lib/data";
import { resolveEmailSubstage, shouldSendEmail } from "@/lib/email-substage-mapper";

/**
 * Email request payload structure
 * This matches the backend EmailRequest model
 */
export interface EmailRequestPayload {
  subStage: string;
  clientName: string;
  clientEmail: string;
  leadId?: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingLocation?: string;
  meetingType?: "online" | "physical";
  quotedAmount?: string;
  quoteLink?: string;
  reconnectDate?: string;
  cancellationReason?: string;
  feedbackFormLink?: string;
}

/**
 * Builds email request payload from lead and substage
 * Returns null if email should not be sent for this substage
 */
export function buildEmailRequest(
  lead: Lead,
  substage: string,
  manualTrigger: boolean = false
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

  const payload: EmailRequestPayload = {
    subStage: emailSubstage,
    clientName: lead.name?.trim() || "Valued Customer",
    clientEmail: lead.email.trim(),
    leadId: lead.leadId || lead.id,
  };

  // Add optional fields based on substage
  switch (emailSubstage) {
    case "Meeting Scheduled":
    case "Meeting Rescheduled":
      if (lead.followUpDate?.includes("T")) {
        const date = new Date(lead.followUpDate);
        
        const formattedDate = date.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        payload.meetingDate = formattedDate;
        
        const time = date.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        payload.meetingTime = time;
      } else if (lead.meetingDate) {
        payload.meetingDate = lead.meetingDate;
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

    case "Meeting Cancelled/Paused":
      payload.cancellationReason = lead.lostReason?.trim() || "No detailed reason provided";
      break;

    case "Quote Sent":
      if (lead.budget) {
        payload.quotedAmount = lead.budget;
      }
      if (lead.quoteLink) {
        payload.quoteLink = lead.quoteLink;
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
