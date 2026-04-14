import type { Lead } from "@/lib/data";
import { shouldSendEmail } from "@/lib/email-substage-mapper";

/**
 * Email request payload structure
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
  // Check if this substage should trigger an email
  if (!shouldSendEmail(substage)) {
    return null;
  }

  // Don't send if no email
  if (!lead.email?.trim()) {
    return null;
  }

  const payload: EmailRequestPayload = {
    subStage: substage,
    clientName: lead.name?.trim() || "Valued Customer",
    clientEmail: lead.email.trim(),
  };

  // Add optional fields based on substage
  switch (substage) {
    case "Meeting Scheduled":
    case "Meeting Rescheduled":
      // Add meeting details if available
      if (lead.meetingDate) {
        payload.meetingDate = lead.meetingDate;
      }
      if (lead.meetingVenue) {
        payload.meetingLocation = lead.meetingVenue;
      }
      if (lead.meetingType) {
        payload.meetingType = lead.meetingType === "Physical" ? "physical" : "online";
      }
      // Try to extract time from followUpDate if it's a datetime
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

    case "Quote Sent":
      // You might want to fetch this from your backend or add it to Lead model
      // For now, we'll leave it empty and it can be added in CompleteTaskModal
      break;

    case "Project Postponed":
    case "No Response After Discussion":
      // Add reconnect date from followUpDate
      if (lead.followUpDate) {
        const dateObj = new Date(lead.followUpDate);
        payload.reconnectDate = dateObj.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      break;

    case "Customer Cancelled":
      // You might want to add feedback form link here
      // Can be extended in the future
      break;

    case "Meeting Cancelled":
      // Could add cancellation reason if extended in CompleteTaskModal
      break;

    // Other substages don't require additional data
    default:
      break;
  }

  return payload;
}

/**
 * Send email via the /api/send-email endpoint
 */
export async function sendEmailNotification(
  payload: EmailRequestPayload
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        message: data.error || "Failed to send email",
      };
    }

    return {
      success: true,
      message: data.message || "Email sent successfully",
    };
  } catch (error) {
    console.error("[sendEmailNotification] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
