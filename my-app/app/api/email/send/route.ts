import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/email/send
 * Forwards email request to Java backend with auth headers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const backendEndpoint = `${BASE_URL}/api/email/send`;

    console.log("[email/send] Forwarding request to backend");
    console.log("[email/send] Backend endpoint:", backendEndpoint);
    console.log("[email/send] Payload:", JSON.stringify(body, null, 2));

    // ✅ SAME AUTH PATTERN AS OTHER APIs
    const headers = {
      ...upstreamAuthHeaders(request),
      "Content-Type": "application/json",
    };

    const response = await fetch(backendEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const responseData = await response.json();

    console.log("[email/send] Backend response status:", response.status);
    console.log("[email/send] Backend response:", responseData);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: responseData.error || "Failed to send email from backend",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Email sent successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[email/send] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 }
    );
  }
}