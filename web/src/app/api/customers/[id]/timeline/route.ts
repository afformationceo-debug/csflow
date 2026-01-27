import { NextRequest, NextResponse } from "next/server";
import { serverCustomerService } from "@/services/customers";

/**
 * Get customer timeline events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const timeline = await serverCustomerService.getCustomerTimeline(id, limit);

    return NextResponse.json({ timeline });
  } catch (error) {
    console.error("Failed to get customer timeline:", error);
    return NextResponse.json(
      { error: "Failed to get customer timeline" },
      { status: 500 }
    );
  }
}
