import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";

/**
 * Maps substages to email metadata
 * These match the backend SubStageConstants exactly
 */

export type EmailSubstage = 
  | "Meeting Scheduled"
  | "Meeting Rescheduled"
  | "Meeting Cancelled/Paused"
  | "No Response After Discussion"
  | "Quote Sent"
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
  "Quote Sent": {
    substage: "Quote Sent",
    subject: "Meeting Done – Your Quote is Coming Soon!",
    requiresEmail: true,
    optionalFields: ["quotedAmount"],
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

/** Pipeline / UI labels → canonical email substage keys. */
const EMAIL_SUBSTAGE_ALIASES: Record<string, EmailSubstage> = {
  "meeting successful": "Quote Sent",
  "meeting cancelled": "Meeting Cancelled/Paused",
  "meeting cancelled/paused": "Meeting Cancelled/Paused",
};

/**
 * Resolve CRM substage label to a key in {@link SUBSTAGE_EMAIL_MAP}.
 * Strips parenthetical stage suffixes, e.g. `Meeting Scheduled (Connection)`.
 */
export function resolveEmailSubstage(substage: string): EmailSubstage | null {
  const stripped = pipelineSubStageLabel(substage).trim();
  if (!stripped) return null;

  if (stripped in SUBSTAGE_EMAIL_MAP) {
    return stripped as EmailSubstage;
  }

  const alias = EMAIL_SUBSTAGE_ALIASES[stripped.toLowerCase()];
  if (alias) return alias;

  const lower = stripped.toLowerCase();
  for (const key of Object.keys(SUBSTAGE_EMAIL_MAP) as EmailSubstage[]) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

/**
 * Get email metadata for a given substage
 * Trims the substage string for safety
 */
export function getEmailMetadata(substage: string): EmailMetadata | null {
  const resolved = resolveEmailSubstage(substage);
  if (!resolved) return null;
  return SUBSTAGE_EMAIL_MAP[resolved];
}

/**
 * Check if a substage should trigger an email
 * Trims the substage string for safety
 */
export function shouldSendEmail(substage: string): boolean {
  return resolveEmailSubstage(substage) !== null;
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
    console.log("[validateEmailFields] No metadata found for:", substage.trim());
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
