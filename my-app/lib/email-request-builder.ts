import type { Lead } from "@/lib/data";
import { BASE_URL } from "@/lib/base-url";
import { shouldSendEmail } from "@/lib/email-substage-mapper";

/**
 * Email request payload structure
 * This matches the backend EmailRequest model
 */
export interface EmailRequestPayload {
  subStage: string;
  clientName: string;
  clientEmail: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingLocation?: string;
  meetingType?: "online" | "physical";
  quotedAmount?: string;
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
  substage: string
): EmailRequestPayload | null {
  const originalSubstage = substage;
  const trimmedSubstage = substage.trim();
  
  console.log("[buildEmailRequest] ========================================");
  console.log("[buildEmailRequest] Original substage:", originalSubstage);
  console.log("[buildEmailRequest] Trimmed substage:", trimmedSubstage);
  console.log("[buildEmailRequest] Lead name:", lead.name);
  console.log("[buildEmailRequest] Lead email:", lead.email);
  
  // Check if this substage should trigger an email
  const shouldSend = shouldSendEmail(trimmedSubstage);
  console.log("[buildEmailRequest] Should send email?", shouldSend);
  
  if (!shouldSend) {
    console.log("[buildEmailRequest] ❌ Substage not in email map");
    return null;
  }

  // Don't send if no email
  if (!lead.email?.trim()) {
    console.log("[buildEmailRequest] ❌ Lead has no email");
    return null;
  }

  const payload: EmailRequestPayload = {
    subStage: trimmedSubstage,
    clientName: lead.name?.trim() || "Valued Customer",
    clientEmail: lead.email.trim(),
  };

  // Add optional fields based on substage
  switch (trimmedSubstage) {
    case "Meeting Scheduled":
    case "Meeting Rescheduled":
      if (lead.meetingDate) {
        payload.meetingDate = lead.meetingDate;
      }
      if (lead.meetingVenue) {
        payload.meetingLocation = lead.meetingVenue;
      }
      if (lead.meetingType) {
        payload.meetingType = lead.meetingType === "Physical" ? "physical" : "online";
      }
      if (lead.followUpDate?.includes("T")) {
        const date = new Date(lead.followUpDate);
        const time = date.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        payload.meetingTime = time;
      }
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

  console.log("[buildEmailRequest] ✅ Payload built:", payload);
  console.log("[buildEmailRequest] ========================================");
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
    const endpoint = `${BASE_URL}/api/email/send`;
    
    console.log("[sendEmailNotification] Endpoint:", endpoint);
    
    const response = await fetch(endpoint, {
      method: "POST",
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
