import { NextRequest, NextResponse } from "next/server";
import { widgetService } from "@/services/widget";

/**
 * Create widget session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, language = "ko" } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // Get metadata from request
    const metadata = {
      userAgent: request.headers.get("user-agent") || undefined,
      referrer: request.headers.get("referer") || undefined,
      origin: request.headers.get("origin") || undefined,
    };

    const session = await widgetService.createWidgetSession(
      tenantId,
      language,
      metadata
    );

    return NextResponse.json({
      sessionId: session.id,
      language: session.language,
    });
  } catch (error) {
    console.error("Failed to create widget session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}

/**
 * CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
