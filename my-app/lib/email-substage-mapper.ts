/**
 * Maps substages to email metadata (subject, template, required fields)
 */

export type EmailSubstage = 
  | "Meeting Scheduled"
  | "Meeting Rescheduled"
  | "Meeting Cancelled"
  | "No Response After Discussion"
  | "Consultation Completed"
  | "Quote Sent"
  | "Dropped After Proposal"
  | "Budget Mismatch"
  | "Project Postponed"
  | "Customer Cancelled"
  | "Booking Done";

export interface EmailMetadata {
  substage: EmailSubstage;
  subject: string;
  templateFile: string;
  requiredFields: string[];
  optionalFields: string[];
}

/**
 * All supported substages with their email configuration
 */
export const SUBSTAGE_EMAIL_MAP: Record<EmailSubstage, EmailMetadata> = {
  "Meeting Scheduled": {
    substage: "Meeting Scheduled",
    subject: "Your Meeting is Confirmed!",
    templateFile: "meeting-scheduled.html",
    requiredFields: ["clientName", "clientEmail", "meetingDate", "meetingTime", "meetingLocation"],
    optionalFields: ["meetingType"],
  },
  "Meeting Rescheduled": {
    substage: "Meeting Rescheduled",
    subject: "Your Meeting has been Rescheduled",
    templateFile: "meeting-rescheduled.html",
    requiredFields: ["clientName", "clientEmail", "meetingDate", "meetingTime", "meetingLocation"],
    optionalFields: ["meetingType"],
  },
  "Meeting Cancelled": {
    substage: "Meeting Cancelled",
    subject: "Your Meeting has been Cancelled",
    templateFile: "meeting-cancelled.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: ["cancellationReason"],
  },
  "No Response After Discussion": {
    substage: "No Response After Discussion",
    subject: "We Tried Reaching You Today",
    templateFile: "no-response-after-discussion.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: ["reconnectDate"],
  },
  "Consultation Completed": {
    substage: "Consultation Completed",
    subject: "Meeting Done – Your Quote is Coming Soon!",
    templateFile: "consultation-completed.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: [],
  },
  "Quote Sent": {
    substage: "Quote Sent",
    subject: "Your Interior Design Quote is Ready",
    templateFile: "quote-sent.html",
    requiredFields: ["clientName", "clientEmail", "quotedAmount"],
    optionalFields: [],
  },
  "Dropped After Proposal": {
    substage: "Dropped After Proposal",
    subject: "We Hope to Work With You in the Future",
    templateFile: "dropped-after-proposal.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: [],
  },
  "Budget Mismatch": {
    substage: "Budget Mismatch",
    subject: "Let Us Offer You Our Best Price",
    templateFile: "budget-mismatch.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: [],
  },
  "Project Postponed": {
    substage: "Project Postponed",
    subject: "We Will Reconnect With You as Discussed",
    templateFile: "project-postponed.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: ["reconnectDate"],
  },
  "Customer Cancelled": {
    substage: "Customer Cancelled",
    subject: "Sorry to See You Go – We'd Love Your Feedback",
    templateFile: "customer-cancelled.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: ["feedbackFormLink"],
  },
  "Booking Done": {
    substage: "Booking Done",
    subject: "Congratulations! Your Booking is Confirmed",
    templateFile: "booking-done.html",
    requiredFields: ["clientName", "clientEmail"],
    optionalFields: [],
  },
};

/**
 * Get email metadata for a given substage
 */
export function getEmailMetadata(substage: string): EmailMetadata | null {
  return SUBSTAGE_EMAIL_MAP[substage as EmailSubstage] ?? null;
}

/**
 * Check if a substage should trigger an email
 */
export function shouldSendEmail(substage: string): boolean {
  return substage in SUBSTAGE_EMAIL_MAP;
}

/**
 * Validate that all required fields are present
 */
export function validateEmailFields(
  substage: string,
  data: Record<string, unknown>
): { valid: boolean; missingFields: string[] } {
  const metadata = getEmailMetadata(substage);
  if (!metadata) {
    return { valid: false, missingFields: ["substage"] };
  }

  const missingFields = metadata.requiredFields.filter(
    (field) => !data[field] || (typeof data[field] === "string" && !data[field].trim())
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
