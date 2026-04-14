import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mails/mailer";
import {
  getEmailMetadata,
  shouldSendEmail,
  validateEmailFields,
} from "@/lib/email-substage-mapper";
import { generateEmailHtml } from "@/lib/email-template-generator";

/**
 * Email request body structure
 */
interface SendEmailRequest {
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
 * POST /api/send-email
 * Sends email notifications based on CRM substage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<SendEmailRequest>;

    // Validate basic structure
    if (!body.subStage || typeof body.subStage !== "string") {
      return NextResponse.json(
        { error: "Missing required field: subStage" },
        { status: 400 }
      );
    }

    if (!body.clientName || typeof body.clientName !== "string") {
      return NextResponse.json(
        { error: "Missing required field: clientName" },
        { status: 400 }
      );
    }

    if (!body.clientEmail || typeof body.clientEmail !== "string") {
      return NextResponse.json(
        { error: "Missing required field: clientEmail" },
        { status: 400 }
      );
    }

    const substage = body.subStage.trim();

    // Check if this substage should trigger an email
    if (!shouldSendEmail(substage)) {
      return NextResponse.json(
        { error: `Substage "${substage}" does not trigger an email` },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.clientEmail.trim())) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    // Validate required fields for this substage
    const validation = validateEmailFields(substage, body as Record<string, unknown>);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `Missing required fields for substage "${substage}": ${validation.missingFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get email metadata
    const metadata = getEmailMetadata(substage);
    if (!metadata) {
      return NextResponse.json(
        { error: `Could not find email configuration for substage: ${substage}` },
        { status: 500 }
      );
    }

    // Generate email HTML
    let emailHtml: string;
    try {
      emailHtml = generateEmailHtml(substage, {
        clientName: body.clientName.trim(),
        clientEmail: body.clientEmail.trim(),
        meetingDate: body.meetingDate?.trim(),
        meetingTime: body.meetingTime?.trim(),
        meetingLocation: body.meetingLocation?.trim(),
        meetingType: body.meetingType,
        quotedAmount: body.quotedAmount?.trim(),
        reconnectDate: body.reconnectDate?.trim(),
        cancellationReason: body.cancellationReason?.trim(),
        feedbackFormLink: body.feedbackFormLink?.trim(),
      });
    } catch (generateError) {
      return NextResponse.json(
        {
          error: `Failed to generate email template: ${
            generateError instanceof Error ? generateError.message : "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }

    // Send email via Nodemailer
    try {
      await sendMail({
        to: body.clientEmail.trim(),
        subject: metadata.subject,
        html: emailHtml,
      });

      return NextResponse.json(
        {
          success: true,
          message: `Email sent successfully to ${body.clientEmail.trim()}`,
          substage,
        },
        { status: 200 }
      );
    } catch (mailError) {
      console.error("[send-email] Nodemailer error:", mailError);
      return NextResponse.json(
        {
          error: `Failed to send email: ${
            mailError instanceof Error ? mailError.message : "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[send-email] Request processing error:", error);
    return NextResponse.json(
      {
        error: `Invalid request: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 400 }
    );
  }
}
