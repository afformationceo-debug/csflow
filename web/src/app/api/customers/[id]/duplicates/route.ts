import { NextRequest, NextResponse } from "next/server";
import { serverCustomerService } from "@/services/customers";

/**
 * Find potential duplicate customers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const duplicates = await serverCustomerService.findDuplicates(id);

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error("Failed to find duplicate customers:", error);
    return NextResponse.json(
      { error: "Failed to find duplicate customers" },
      { status: 500 }
    );
  }
}
