import { NextRequest, NextResponse } from "next/server";
import { widgetService } from "@/services/widget";

// Force dynamic rendering (opt out of static optimization)
export const dynamic = 'force-dynamic';

/**
 * Process widget message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, sessionId, message, language = "ko" } = body;

    if (!tenantId || !sessionId || !message) {
      return NextResponse.json(
        { error: "tenantId, sessionId, and message are required" },
        { status: 400 }
      );
    }

    const response = await widgetService.processWidgetMessage({
      tenantId,
      sessionId,
      message,
      language,
    });

    return NextResponse.json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Failed to process widget message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process message" },
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
