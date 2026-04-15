import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/email/send
 * Handles email sending by forwarding requests to the backend Java service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get backend URL from environment
    const backendUrl = process.env.BASE_URL || "http://localhost:8081";
    const backendEndpoint = `${backendUrl}/api/email/send`;

    console.log("[email/send] Forwarding request to backend");
    console.log("[email/send] Backend endpoint:", backendEndpoint);
    console.log("[email/send] Payload:", JSON.stringify(body, null, 2));

    // Forward request to Java backend
    const response = await fetch(backendEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        error: error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 }
    );
  }
}
