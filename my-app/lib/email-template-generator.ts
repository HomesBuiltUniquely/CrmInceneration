/**
 * Generates email HTML content based on substage and data
 */

interface EmailData {
  clientName: string;
  clientEmail?: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingLocation?: string;
  meetingType?: "online" | "physical";
  quotedAmount?: string;
  reconnectDate?: string;
  cancellationReason?: string;
  feedbackFormLink?: string;
}

const BRAND_COLOR = "#0F6E56"; // Hub Interior green
const ACCENT_COLOR = "#E8F4F0";

const baseStyles = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
`;

const headerStyles = `
  background-color: ${BRAND_COLOR};
  color: white;
  padding: 24px;
  text-align: center;
  border-radius: 8px 8px 0 0;
`;

const bodyStyles = `
  padding: 24px;
  background-color: #f9f9f9;
`;

const footerStyles = `
  padding: 16px;
  background-color: #f0f0f0;
  text-align: center;
  font-size: 12px;
  color: #666;
  border-top: 1px solid #ddd;
`;

function wrapEmail(subject: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border: 1px solid #ddd;">
          ${body}
        </div>
      </body>
    </html>
  `;
}

function createHeader(title: string, emoji: string): string {
  return `
    <div style="${headerStyles}">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
        ${emoji} ${title}
      </h1>
    </div>
  `;
}

function createContent(content: string): string {
  return `
    <div style="${bodyStyles}">
      <p style="margin-top: 0; color: #555;">
        Dear {{clientName}},
      </p>
      ${content}
      <p style="margin-top: 24px; color: #666; font-size: 14px;">
        Best regards,<br/>
        <strong style="color: ${BRAND_COLOR};">Hub Interior Team</strong>
      </p>
    </div>
  `;
}

function createFooter(): string {
  return `
    <div style="${footerStyles}">
      This is an automated email from Hub Interior. Please do not reply to this email.
    </div>
  `;
}

function createMeetingDetailsTable(data: EmailData): string {
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: white; border: 1px solid #ddd;">
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: 600; width: 40%; color: ${BRAND_COLOR};">Date:</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${data.meetingDate || "TBD"}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: 600; color: ${BRAND_COLOR};">Time:</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${data.meetingTime || "TBD"}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: 600; color: ${BRAND_COLOR};">Location:</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${data.meetingLocation || "Will be shared soon"}</td>
      </tr>
      ${data.meetingType ? `
      <tr>
        <td style="padding: 12px; font-weight: 600; color: ${BRAND_COLOR};">Type:</td>
        <td style="padding: 12px;">${data.meetingType === "online" ? "📹 Video Call" : "🏢 In-Person"}</td>
      </tr>
      ` : ""}
    </table>
  `;
}

/**
 * Generate HTML email template for meeting scheduled
 */
function generateMeetingScheduled(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      Thank you for choosing Hub Interior! Your consultation meeting is confirmed.
    </p>
    ${createMeetingDetailsTable(data)}
    <p style="margin: 16px 0; color: #555;">
      Please have your floor plan, budget details, and design preferences ready for discussion.
      If you need to reschedule, please let us know at least 24 hours in advance.
    </p>
  `;
  
  return wrapEmail(
    "Your Meeting is Confirmed!",
    createHeader("Your Meeting is Confirmed!", "📅") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for meeting rescheduled
 */
function generateMeetingRescheduled(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      We've updated your meeting schedule. Here are the new details:
    </p>
    ${createMeetingDetailsTable(data)}
    <p style="margin: 16px 0; color: #555;">
      Thank you for your flexibility. We look forward to our discussion!
    </p>
  `;
  
  return wrapEmail(
    "Your Meeting has been Rescheduled",
    createHeader("Your Meeting has been Rescheduled", "📅") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for meeting cancelled
 */
function generateMeetingCancelled(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      We're sorry to inform you that your scheduled meeting has been cancelled.
      ${data.cancellationReason ? `<br/><br/><strong>Reason:</strong> ${data.cancellationReason}` : ""}
    </p>
    <p style="margin: 16px 0; color: #555;">
      If you would like to reschedule, please don't hesitate to reach out to us.
      We'd be happy to find a suitable time for you.
    </p>
  `;
  
  return wrapEmail(
    "Your Meeting has been Cancelled",
    createHeader("Your Meeting has been Cancelled", "❌") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for no response after discussion
 */
function generateNoResponseAfterDiscussion(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      We haven't heard back from you since our last discussion. We value your interest in Hub Interior
      and would love to continue exploring how we can help with your interior design needs.
    </p>
    ${data.reconnectDate ? `
    <p style="margin: 16px 0; color: #555;">
      We plan to follow up with you on <strong>${data.reconnectDate}</strong>.
      Feel free to reach out if you have any questions in the meantime.
    </p>
    ` : ""}
  `;
  
  return wrapEmail(
    "We Tried Reaching You Today",
    createHeader("We Tried Reaching You Today", "📞") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for consultation completed
 */
function generateConsultationCompleted(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      Thank you for taking the time to meet with us! We had a wonderful discussion about your interior
      design requirements.
    </p>
    <p style="margin: 16px 0; color: #555;">
      Our team is now preparing a detailed quote tailored to your specifications and budget.
      You can expect to receive it shortly.
    </p>
  `;
  
  return wrapEmail(
    "Meeting Done – Your Quote is Coming Soon!",
    createHeader("Meeting Done", "✅") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for quote sent
 */
function generateQuoteSent(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      Great news! Your interior design quote is ready. We've carefully prepared this estimate
      based on your requirements and preferences.
    </p>
    ${data.quotedAmount ? `
    <div style="background-color: ${ACCENT_COLOR}; padding: 16px; border-left: 4px solid ${BRAND_COLOR}; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 8px 0; color: #333;">
        <strong style="font-size: 18px; color: ${BRAND_COLOR};">Estimated Amount:</strong><br/>
        <span style="font-size: 24px; font-weight: 700; color: ${BRAND_COLOR};">${data.quotedAmount}</span>
      </p>
    </div>
    ` : ""}
    <p style="margin: 16px 0; color: #555;">
      Please review the attached quote and let us know if you have any questions or would like
      to discuss modifications.
    </p>
  `;
  
  return wrapEmail(
    "Your Interior Design Quote is Ready",
    createHeader("Your Quote is Ready", "💰") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for dropped after proposal
 */
function generateDroppedAfterProposal(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      We understand that our proposal may not have met your expectations at this time.
      We genuinely appreciate the opportunity to understand your vision.
    </p>
    <p style="margin: 16px 0; color: #555;">
      If circumstances change in the future, or if you'd like to discuss alternative solutions,
      we'd love to reconnect with you. Hub Interior is always here to help.
    </p>
  `;
  
  return wrapEmail(
    "We Hope to Work With You in the Future",
    createHeader("We Hope to Work Together", "🤝") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for budget mismatch
 */
function generateBudgetMismatch(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      We understand budget is an important consideration. At Hub Interior, we believe in delivering
      exceptional design solutions within your financial parameters.
    </p>
    <p style="margin: 16px 0; color: #555;">
      Our team is committed to finding creative solutions that don't compromise on quality.
      Let's explore alternatives that work for you. We'd like to discuss how we can optimize
      our proposal to better fit your budget.
    </p>
  `;
  
  return wrapEmail(
    "Let Us Offer You Our Best Price",
    createHeader("Let's Talk About Budget", "💵") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for project postponed
 */
function generateProjectPostponed(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      Thank you for keeping us updated. We understand that your project timeline may have shifted,
      and we're flexible to accommodate your changing needs.
    </p>
    ${data.reconnectDate ? `
    <p style="margin: 16px 0; background-color: ${ACCENT_COLOR}; padding: 12px; border-radius: 4px; color: #333;">
      <strong>📌 Expected Reconnect Date:</strong> ${data.reconnectDate}
    </p>
    ` : ""}
    <p style="margin: 16px 0; color: #555;">
      We'll keep your preferences on file and reconnect when your project is ready to move forward.
    </p>
  `;
  
  return wrapEmail(
    "We Will Reconnect With You as Discussed",
    createHeader("Project Postponed", "⏱️") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for customer cancelled
 */
function generateCustomerCancelled(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      We're sorry to see you go. Your decision means a lot to us, and we'd appreciate any feedback
      about your experience with Hub Interior.
    </p>
    ${data.feedbackFormLink ? `
    <p style="margin: 16px 0; text-align: center;">
      <a href="${data.feedbackFormLink}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600;">
        Share Your Feedback
      </a>
    </p>
    ` : ""}
    <p style="margin: 16px 0; color: #555;">
      If there's anything we could have done better, we'd love to hear from you.
      Perhaps we can help you in the future!
    </p>
  `;
  
  return wrapEmail(
    "Sorry to See You Go",
    createHeader("We'd Love Your Feedback", "👋") + createContent(content) + createFooter()
  );
}

/**
 * Generate HTML email template for booking done
 */
function generateBookingDone(data: EmailData): string {
  const content = `
    <p style="margin: 16px 0; color: #555;">
      Congratulations! Your booking is confirmed. We're thrilled to have you as our client.
    </p>
    <div style="background-color: ${ACCENT_COLOR}; padding: 16px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 8px 0; color: #333;">
        <strong>✅ Your Project is Locked In</strong><br/>
        Our design team will reach out shortly with next steps and project details.
      </p>
    </div>
    <p style="margin: 16px 0; color: #555;">
      Thank you for trusting us with your interior design project. We're excited to create
      something beautiful for you!
    </p>
  `;
  
  return wrapEmail(
    "Congratulations! Your Booking is Confirmed",
    createHeader("Booking Confirmed", "🎉") + createContent(content) + createFooter()
  );
}

/**
 * Generate email HTML based on substage
 */
export function generateEmailHtml(substage: string, data: EmailData): string {
  // Replace placeholders in the generated HTML
  let html = "";
  
  switch (substage) {
    case "Meeting Scheduled":
      html = generateMeetingScheduled(data);
      break;
    case "Meeting Rescheduled":
      html = generateMeetingRescheduled(data);
      break;
    case "Meeting Cancelled":
      html = generateMeetingCancelled(data);
      break;
    case "No Response After Discussion":
      html = generateNoResponseAfterDiscussion(data);
      break;
    case "Consultation Completed":
      html = generateConsultationCompleted(data);
      break;
    case "Quote Sent":
      html = generateQuoteSent(data);
      break;
    case "Dropped After Proposal":
      html = generateDroppedAfterProposal(data);
      break;
    case "Budget Mismatch":
      html = generateBudgetMismatch(data);
      break;
    case "Project Postponed":
      html = generateProjectPostponed(data);
      break;
    case "Customer Cancelled":
      html = generateCustomerCancelled(data);
      break;
    case "Booking Done":
      html = generateBookingDone(data);
      break;
    default:
      throw new Error(`Unknown substage: ${substage}`);
  }

  // Replace placeholder with actual client name
  html = html.replace(/{{clientName}}/g, data.clientName);
  
  return html;
}
