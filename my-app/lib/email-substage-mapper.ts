/**
 * Maps substages to email metadata
 * These match the backend SubStageConstants exactly
 */

export type EmailSubstage = 
  | "Meeting Scheduled"
  | "Meeting Rescheduled"
  | "Meeting Cancelled/Paused"
  | "No Response After Discussion"
  | "MEETING SUCCESSFUL"
  | "Customer Dropped After Proposal"
  | "Budget Mismatch (Major)"
  | "Project Postponed Indefinitely"
  | "Customer Cancelled Plan"
  | "Booking Done (Booking)";

export interface EmailMetadata {
  substage: EmailSubstage;
  subject: string;
  requiresEmail: boolean;
  optionalFields: string[];
}

/**
 * All supported substages with their email configuration
 * These map to backend SubStageConstants and email endpoint
 * Backend handles template loading and sending at: POST /api/email/send
 */
export const SUBSTAGE_EMAIL_MAP: Record<EmailSubstage, EmailMetadata> = {
  "Meeting Scheduled": {
    substage: "Meeting Scheduled",
    subject: "Your Meeting is Confirmed!",
    requiresEmail: true,
    optionalFields: ["meetingDate", "meetingTime", "meetingLocation", "meetingType"],
  },
  "Meeting Rescheduled": {
    substage: "Meeting Rescheduled",
    subject: "Your Meeting has been Rescheduled",
    requiresEmail: true,
    optionalFields: ["meetingDate", "meetingTime", "meetingLocation", "meetingType"],
  },
  "Meeting Cancelled/Paused": {
    substage: "Meeting Cancelled/Paused",
    subject: "Your Meeting has been Cancelled/Paused",
    requiresEmail: true,
    optionalFields: ["cancellationReason"],
  },
  "No Response After Discussion": {
    substage: "No Response After Discussion",
    subject: "We Tried Reaching You Today",
    requiresEmail: true,
    optionalFields: ["reconnectDate"],
  },
  "MEETING SUCCESSFUL": {
    substage: "MEETING SUCCESSFUL",
    subject: "Meeting Done – Your Quote is Coming Soon!",
    requiresEmail: true,
    optionalFields: [],
  },
  "Customer Dropped After Proposal": {
    substage: "Customer Dropped After Proposal",
    subject: "We Hope to Work With You in the Future",
    requiresEmail: true,
    optionalFields: [],
  },
  "Budget Mismatch (Major)": {
    substage: "Budget Mismatch (Major)",
    subject: "Let Us Offer You Our Best Price",
    requiresEmail: true,
    optionalFields: [],
  },
  "Project Postponed Indefinitely": {
    substage: "Project Postponed Indefinitely",
    subject: "We Will Reconnect With You as Discussed",
    requiresEmail: true,
    optionalFields: ["reconnectDate"],
  },
  "Customer Cancelled Plan": {
    substage: "Customer Cancelled Plan",
    subject: "Sorry to See You Go – We'd Love Your Feedback",
    requiresEmail: true,
    optionalFields: ["feedbackFormLink"],
  },
  "Booking Done (Booking)": {
    substage: "Booking Done (Booking)",
    subject: "Congratulations! Your Booking is Confirmed",
    requiresEmail: true,
    optionalFields: [],
  },
};

/**
 * Get email metadata for a given substage
 * Trims the substage string for safety
 */
export function getEmailMetadata(substage: string): EmailMetadata | null {
  const trimmed = substage.trim();
  console.log('[getEmailMetadata] Looking for substage:', trimmed);
  const result = SUBSTAGE_EMAIL_MAP[trimmed as EmailSubstage] ?? null;
  console.log('[getEmailMetadata] Found metadata:', result ? 'yes' : 'no');
  return result;
}

/**
 * Check if a substage should trigger an email
 * Trims the substage string for safety
 */
export function shouldSendEmail(substage: string): boolean {
  const trimmed = substage.trim();
  const result = trimmed in SUBSTAGE_EMAIL_MAP;
  console.log('[shouldSendEmail] Checking substage "' + trimmed + '":', result);
  if (!result) {
    console.log('[shouldSendEmail] Available substages:', Object.keys(SUBSTAGE_EMAIL_MAP));
  }
  return result;
}

/**
 * Validate that all required fields are present
 */
export function validateEmailFields(
  substage: string,
  data: Record<string, unknown>
): { valid: boolean; missingFields: string[] } {
  const trimmed = substage.trim();
  const metadata = getEmailMetadata(trimmed);
  if (!metadata) {
    console.log('[validateEmailFields] No metadata found for:', trimmed);
    return { valid: false, missingFields: ["substage"] };
  }

  // Check that clientName and clientEmail are always present
  const requiredFields = ["clientName", "clientEmail"];
  const missingFields = requiredFields.filter(
    (field) => !data[field] || (typeof data[field] === "string" && !data[field].trim())
  );

  console.log('[validateEmailFields] Missing fields:', missingFields);
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
